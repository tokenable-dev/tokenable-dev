import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Repository } from 'typeorm';
import { CardhedgerMetricsService } from '../../common/metrics/cardhedger-metrics.service';
import { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import { cardhedgerFromRwaMetadata } from './collection-listing-meta.helpers';
import {
  IDENTITY_CACHE_PROVIDER,
  type IdentityCacheProvider,
} from './identity-cache.provider';
import {
  IDENTITY_CACHE_TTL_MS,
} from './identity-cache-consistency.types';
import type {
  IdentityConsistencyContext,
  IdentityConsistencyResult,
} from './identity-cache-consistency.types';
import { IdentityCacheDecisionEngine } from './identity-cache-decision.engine';
import { IdentityCacheExecutionService } from './identity-cache-execution.service';
import type { CacheExecutionCommand } from './identity-cache-execution.types';
import { IdentityHotKeyLru } from './identity-hot-key.lru';
import { shouldSampleAsyncDriftLog } from './identity-log-sampler';
import { IdentityStructuredLogger } from './identity-structured-logger';
import {
  generateCorrelationId,
  getIdentityTraceStore,
  runWithIdentityCorrelation,
  withIdentitySpan,
} from './identity-trace.context';

type IdentitySource = 'mint' | 'cert' | 'resolve' | 'audit';
type IdentityDecision = 'accepted' | 'rejected' | 'noop';

type IdentityWriteDecision =
  | { outcome: 'noop'; detail: string }
  | { outcome: 'rejected'; detail: string }
  | { outcome: 'accept'; cardId: string; extras?: Record<string, unknown> };

/** Post-commit cache hint derived from the locked transaction — avoids DB re-read. */
type IdentityCacheHint = string | null | undefined;
// undefined → leave cache unchanged; string → set if changed; null → evict

/**
 * Canonical write authority for `collection.components.cardhedgerCardId`.
 *
 * **Precedence** (highest → lowest):
 *   Stored valid ID (audit passes) > Mint metadata > Cert lookup > Search result
 *
 * **Write entry points:**
 *   - `writeFromMintMetadata`   — IPFS/RWA on-chain metadata (`graded.cardhedger.cardId`)
 *   - `writeFromCertLookup`     — PSA cert-number lookup (`/v1/cards/details-by-certs`)
 *   - `writeFromResolvedSearch` — Cardhedger card search resolution
 *
 * **Read entry points:**
 *   - `readOrResolve`           — layered cache-first (L1→L2→DB→null), no Cardhedger API
 *   - `hydrateCardhedgerCardId` — enriches a loaded `MarketplaceCollection` in-memory
 *
 * **Caching:**
 *   Uses {@link IdentityCacheProvider} (injected via `IDENTITY_CACHE_PROVIDER`).
 *   Default: L1 in-process Map + L2 Redis when `REDIS_URL` is set.
 *   Read order: L2 (Redis) → L1 fallback. Write order: L2 → L1.
 *
 * **Concurrency (P3.1):**
 *   All three write paths run inside a DB transaction with `SELECT … FOR UPDATE`
 *   on the collection row, then a conditional `UPDATE … WHERE cardhedgerCardId IS NULL`.
 *   Multi-pod safe without distributed locks; precedence is enforced on the locked row.
 *
 * **Cache consistency (P3.2 / P3.3):**
 *   - Post-commit **write-through** from transaction outcomes — no DB re-read after writes.
 *   - Audit clears use {@link clearCardhedgerCardIdIfUnchanged} — conditional DB clear under
 *     row lock; cache evicted only when the expected ID is still stored.
 *   - {@link readOrResolve} remains read-through on cache miss (DB fallback only on miss).
 *   - L2 is authoritative when connected; L1 stale entries are evicted on L2 miss.
 *
 * **Observability (P3.4):**
 *   Sampled cache-vs-DB drift checks on cache hits ({@link readOrResolve}).
 *   Write-through hint, cache write, Redis failure, and audit-clear metrics via
 *   {@link CardhedgerMetricsService} + Prometheus export.
 *
 * **Self-healing (P3.5):**
 *   Read-path auto-repair when cache_stale drift is detected (DB-authoritative).
 *   L2-miss + L1-hit probe before {@link IdentityCacheProvider.exists} evicts L1.
 *   Repair dedup: 10 s cooldown + in-flight map per key. Audit skip key tracking.
 *
 * **Proactive reconciliation (P3.6):**
 *   Hot-key LRU tracking on {@link readOrResolve}. Background job scans hot keys via
 *   {@link IdentityCacheReconciliationService}.
 *
 * **Unified repair policy (P3.7–P3.12):**
 *   Decision ({@link IdentityCacheDecisionEngine}) → IO command →
 *   {@link IdentityCacheExecutionService.execute}. Execution layer has no drift/policy types.
 * When disabled every method is a no-op; existing write paths continue unchanged.
 *
 * Logging:
 *   - `[identity]       key=… source=… decision=…` — write decisions
 * Structured logs (P3.19): JSON events `identity_cache_*` — see {@link IdentityStructuredLogger}.
 */
@Injectable()
export class CollectionIdentityService {
  private readonly logger = new Logger(CollectionIdentityService.name);

  /** Feature flag: true only when `IDENTITY_SERVICE_ENABLED=true|1` in env. */
  private readonly enabled: boolean;

  /**
   * Fraction of cache hits that trigger an async cache-vs-DB drift check (0–1).
   * Set `IDENTITY_CACHE_DRIFT_SAMPLE_RATE=0` to disable. Default: 0.01 (1%).
   */
  private readonly driftSampleRate: number;

  /** Warn when the same key accumulates this many audit skipped_id_changed events. */
  private readonly auditSkipWarnThreshold: number;

  /** Repeated audit skip (skipped_id_changed) counts per key — capped (P3.17). */
  private readonly auditSkipCounts = new Map<string, number>();
  private static readonly AUDIT_SKIP_TRACK_MAX_KEYS = 2_000;

  /** MRU hot keys for proactive reconciliation (P3.6). */
  private readonly hotKeys: IdentityHotKeyLru;

  constructor(
    @InjectRepository(MarketplaceCollection)
    private readonly collectionRepo: Repository<MarketplaceCollection>,
    private readonly config: ConfigService,
    @Inject(IDENTITY_CACHE_PROVIDER)
    private readonly cache: IdentityCacheProvider,
    private readonly cacheDecision: IdentityCacheDecisionEngine,
    private readonly cacheExecution: IdentityCacheExecutionService,
    private readonly identityLog: IdentityStructuredLogger,
    @Optional() private readonly metrics?: CardhedgerMetricsService,
  ) {
    const flag = this.config.get<string>('IDENTITY_SERVICE_ENABLED') ?? '';
    this.enabled = flag === 'true' || flag === '1';
    this.driftSampleRate = parseDriftSampleRate(
      this.config.get<string>('IDENTITY_CACHE_DRIFT_SAMPLE_RATE'),
    );
    this.auditSkipWarnThreshold = parseAuditSkipWarnThreshold(
      this.config.get<string>('IDENTITY_AUDIT_SKIP_WARN_THRESHOLD'),
    );
    this.hotKeys = new IdentityHotKeyLru(
      parseHotKeyLruSize(this.config.get<string>('IDENTITY_HOT_KEY_LRU_SIZE')),
    );
    if (this.enabled) {
      this.logger.log(
        `[identity] CollectionIdentityService ENABLED driftSampleRate=${this.driftSampleRate} auditSkipWarnThreshold=${this.auditSkipWarnThreshold}`,
      );
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private logDecision(
    collectionKey: string,
    source: IdentitySource,
    decision: IdentityDecision,
    detail?: string,
  ): void {
    this.identityLog.logWrite(
      this.logger,
      'info',
      {
        key: collectionKey,
        outcome: decision,
        context: 'write',
        detail: detail ? `${source}:${detail}` : source,
      },
    );
  }

  private storedCardId(comp: Record<string, unknown>): string {
    return typeof comp.cardhedgerCardId === 'string'
      ? comp.cardhedgerCardId.trim()
      : '';
  }

  private async loadRow(
    collectionKey: string,
  ): Promise<MarketplaceCollection | null> {
    return this.collectionRepo.findOne({
      where: { collectionKey: collectionKey.toLowerCase() },
    });
  }

  /**
   * Serialize identity writes for one collection row across pods via
   * `SELECT … FOR UPDATE`, then apply a conditional UPDATE that only succeeds
   * while `components.cardhedgerCardId` is still empty.
   *
   * Precedence is evaluated on the locked row — concurrent mint/cert/resolve
   * callers queue on the row lock instead of racing through loadRow().
   */
  private async withExclusiveWrite(
    collectionKey: string,
    source: IdentitySource,
    decide: (
      comp: Record<string, unknown>,
      existing: string,
    ) => IdentityWriteDecision,
  ): Promise<void> {
    const key = collectionKey.toLowerCase();

    const txResult = await this.collectionRepo.manager.transaction(
      async (em) => {
        const row = await em.findOne(MarketplaceCollection, {
          where: { collectionKey: key },
          lock: { mode: 'pessimistic_write' },
        });
        if (!row) {
          return {
            decision: 'rejected' as const,
            detail: 'collection_not_found',
            cacheHint: undefined as IdentityCacheHint,
          };
        }

        const comp = row.components;
        const existing = this.storedCardId(comp);
        const writeDecision = decide(comp, existing);

        if (writeDecision.outcome === 'noop') {
          return {
            decision: 'noop' as const,
            detail: writeDecision.detail,
            // Refresh TTL when ID unchanged (e.g. seed pre-warm); skip if cache already matches.
            cacheHint: existing || undefined,
          };
        }
        if (writeDecision.outcome === 'rejected') {
          return {
            decision: 'rejected' as const,
            detail: writeDecision.detail,
            // Reconcile seed pre-warm when a different stored ID wins under lock.
            cacheHint: existing || undefined,
          };
        }

        const persisted = await this.persistIdIfEmpty(
          em,
          key,
          comp,
          writeDecision.cardId,
          writeDecision.extras ?? {},
        );
        if (!persisted) {
          const current = this.storedCardId(comp);
          return {
            decision: 'rejected' as const,
            detail: current
              ? `stored_id=${current}_conditional_update_blocked`
              : 'conditional_update_blocked',
            cacheHint: current || undefined,
          };
        }

        return {
          decision: 'accepted' as const,
          detail: `new_id=${writeDecision.cardId}`,
          cacheHint: writeDecision.cardId,
        };
      },
    );

    await this.applyPostCommitCache(key, txResult.cacheHint);
    this.logDecision(key, source, txResult.decision, txResult.detail);
  }

  /**
   * Atomic first-write: updates only when cardhedgerCardId is null/empty.
   * Called inside a transaction that already holds `FOR UPDATE` on the row.
   */
  private async persistIdIfEmpty(
    em: EntityManager,
    collectionKey: string,
    comp: Record<string, unknown>,
    cardId: string,
    extras: Record<string, unknown>,
  ): Promise<boolean> {
    const merged = {
      ...comp,
      cardhedgerCardId: cardId,
      ...extras,
    } as QueryDeepPartialEntity<Record<string, unknown>>;

    const result = await em
      .createQueryBuilder()
      .update(MarketplaceCollection)
      .set({ components: merged })
      .where('collection_key = :key', { key: collectionKey })
      .andWhere(
        `(components->>'cardhedgerCardId' IS NULL OR BTRIM(components->>'cardhedgerCardId') = '')`,
      )
      .execute();

    return (result.affected ?? 0) > 0;
  }

  /**
   * Write-through cache update from a known committed value — no DB round-trip.
   * Skips L1/L2 writes when the cached value already matches (reduces churn).
   */
  private async applyPostCommitCache(
    key: string,
    cacheHint: IdentityCacheHint,
  ): Promise<void> {
    if (!this.enabled || cacheHint === undefined) {
      this.metrics?.recordIdentityWriteHint('skipped_no_hint');
      return;
    }

    if (cacheHint === null) {
      await this.cache.delete(key);
      this.metrics?.recordIdentityWriteHint('evict');
      return;
    }

    if (await this.cache.exists(key)) {
      const cached = await this.cache.get(key);
      if (cached === cacheHint) {
        this.metrics?.recordIdentityWriteHint('unchanged');
        return;
      }
    }
    await this.cache.set(key, cacheHint, IDENTITY_CACHE_TTL_MS);
    this.metrics?.recordIdentityWriteHint('applied');
  }

  private shouldSampleDrift(): boolean {
    if (this.driftSampleRate <= 0) return false;
    return Math.random() < this.driftSampleRate;
  }

  private trackAuditSkipIdChanged(key: string): void {
    if (
      this.auditSkipCounts.size >= CollectionIdentityService.AUDIT_SKIP_TRACK_MAX_KEYS &&
      !this.auditSkipCounts.has(key)
    ) {
      return;
    }
    const count = (this.auditSkipCounts.get(key) ?? 0) + 1;
    this.auditSkipCounts.set(key, count);
    if (count >= this.auditSkipWarnThreshold) {
      this.identityLog.logWrite(
        this.logger,
        'warn',
        {
          key,
          outcome: 'audit_skip_repeated',
          context: 'write',
          detail: `count=${count}`,
        },
      );
    }
  }

  /**
   * Audit-driven clear under row lock: removes `cardhedgerCardId` only when it still
   * equals `expectedCardId` (snapshot taken before the Cardhedger HTTP call).
   *
   * Prevents a slow audit from clearing a newer identity write that landed during
   * the HTTP window. Cache is evicted only when the DB row was actually cleared.
   *
   * Not gated by `IDENTITY_SERVICE_ENABLED` — audit safety applies regardless of flag.
   */
  async clearCardhedgerCardIdIfUnchanged(
    collectionKey: string,
    expectedCardId: string,
  ): Promise<{ cleared: boolean }> {
    const key = collectionKey.toLowerCase();
    const expected = expectedCardId.trim();
    if (!expected) {
      this.metrics?.recordIdentityAuditClear('skipped_empty_expected');
      return { cleared: false };
    }

    let cleared = false;
    let auditOutcome: 'cleared' | 'skipped_id_changed' | 'skipped_not_found' =
      'skipped_id_changed';

    await this.collectionRepo.manager.transaction(async (em) => {
      const row = await em.findOne(MarketplaceCollection, {
        where: { collectionKey: key },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) {
        auditOutcome = 'skipped_not_found';
        return;
      }

      const current = this.storedCardId(row.components);
      if (current !== expected) return;

      const nextComponents: Record<string, unknown> = { ...row.components };
      delete nextComponents.cardhedgerCardId;
      delete nextComponents.cardhedgerSearchQuery;

      const result = await em
        .createQueryBuilder()
        .update(MarketplaceCollection)
        .set({
          components: nextComponents as QueryDeepPartialEntity<
            Record<string, unknown>
          >,
        })
        .where('collection_key = :key', { key })
        .andWhere(`components->>'cardhedgerCardId' = :expected`, {
          expected,
        })
        .execute();

      cleared = (result.affected ?? 0) > 0;
      if (cleared) auditOutcome = 'cleared';
    });

    this.metrics?.recordIdentityAuditClear(auditOutcome);

    if (auditOutcome === 'skipped_id_changed') {
      this.trackAuditSkipIdChanged(key);
    }

    if (cleared) {
      await this.applyPostCommitCache(key, null);
    }

    return { cleared };
  }

  /**
   * Evict a collection key from L1 and L2 identity caches.
   *
   * Idempotent — safe when the key is absent. Fail-open when Redis is down.
   * Called after audit-driven DB clears so stale cached IDs are not served.
   */
  async invalidate(collectionKey: string): Promise<void> {
    const key = collectionKey.toLowerCase();
    await this.cache.delete(key);
  }

  // ---------------------------------------------------------------------------
  // P3.6 — proactive reconciliation helpers (read-only compare + shared repair)
  // ---------------------------------------------------------------------------

  /** Record read-path access for hot-key tracking. */
  recordHotKeyAccess(collectionKey: string): void {
    if (!this.enabled) return;
    this.hotKeys.touch(collectionKey);
  }

  getHotKeyCount(): number {
    return this.hotKeys.size();
  }

  getHotKeySnapshotMruFirst(): string[] {
    return this.hotKeys.snapshotMruFirst();
  }

  private async evaluateL1Probe(
    key: string,
  ): Promise<{ handled: boolean; returnValue: string | null }> {
    const l1Value = await this.cacheExecution.probeL2MissL1Hit(key);
    if (!l1Value) return { handled: false, returnValue: null };

    const result = await this.evaluateAndRepair(key, {
      context: 'read_l1_probe',
      cacheExists: true,
      cachedValue: l1Value,
    });
    return { handled: true, returnValue: result.returnValue };
  }

  private async evaluateAndRepair(
    key: string,
    options: {
      context: IdentityConsistencyContext;
      cacheExists?: boolean;
      cachedValue?: string | null;
      dbValue?: string;
    },
  ): Promise<IdentityConsistencyResult> {
    const run = () => this.evaluateAndRepairTraced(key, options);
    if (getIdentityTraceStore()) return run();
    return runWithIdentityCorrelation(generateCorrelationId(), run);
  }

  private async evaluateAndRepairTraced(
    key: string,
    options: {
      context: IdentityConsistencyContext;
      cacheExists?: boolean;
      cachedValue?: string | null;
      dbValue?: string;
    },
  ): Promise<IdentityConsistencyResult> {
    const normalized = key.toLowerCase();
    return withIdentitySpan(
      'decision',
      { collectionKey: normalized, detail: options.context },
      async () => {
    const dbValue =
      options.dbValue ?? (await this.cacheExecution.loadDbCardId(normalized));

    let cacheExists = options.cacheExists;
    let cachedValue = options.cachedValue;

    if (cacheExists === undefined) {
      const cacheState = await this.cacheExecution.readCacheState(normalized);
      cacheExists = cacheState.cacheExists;
      if (cachedValue === undefined && cacheExists) {
        cachedValue = cacheState.cachedValue;
      }
    } else if (cachedValue === undefined && cacheExists) {
      cachedValue = (await this.cacheExecution.readCacheState(normalized))
        .cachedValue;
    }

    const { driftKind, action } = this.cacheDecision.decide({
      cacheExists: cacheExists ?? false,
      cachedValue: cachedValue ?? null,
      dbValue,
    });

    if (this.cacheDecision.shouldRecordDriftMetric(options.context, driftKind)) {
      this.metrics?.recordIdentityCacheDrift(
        driftKind as Exclude<typeof driftKind, 'miss'>,
      );
    }

    const driftEvent = this.cacheDecision.describeDriftEvent(driftKind);

    const bypassCooldown = this.cacheDecision.shouldBypassRepairCooldown(
      options.context,
    );
    const command = this.cacheDecision.buildExecutionCommand(
      normalized,
      action,
      dbValue,
      bypassCooldown,
    );
    const executeResult = await withIdentitySpan(
      'execution',
      { collectionKey: normalized, detail: command.op },
      () => this.cacheExecution.execute(command),
    );

    this.logRepairResult(
      normalized,
      command,
      executeResult,
      options.context,
      driftEvent && executeResult.applied ? driftKind : undefined,
    );

    if (driftEvent && !executeResult.applied) {
      const logDrift =
        options.context !== 'read_async' ||
        shouldSampleAsyncDriftLog(this.driftSampleRate);
      if (logDrift) {
        this.identityLog.logDrift(
          this.logger,
          driftEvent.level,
          {
            key: normalized,
            outcome: driftKind,
            driftKind,
            context: options.context,
          },
        );
      }
    }

    const returnValue = this.cacheDecision.resolveReturnValue(
      driftKind,
      dbValue,
      cachedValue ?? null,
      executeResult.applied,
      options.context,
    );

    return {
      returnValue,
      driftKind,
      action,
      repaired: executeResult.applied,
      skippedCooldown: executeResult.skippedCooldown,
    };
      },
    );
  }

  private logRepairResult(
    key: string,
    command: CacheExecutionCommand,
    result: { applied: boolean; skippedCooldown: boolean },
    context: IdentityConsistencyContext,
    driftKind?: string,
  ): void {
    if (result.applied) {
      const outcome =
        command.op === 'delete'
          ? 'evict'
          : command.op === 'replace'
            ? 'replace'
            : 'set';
      this.identityLog.logRepair(this.logger, 'info', {
        key,
        outcome,
        context,
        ...(driftKind ? { driftKind } : {}),
      });
      return;
    }
    if (result.skippedCooldown) {
      this.identityLog.logRepair(this.logger, 'debug', {
        key,
        outcome: 'skipped_cooldown',
        context,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Public read path
  // ---------------------------------------------------------------------------

  /**
   * **Layered cache-first read of `cardhedgerCardId` for a collection.**
   *
   * Resolution order (via {@link IdentityCacheProvider}):
   *   1. L2 Redis (authoritative across pods)
   *   2. L1 in-process cache
   *   3. DB fallback (one `SELECT` on combined cache miss)
   *   4. Null — no cross-pod null tombstones in Redis
   *
   * Never calls Cardhedger API. Safe on every read path.
   */
  async readOrResolve(collectionKey: string): Promise<string | null> {
    const key = collectionKey.toLowerCase();

    this.recordHotKeyAccess(key);

    const l1Probe = await this.evaluateL1Probe(key);
    if (l1Probe.handled) {
      return l1Probe.returnValue;
    }

    const cacheHit = await this.cache.exists(key);
    if (cacheHit) {
      const value = await this.cache.get(key);
      if (value) {
        if (this.shouldSampleDrift()) {
          const result = await this.evaluateAndRepair(key, {
            context: 'read_sync',
            cacheExists: true,
            cachedValue: value,
          });
          if (
            this.cacheDecision.shouldOverrideCacheHitReturn(
              'read_sync',
              result.driftKind,
            )
          ) {
            return result.returnValue;
          }
        } else {
          void this.evaluateAndRepair(key, {
            context: 'read_async',
            cacheExists: true,
            cachedValue: value,
          });
        }
      }
      return value;
    }

    const dbValue = await this.cacheExecution.loadDbCardId(key);
    const populated = await this.evaluateAndRepair(key, {
      context: 'read_populate',
      cacheExists: false,
      cachedValue: null,
      dbValue,
    });
    return populated.returnValue;
  }

  /**
   * **In-memory hydration of a loaded `MarketplaceCollection`.**
   *
   * Returns the collection unchanged if `cardhedgerCardId` is already populated.
   * When null, checks the layered cache (L1→L2→DB) and merges the value into a
   * new collection object (no DB write — read-only enrichment for downstream consumers).
   *
   * Only active when `IDENTITY_SERVICE_ENABLED=true`.
   */
  async hydrateCardhedgerCardId(
    col: MarketplaceCollection,
  ): Promise<MarketplaceCollection> {
    if (!this.enabled) return col;

    const existing = this.storedCardId(col.components);
    if (existing) return col;

    const resolved = await this.readOrResolve(col.collectionKey);
    if (!resolved) return col;

    return {
      ...col,
      components: { ...col.components, cardhedgerCardId: resolved },
    };
  }

  // ---------------------------------------------------------------------------
  // Public write paths
  // ---------------------------------------------------------------------------

  /**
   * **Path 1 — IPFS / RWA mint metadata.**
   *
   * Accepts when no cardhedgerCardId is currently stored.
   * Rejects (stored ID is authoritative) when a different ID already exists.
   */
  async writeFromMintMetadata(
    collectionKey: string,
    meta: Record<string, unknown>,
  ): Promise<void> {
    if (!this.enabled) return;

    const key = collectionKey.toLowerCase();
    const ch = cardhedgerFromRwaMetadata(meta);
    if (!ch.cardId) {
      this.logDecision(key, 'mint', 'noop', 'no_card_id_in_meta');
      return;
    }
    const cardId = ch.cardId;

    await this.withExclusiveWrite(key, 'mint', (_comp, existing) => {
      if (existing === cardId) {
        return { outcome: 'noop', detail: 'id_already_stored' };
      }
      if (existing) {
        return {
          outcome: 'rejected',
          detail: `stored_id=${existing} incoming=${cardId}`,
        };
      }

      const extras: Record<string, unknown> = {};
      if (ch.psaSpecId) extras.psaSpecId = ch.psaSpecId;
      if (ch.searchQuery) extras.cardhedgerSearchQuery = ch.searchQuery;

      return { outcome: 'accept', cardId, extras };
    });
  }

  /**
   * **Path 2 — PSA cert number lookup.**
   *
   * Accepts only when the collection has no stored ID yet (lower precedence than mint).
   */
  async writeFromCertLookup(
    collectionKey: string,
    certCardId: string,
    searchQuery?: string | null,
  ): Promise<void> {
    if (!this.enabled) return;

    const trimmedId = certCardId.trim();
    if (!trimmedId) return;

    const key = collectionKey.toLowerCase();
    await this.withExclusiveWrite(key, 'cert', (_comp, existing) => {
      if (existing === trimmedId) {
        return { outcome: 'noop', detail: 'id_already_stored' };
      }
      if (existing) {
        return { outcome: 'rejected', detail: `stored_id=${existing}` };
      }

      const extras: Record<string, unknown> = {};
      if (searchQuery?.trim()) extras.cardhedgerSearchQuery = searchQuery.trim();

      return { outcome: 'accept', cardId: trimmedId, extras };
    });
  }

  /**
   * Store a CardHedger-formatted search query derived from cert lookup
   * `cert_info.description` when `card: null`.
   *
   * Does NOT write a `cardhedgerCardId`. Only sets `cardhedgerSearchQuery`
   * so the text-search path uses it as a high-priority candidate.
   * No-op if a query (or card ID) is already stored.
   */
  async writeSearchQueryFromCert(
    collectionKey: string,
    description: string,
  ): Promise<void> {
    if (!this.enabled) return;
    const trimmed = description.trim();
    if (!trimmed) return;
    const key = collectionKey.toLowerCase();
    const col = await this.collectionRepo.findOne({ where: { collectionKey: key } });
    if (!col) return;
    const comp = (col.components ?? {}) as Record<string, unknown>;
    // Skip if a card ID or search query is already stored
    if (comp.cardhedgerCardId || comp.cardhedgerSearchQuery) return;
    await this.collectionRepo.update(
      { collectionKey: key },
      { components: { ...comp, cardhedgerSearchQuery: trimmed } },
    );
    this.identityLog.logWrite(this.logger, 'info', {
      key,
      outcome: 'cert_desc_search_query_stored',
      context: 'write',
      detail: `query="${trimmed.slice(0, 80)}"`,
    });
  }

  /**
   * **Path 3 — Cardhedger card search resolution.**
   *
   * Lowest precedence. Only `'verified'` confidence is accepted.
   */
  async writeFromResolvedSearch(
    collectionKey: string,
    resolvedCardId: string,
    confidence: 'verified' | 'approximate',
    searchQuery?: string | null,
  ): Promise<void> {
    if (!this.enabled) return;

    const trimmedId = resolvedCardId.trim();
    if (!trimmedId) return;

    const key = collectionKey.toLowerCase();
    await this.withExclusiveWrite(key, 'resolve', (_comp, existing) => {
      if (existing === trimmedId) {
        return { outcome: 'noop', detail: 'id_already_stored' };
      }
      if (existing) {
        return {
          outcome: 'rejected',
          detail: `stored_id=${existing} confidence=${confidence}`,
        };
      }
      if (confidence !== 'verified') {
        return {
          outcome: 'rejected',
          detail: `confidence=${confidence}_below_verified_threshold`,
        };
      }

      const extras: Record<string, unknown> = {};
      if (searchQuery?.trim()) extras.cardhedgerSearchQuery = searchQuery.trim();

      return { outcome: 'accept', cardId: trimmedId, extras };
    });
  }

  /**
   * **Init path — seed `cardhedgerCardId` immediately after a new collection INSERT.**
   *
   * **Critical:** the cache (L1 + L2) is pre-populated SYNCHRONOUSLY (before `await`)
   * so reads during the async DB-write window serve the correct card ID from cache.
   * In multi-pod deployments, L2 (Redis) pre-population ensures cross-pod consistency
   * even before the DB write completes.
   *
   * Non-blocking: callers should fire this with `void`.
   */
  async seedFromMintMetadataOnInsert(
    collectionKey: string,
    meta: Record<string, unknown>,
  ): Promise<void> {
    if (!this.enabled) return;

    const key = collectionKey.toLowerCase();
    const ch = cardhedgerFromRwaMetadata(meta);

    if (!ch.cardId) {
      this.identityLog.logWrite(
        this.logger,
        'debug',
        {
          key,
          outcome: 'seed_skip',
          context: 'write',
          detail: 'source=none',
        },
      );
      return;
    }

    // *** Pre-populate BOTH cache layers BEFORE the async DB write ***
    // LayeredProvider writes L2 (Redis) first, then L1 — ensuring cross-pod
    // reads during the INSERT → DB-write propagation window are served correctly.
    await this.cache.set(key, ch.cardId, IDENTITY_CACHE_TTL_MS);

    // writeFromMintMetadata is idempotent: noop if value already stored in DB.
    await this.writeFromMintMetadata(key, meta);

    this.identityLog.logWrite(
      this.logger,
      'info',
      {
        key,
        outcome: 'seed',
        context: 'write',
        detail: `source=mint id=${ch.cardId}`,
      },
    );
  }

  /**
   * **Audit path — forward audit outcomes for unified logging.**
   */
  logAuditDecision(
    collectionKey: string,
    result: { ok: boolean; cleared: boolean; failCodes: string[] },
  ): void {
    const decision: IdentityDecision = result.ok
      ? 'noop'
      : result.cleared
        ? 'accepted'
        : 'rejected';
    const detail = result.ok
      ? 'id_valid'
      : `fail_codes=${result.failCodes.join('|')}${result.cleared ? ' cleared=true' : ''}`;
    this.logDecision(collectionKey, 'audit', decision, detail);
  }
}

function parseDriftSampleRate(raw: string | undefined): number {
  if (raw == null || raw.trim() === '') return 0.01;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 1);
}

function parseAuditSkipWarnThreshold(raw: string | undefined): number {
  if (raw == null || raw.trim() === '') return 3;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 3;
  return Math.min(Math.floor(n), 100);
}

function parseHotKeyLruSize(raw: string | undefined): number {
  if (raw == null || raw.trim() === '') return 500;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 50) return 500;
  return Math.min(Math.floor(n), 5_000);
}
