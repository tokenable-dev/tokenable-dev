import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CardhedgerMetricsService } from '../../common/metrics/cardhedger-metrics.service';
import { CollectionMarketSnapshotService } from './collection-market-snapshot.service';
import { Order, OrderSide, OrderStatus } from '../entities/order.entity';
import { CollectionMarketSnapshot } from '../entities/collection-market-snapshot.entity';
import { RwaToken } from '../entities/rwa-token.entity';
import type {
  SnapshotRefreshJob,
  SnapshotRefreshReason,
} from '../utils/market-snapshot.types';
import {
  collectionKeyToAdvisoryLockKey,
  formatAdvisoryLockKey,
  type SnapshotAdvisoryLockKey,
} from '../utils/snapshot-advisory-lock.util';

/** Result of `pg_try_advisory_lock` — drives retry vs fail-closed paths. */
type LockResult = 'acquired' | 'held' | 'db_error';

/**
 * Schedules materialized snapshot refresh.
 * In-memory queue today — swap enqueue/process for BullMQ workers later.
 */
@Injectable()
export class CollectionMarketSnapshotSchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(
    CollectionMarketSnapshotSchedulerService.name,
  );
  private readonly queue: SnapshotRefreshJob[] = [];
  private readonly queuedKeys = new Set<string>();
  /** Keys with a scheduled lock-retry timer (dedup gate for enqueue). */
  private readonly pendingLockRetries = new Set<string>();
  private readonly lockRetryTimers = new Map<string, NodeJS.Timeout>();
  private processing = false;
  private drainTimer: NodeJS.Timeout | null = null;
  /** Last observed null-cardhedgerCardId ratio from the batch-reduction check. */
  private lastNullIdRatio: number | null = null;

  constructor(
    private readonly config: ConfigService,
    @Inject(forwardRef(() => CollectionMarketSnapshotService))
    private readonly snapshotService: CollectionMarketSnapshotService,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(CollectionMarketSnapshot)
    private readonly snapshotRepo: Repository<CollectionMarketSnapshot>,
    @InjectRepository(RwaToken)
    private readonly rwaTokenRepo: Repository<RwaToken>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Optional() private readonly metrics?: CardhedgerMetricsService,
  ) {}

  prewarmEnabled(): boolean {
    const raw = this.config.get<string>('MARKET_SNAPSHOT_PREWARM_ENABLED');
    if (raw === '1' || raw === 'true') return true;
    if (raw === '0' || raw === 'false') return false;
    /** Cron off → skip boot snapshot flood (Cardhedger/PSA can starve the HTTP event loop locally). */
    if (!this.cronEnabled()) return false;
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  onModuleInit(): void {
    if (!this.prewarmEnabled()) return;
    const delay = this.prewarmDelayMs();
    if (delay <= 0) return;
    setTimeout(() => {
      void this.runScheduledRefresh('prewarm');
    }, delay);
  }

  onModuleDestroy(): void {
    if (this.drainTimer) clearTimeout(this.drainTimer);
    for (const timer of this.lockRetryTimers.values()) {
      clearTimeout(timer);
    }
    this.lockRetryTimers.clear();
    this.pendingLockRetries.clear();
  }

  refreshConcurrency(): number {
    const raw = Number(
      this.config.get<string>('MARKET_SNAPSHOT_REFRESH_CONCURRENCY') ?? '4',
    );
    if (!Number.isFinite(raw) || raw < 1) return 4;
    return Math.min(Math.floor(raw), 16);
  }

  recentFillDays(): number {
    const raw = Number(
      this.config.get<string>('MARKET_SNAPSHOT_RECENT_FILL_DAYS') ?? '30',
    );
    if (!Number.isFinite(raw) || raw < 1) return 30;
    return Math.min(Math.floor(raw), 180);
  }

  viewedLookbackDays(): number {
    const raw = Number(
      this.config.get<string>('MARKET_SNAPSHOT_VIEWED_LOOKBACK_DAYS') ?? '7',
    );
    if (!Number.isFinite(raw) || raw < 1) return 7;
    return Math.min(Math.floor(raw), 90);
  }

  prewarmDelayMs(): number {
    const raw = Number(
      this.config.get<string>('MARKET_SNAPSHOT_PREWARM_DELAY_MS') ?? '8000',
    );
    if (!Number.isFinite(raw) || raw < 0) return 8000;
    return Math.min(Math.floor(raw), 120_000);
  }

  cronEnabled(): boolean {
    const raw = this.config.get<string>('MARKET_SNAPSHOT_CRON_ENABLED');
    return raw !== '0' && raw !== 'false';
  }

  /** Public enqueue API — used by scheduler and stale-while-revalidate hooks. */
  enqueue(collectionKey: string, reason: SnapshotRefreshReason): void {
    const key = collectionKey.toLowerCase();
    if (!key || this.queuedKeys.has(key) || this.pendingLockRetries.has(key)) {
      return;
    }
    const priority = this.priorityForReason(reason);
    this.queue.push({
      collectionKey: key,
      reason,
      priority,
      enqueuedAt: Date.now(),
      attempt: 0,
    });
    this.queuedKeys.add(key);
    this.queue.sort((a, b) => b.priority - a.priority || a.enqueuedAt - b.enqueuedAt);
    this.scheduleDrain();
  }

  /**
   * Handles 'snapshot.enqueue' events emitted by CollectionService (and any future domain
   * services) so they do not need a direct injection of this scheduler.
   */
  @OnEvent('snapshot.enqueue')
  handleSnapshotEnqueue(payload: { key: string; reason: string }): void {
    const reason = (payload.reason ?? 'cold_start') as SnapshotRefreshReason;
    this.enqueue(payload.key, reason);
  }

  private priorityForReason(reason: SnapshotRefreshReason): number {
    switch (reason) {
      case 'cold_start':
        return 100;
      case 'stale_swr':
        return 80;
      case 'manual':
        return 60;
      case 'price_webhook':
        return 95;
      case 'price_delta':
        return 55;
      case 'cron':
      default:
        return 40;
    }
  }

  private scheduleDrain(): void {
    if (this.processing) return;
    if (this.drainTimer) return;
    this.drainTimer = setTimeout(() => {
      this.drainTimer = null;
      void this.drainQueue();
    }, 50);
  }

  private async drainQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    const concurrency = this.refreshConcurrency();
    try {
      while (this.queue.length > 0) {
        const batch: SnapshotRefreshJob[] = [];
        while (batch.length < concurrency && this.queue.length > 0) {
          const job = this.queue.shift();
          if (!job) break;
          this.queuedKeys.delete(job.collectionKey);
          batch.push(job);
        }
        await Promise.all(
          batch.map(async (job) => {
            const lockKey = collectionKeyToAdvisoryLockKey(job.collectionKey);
            const lockResult = await this.tryAdvisoryLock(lockKey);
            if (lockResult !== 'acquired') {
              if (lockResult === 'held') {
                this.logger.debug(
                  JSON.stringify({
                    msg: 'snapshot:lock_contention',
                    collectionKey: job.collectionKey,
                    lockKey: formatAdvisoryLockKey(lockKey),
                    attempt: job.attempt,
                    reason: job.reason,
                  }),
                );
                this.scheduleLockRetry(job);
              } else {
                this.logger.warn(
                  JSON.stringify({
                    msg: 'snapshot:lock_db_error',
                    collectionKey: job.collectionKey,
                    lockKey: formatAdvisoryLockKey(lockKey),
                    attempt: job.attempt,
                    reason: job.reason,
                  }),
                );
              }
              return;
            }
            try {
              await this.snapshotService.refreshSnapshot(
                job.collectionKey,
                job.reason,
              );
            } catch (e) {
              this.logger.warn(
                `queue refresh failed key=${job.collectionKey}: ${e instanceof Error ? e.message : String(e)}`,
              );
            } finally {
              await this.releaseAdvisoryLock(lockKey);
            }
          }),
        );
        if (this.queue.length > 0) {
          await new Promise((r) => setTimeout(r, 200));
        }
      }
    } finally {
      this.processing = false;
      if (this.queue.length > 0) this.scheduleDrain();
    }
  }

  private async tryAdvisoryLock(
    lockKey: SnapshotAdvisoryLockKey,
  ): Promise<LockResult> {
    try {
      const rows = await this.dataSource.query(
        'SELECT pg_try_advisory_lock($1, $2) AS locked',
        [lockKey.key1, lockKey.key2],
      );
      const locked = rows?.[0]?.locked;
      return locked === true || locked === 't' ? 'acquired' : 'held';
    } catch {
      // Fail-closed: if DB is unreachable, skip this job so other pods don't
      // double-write the same snapshot row. No lock retry on db_error.
      return 'db_error';
    }
  }

  private async releaseAdvisoryLock(
    lockKey: SnapshotAdvisoryLockKey,
  ): Promise<void> {
    try {
      await this.dataSource.query('SELECT pg_advisory_unlock($1, $2)', [
        lockKey.key1,
        lockKey.key2,
      ]);
    } catch {
      /* best-effort */
    }
  }

  private lockRetryMax(): number {
    const raw = Number(
      this.config.get<string>('MARKET_SNAPSHOT_LOCK_RETRY_MAX') ?? '3',
    );
    return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 3;
  }

  private lockRetryBaseMs(): number {
    const raw = Number(
      this.config.get<string>('MARKET_SNAPSHOT_LOCK_RETRY_BASE_MS') ?? '500',
    );
    return Number.isFinite(raw) && raw >= 50 ? Math.floor(raw) : 500;
  }

  private lockRetryJitterMs(): number {
    const raw = Number(
      this.config.get<string>('MARKET_SNAPSHOT_LOCK_RETRY_JITTER_MS') ?? '300',
    );
    return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 300;
  }

  private lockRetryMaxDelayMs(): number {
    const raw = Number(
      this.config.get<string>('MARKET_SNAPSHOT_LOCK_RETRY_MAX_DELAY_MS') ??
        '10000',
    );
    return Number.isFinite(raw) && raw >= 100 ? Math.floor(raw) : 10_000;
  }

  /** Exponential backoff with jitter, capped at MARKET_SNAPSHOT_LOCK_RETRY_MAX_DELAY_MS. */
  private lockRetryDelayMs(attempt: number): number {
    const base = this.lockRetryBaseMs();
    const jitter = Math.random() * this.lockRetryJitterMs();
    const delay = base * Math.pow(2, attempt) + jitter;
    return Math.min(Math.floor(delay), this.lockRetryMaxDelayMs());
  }

  /**
   * Re-enqueue a job after lock contention with bounded exponential backoff.
   * At most one pending retry timer per collection key.
   */
  private scheduleLockRetry(job: SnapshotRefreshJob): void {
    const maxRetries = this.lockRetryMax();
    const lockKey = collectionKeyToAdvisoryLockKey(job.collectionKey);

    if (job.attempt >= maxRetries) {
      this.logger.warn(
        JSON.stringify({
          msg: 'snapshot:lock_retry_exhausted',
          collectionKey: job.collectionKey,
          lockKey: formatAdvisoryLockKey(lockKey),
          attempt: job.attempt,
          maxRetries,
          reason: job.reason,
        }),
      );
      return;
    }

    if (this.pendingLockRetries.has(job.collectionKey)) return;
    if (this.queuedKeys.has(job.collectionKey)) return;

    const delayMs = this.lockRetryDelayMs(job.attempt);
    this.pendingLockRetries.add(job.collectionKey);

    this.logger.log(
      JSON.stringify({
        msg: 'snapshot:lock_retry',
        collectionKey: job.collectionKey,
        lockKey: formatAdvisoryLockKey(lockKey),
        attempt: job.attempt,
        nextAttempt: job.attempt + 1,
        delayMs,
        reason: job.reason,
      }),
    );

    const timer = setTimeout(() => {
      this.lockRetryTimers.delete(job.collectionKey);
      this.pendingLockRetries.delete(job.collectionKey);

      if (this.queuedKeys.has(job.collectionKey)) return;
      if (this.pendingLockRetries.has(job.collectionKey)) return;

      this.queue.push({
        ...job,
        attempt: job.attempt + 1,
        enqueuedAt: Date.now(),
      });
      this.queuedKeys.add(job.collectionKey);
      this.queue.sort(
        (a, b) => b.priority - a.priority || a.enqueuedAt - b.enqueuedAt,
      );
      this.scheduleDrain();
    }, delayMs);

    this.lockRetryTimers.set(job.collectionKey, timer);
  }

  @Cron('0 */15 * * * *')
  async handleCronTick(): Promise<void> {
    if (!this.cronEnabled()) return;
    await this.runScheduledRefresh('cron');
  }

  /** 09:00 KST daily full refresh for known portfolio collections. */
  @Cron('0 0 9 * * *', { timeZone: 'Asia/Seoul' })
  async handleDailyPortfolioPrewarm(): Promise<void> {
    if (!this.cronEnabled()) return;
    const rows = await this.rwaTokenRepo
      .createQueryBuilder('t')
      .select('DISTINCT t.collection_key', 'collectionKey')
      .where('t.collection_key IS NOT NULL')
      .getRawMany<{ collectionKey: string }>();
    let count = 0;
    for (const r of rows) {
      const key = r.collectionKey?.trim().toLowerCase();
      if (!key) continue;
      this.enqueue(key, 'cron');
      count++;
    }
    this.logger.log(
      JSON.stringify({
        msg: 'market_snapshot_daily_portfolio_prewarm',
        timezone: 'KST',
        enqueued: count,
      }),
    );
  }

  private async runScheduledRefresh(trigger: string): Promise<void> {
    const keys = await this.discoverRefreshCandidates();
    const { effectiveKeys, nullRatio } = await this.applyNullIdBatchReduction(
      keys,
      trigger,
    );
    for (const key of effectiveKeys) {
      this.enqueue(key, 'cron');
    }

    // ── Degradation profile: single structured log per cron tick ──────────
    const metricsSnap = this.metrics?.getSnapshot();
    const resolveTotal = metricsSnap?.resolveTotal ?? 0;
    const fallbackSearchCount = metricsSnap?.resolvePaths.search ?? 0;
    const fallbackSearchRate =
      resolveTotal > 0 ? fallbackSearchCount / resolveTotal : null;

    this.logger.log(
      JSON.stringify({
        msg: 'market_snapshot_refresh_scheduled',
        trigger,
        candidateCount: keys.length,
        effectiveCount: effectiveKeys.length,
        queueDepth: this.queue.length,
        // Degradation profile fields
        circuitState: metricsSnap?.circuitState ?? 'UNKNOWN',
        circuitOpenDurationMs: metricsSnap?.circuitOpenDurationMs ?? 0,
        nullIdRatio: nullRatio != null ? Number(nullRatio.toFixed(2)) : null,
        fallbackSearchRate:
          fallbackSearchRate != null
            ? Number(fallbackSearchRate.toFixed(2))
            : null,
        searchDepthAvg:
          metricsSnap?.searchDepthAvg != null
            ? Number(metricsSnap.searchDepthAvg.toFixed(2))
            : null,
        batchReductionCount: metricsSnap?.batchReductionCount ?? 0,
      }),
    );

    // Push scheduler state into the global metrics service so that the admin
    // health endpoint can read it without injecting this service directly
    // (direct injection requires importing MarketplaceSnapshotsModule from admin
    // modules, which creates unresolvable circular module contexts).
    this.metrics?.recordSchedulerState({
      queueDepth: this.queue.length,
      queuedKeyCount: this.queuedKeys.size,
      processing: this.processing,
      lastNullIdRatio: nullRatio,
      cronEnabled: this.cronEnabled(),
      refreshConcurrency: this.refreshConcurrency(),
    });
  }

  /**
   * Cold-start protection: if the fraction of candidate snapshots with a null
   * `cardhedger_card_id` exceeds `MARKET_SNAPSHOT_NULL_ID_RATIO_THRESHOLD`
   * (default 0.5), the batch is trimmed to limit search amplification.
   *
   * Shadow mode (`MARKET_SNAPSHOT_COLD_START_SHADOW_MODE`):
   *   - When true: compute and log the reduction but DO NOT apply it.
   *   - Default: true in non-production, false in production.
   *   This allows observing thresholds in staging before enabling in production.
   *
   * DB-only read. Fails open — on DB error the full batch proceeds.
   */
  private async applyNullIdBatchReduction(
    keys: string[],
    trigger: string,
  ): Promise<{ effectiveKeys: string[]; nullRatio: number | null }> {
    if (keys.length === 0) return { effectiveKeys: keys, nullRatio: null };
    const threshold = this.nullIdRatioThreshold();
    if (threshold <= 0) return { effectiveKeys: keys, nullRatio: null };

    try {
      const row = await this.snapshotRepo
        .createQueryBuilder('s')
        .select('COUNT(*)', 'total')
        .addSelect(
          'COUNT(*) FILTER (WHERE s.cardhedger_card_id IS NULL)',
          'null_count',
        )
        .where('s.collection_key IN (:...keys)', { keys })
        .getRawOne<{ total: string; null_count: string }>();

      if (!row) return { effectiveKeys: keys, nullRatio: null };
      const total = Number(row.total) || 0;
      if (total === 0) return { effectiveKeys: keys, nullRatio: null };

      const nullRatio = (Number(row.null_count) || 0) / total;
      this.lastNullIdRatio = nullRatio; // record for health surface
      if (nullRatio <= threshold) return { effectiveKeys: keys, nullRatio };

      const factor = this.nullIdBatchReductionFactor();
      const reducedCount = Math.max(1, Math.ceil(keys.length * factor));
      const shadow = this.coldStartShadowMode();

      this.logger.warn(
        JSON.stringify({
          msg: 'market_snapshot_cold_start_batch_reduced',
          trigger,
          shadowMode: shadow,
          nullRatio: nullRatio.toFixed(2),
          threshold,
          originalCount: keys.length,
          reducedCount,
        }),
      );

      if (shadow) {
        // Observe-only: report what would have been reduced, but serve the full batch.
        return { effectiveKeys: keys, nullRatio };
      }

      this.metrics?.recordBatchReduction(keys.length, reducedCount, false);
      return { effectiveKeys: keys.slice(0, reducedCount), nullRatio };
    } catch (e) {
      // Best-effort — DB error during ratio check does not block snapshot refresh.
      this.logger.warn(
        `cold_start_batch_check failed (proceeding with full batch): ${String(e)}`,
      );
      return { effectiveKeys: keys, nullRatio: null };
    }
  }

  /**
   * Shadow mode: when true, batch reduction is computed and logged but NOT applied.
   * Allows threshold calibration before enabling enforcement.
   *
   * Default: ON in non-production, OFF in production.
   * Config key: MARKET_SNAPSHOT_COLD_START_SHADOW_MODE (1/true or 0/false to override)
   */
  private coldStartShadowMode(): boolean {
    const raw = this.config.get<string>('MARKET_SNAPSHOT_COLD_START_SHADOW_MODE');
    if (raw === '1' || raw === 'true') return true;
    if (raw === '0' || raw === 'false') return false;
    return this.config.get<string>('NODE_ENV') !== 'production';
  }

  /**
   * Null-ID ratio above which the scheduled batch is reduced.
   * 0 disables the feature; default 0.5 (50 %).
   * Config key: MARKET_SNAPSHOT_NULL_ID_RATIO_THRESHOLD
   */
  private nullIdRatioThreshold(): number {
    const raw = Number(
      this.config.get<string>('MARKET_SNAPSHOT_NULL_ID_RATIO_THRESHOLD') ?? '0.5',
    );
    return Number.isFinite(raw) && raw >= 0 && raw <= 1 ? raw : 0.5;
  }

  /**
   * Fraction of original batch to keep when the null-ID ratio threshold is breached.
   * Default 0.5 (50 %); clamped to (0, 1).
   * Config key: MARKET_SNAPSHOT_NULL_ID_REDUCTION_FACTOR
   */
  private nullIdBatchReductionFactor(): number {
    const raw = Number(
      this.config.get<string>('MARKET_SNAPSHOT_NULL_ID_REDUCTION_FACTOR') ?? '0.5',
    );
    return Number.isFinite(raw) && raw > 0 && raw < 1 ? raw : 0.5;
  }

  /**
   * Returns a point-in-time read-only view of scheduler health for the admin surface.
   * No business logic — reads in-memory state only.
   */
  getSchedulerHealth(): {
    queueDepth: number;
    queuedKeyCount: number;
    processing: boolean;
    lastNullIdRatio: number | null;
    batchReductionCount: number;
    cronEnabled: boolean;
    refreshConcurrency: number;
  } {
    return {
      queueDepth: this.queue.length,
      queuedKeyCount: this.queuedKeys.size,
      processing: this.processing,
      lastNullIdRatio: this.lastNullIdRatio,
      batchReductionCount: this.metrics?.getSnapshot().batchReductionCount ?? 0,
      cronEnabled: this.cronEnabled(),
      refreshConcurrency: this.refreshConcurrency(),
    };
  }

  /**
   * Active listings, recent fills, recently viewed, and stale/missing snapshots.
   * Skips collections with no marketplace activity signals.
   */
  async discoverRefreshCandidates(): Promise<string[]> {
    const keys = new Set<string>();
    const fillSince = new Date(
      Date.now() - this.recentFillDays() * 86_400_000,
    );
    const viewedSince = new Date(
      Date.now() - this.viewedLookbackDays() * 86_400_000,
    );

    const activeRows = await this.orderRepo
      .createQueryBuilder('o')
      .select('DISTINCT o.collection_key', 'collectionKey')
      .where('o.collection_key IS NOT NULL')
      .andWhere('o.side = :side', { side: OrderSide.ASK })
      .andWhere('o.status = :status', { status: OrderStatus.ACTIVE })
      .getRawMany<{ collectionKey: string }>();
    for (const r of activeRows) {
      if (r.collectionKey) keys.add(r.collectionKey.toLowerCase());
    }

    const recentFills = await this.orderRepo
      .createQueryBuilder('o')
      .select('DISTINCT o.collection_key', 'collectionKey')
      .where('o.collection_key IS NOT NULL')
      .andWhere('o.status = :status', { status: OrderStatus.FULFILLED })
      .andWhere('o.updated_at >= :since', { since: fillSince })
      .getRawMany<{ collectionKey: string }>();
    for (const r of recentFills) {
      if (r.collectionKey) keys.add(r.collectionKey.toLowerCase());
    }

    const viewed = await this.snapshotRepo
      .createQueryBuilder('s')
      .select('s.collection_key', 'collectionKey')
      .where('s.last_viewed_at >= :since', { since: viewedSince })
      .getRawMany<{ collectionKey: string }>();
    for (const r of viewed) {
      if (r.collectionKey) keys.add(r.collectionKey.toLowerCase());
    }

    const staleOrMissing = await this.snapshotRepo
      .createQueryBuilder('s')
      .select('s.collection_key', 'collectionKey')
      .where('s.synced_at IS NULL')
      .orWhere('s.stale_after IS NULL')
      .orWhere('s.stale_after <= :now', { now: new Date() })
      .getRawMany<{ collectionKey: string }>();
    for (const r of staleOrMissing) {
      if (r.collectionKey) keys.add(r.collectionKey.toLowerCase());
    }

    const maxBatch = Math.max(
      10,
      Number(this.config.get<string>('MARKET_SNAPSHOT_CRON_MAX_KEYS') ?? '120') ||
        120,
    );
    return [...keys].slice(0, maxBatch);
  }
}
