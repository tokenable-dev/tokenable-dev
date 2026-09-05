import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  cardhedgerUpstreamEndpointSlug,
  normalizeCardhedgerUpstreamPath,
  type CardhedgerUpstreamOperation,
} from './cardhedger-upstream.util';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ResolvePath =
  | 'card_details'
  | 'details_by_certs'
  | 'spec_id'
  | 'search'
  | 'card_match'
  /** Phase 6 — card-match tried before card-search when CARDHEDGER_CARD_MATCH_FIRST=1. */
  | 'card_match_first'
  | 'none'
  | 'circuit_open';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export type IdentityCacheLayer = 'l1' | 'l2';

/** Result of a sampled cache-vs-DB drift check on {@link readOrResolve}. */
export type IdentityCacheDriftKind =
  | 'match'
  | 'cache_stale'
  | 'cache_ahead'
  | 'cache_phantom';

/** Post-commit write-through hint application outcome. */
export type IdentityWriteHintOutcome =
  | 'skipped_no_hint'
  | 'unchanged'
  | 'applied'
  | 'evict';

/** Layered cache write outcome after an identity cache mutation. */
export type IdentityCacheWriteOutcome =
  | 'l2_l1'
  | 'l1_only'
  | 'l2_failed_skip_l1';

export type IdentityRedisOp = 'get' | 'set' | 'exists' | 'delete';

export type IdentityRedisFailureReason =
  | 'timeout'
  | 'command_error'
  | 'not_connected';

/** Audit conditional clear result bucket. */
export type IdentityAuditClearOutcome =
  | 'cleared'
  | 'skipped_id_changed'
  | 'skipped_not_found'
  | 'skipped_empty_expected';

/** Read-path self-healing cache repair action (P3.5). */
export type IdentityCacheRepairOutcome =
  | 'set'
  | 'evict'
  | 'skipped_cooldown';

/** Proactive reconciliation per-key outcome (P3.6). */
export type IdentityReconciliationOutcome =
  | 'hit'
  | 'miss'
  | 'repair'
  | 'skipped';

export interface IdentityCacheHealth {
  mode: 'local' | 'layered';
  redisConnected: boolean;
}

interface MetricsBucket {
  startedAt: number;
  resolvePaths: Record<ResolvePath, number>;
  /** Sum of search candidate depths (1-based) across all search-path resolves. */
  searchDepthTotal: number;
  /** Number of search-path resolves that reached a decision (for averaging). */
  searchDepthCount: number;
  /** Sum of original batch sizes where a reduction was applied. */
  batchOriginalTotal: number;
  /** Sum of reduced batch sizes applied. */
  batchReducedTotal: number;
  /** Number of cron ticks where a non-shadow reduction was applied. */
  batchReductionCount: number;
  /** Phase 6 — Path-2 (search/match) pilot: attempts when match-first flag on/off. */
  resolvePath2Pilot: {
    matchFirstOn: ResolvePath2PilotBucket;
    matchFirstOff: ResolvePath2PilotBucket;
  };
  /** Cumulative ms the circuit was in OPEN state within this window. */
  circuitOpenDurationMs: number;
  identityCacheHits: Record<IdentityCacheLayer, number>;
  identityCacheMisses: Record<IdentityCacheLayer, number>;
  identityCacheDriftChecks: number;
  identityCacheDrift: Record<IdentityCacheDriftKind, number>;
  identityWriteHint: Record<IdentityWriteHintOutcome, number>;
  identityCacheWrite: Record<IdentityCacheWriteOutcome, number>;
  identityRedisFailure: Record<
    IdentityRedisOp,
    Record<IdentityRedisFailureReason, number>
  >;
  identityAuditClear: Record<IdentityAuditClearOutcome, number>;
  identityCacheRepair: Record<IdentityCacheRepairOutcome, number>;
  identityReconciliation: Record<IdentityReconciliationOutcome, number>;
  identityLogInvalid: number;
  upstreamByEndpoint: Record<string, UpstreamEndpointCounts>;
  upstreamByOperation: Record<string, number>;
}

export interface IdentityReconciliationMetricsState {
  hotKeyCount: number;
  scanned: number;
  coverageRatio: number;
}

/** P3.16 — last identity cache SLO evaluation (SSOT for health + Prometheus). */
export interface IdentitySloMetricsSnapshot {
  healthScore: number;
  mode: 'normal' | 'throttle' | 'protect';
  driftRate: number;
  redisFailureRate: number;
  reconcileSkipRate: number;
  reasons: string[];
  /** ISO-8601 UTC when this snapshot was recorded. */
  evaluatedAt: string;
}

/**
 * Public snapshot returned by `getSnapshot()`.
 * Used to build the per-cron degradation profile log in the snapshot scheduler.
 */
export type UpstreamCallOutcome = 'success' | 'error';

export interface UpstreamEndpointCounts {
  success: number;
  error: number;
  durationMsTotal: number;
}

interface ResolvePath2PilotBucket {
  attempts: number;
  success: number;
  latencyMsTotal: number;
}

export interface ResolvePath2PilotSnapshot {
  attempts: number;
  success: number;
  successRate: number | null;
  avgLatencyMs: number | null;
}

export interface CardhedgerUpstreamMetricsSnapshot {
  total: number;
  success: number;
  errors: number;
  /** Mean upstream latency (ms) across recorded calls, or null when no calls. */
  avgDurationMs: number | null;
  /** Keyed by short endpoint slug (e.g. `card-fmv`, `details-by-certs`). */
  byEndpoint: Record<string, UpstreamEndpointCounts>;
  /** Optional operation tags when callers pass `metricsOperation` to forwardJson. */
  byOperation: Record<string, number>;
}

export interface CardhedgerMetricsSnapshot {
  circuitState: CircuitState;
  resolveTotal: number;
  resolvePaths: Record<ResolvePath, number>;
  /** Average number of search candidates evaluated per successful search-path resolve, or null if no search resolves. */
  searchDepthAvg: number | null;
  /** Phase 6 — Path-2 latency/success when CARDHEDGER_CARD_MATCH_FIRST on vs off. */
  resolvePath2Pilot: {
    matchFirstOn: ResolvePath2PilotSnapshot;
    matchFirstOff: ResolvePath2PilotSnapshot;
  };
  batchReductionCount: number;
  /** Average reduced/original ratio across actual (non-shadow) reductions, or null if none. */
  batchReductionRatioAvg: number | null;
  /** Cumulative ms circuit was OPEN in the current window (includes ongoing open period). */
  circuitOpenDurationMs: number;
  upstream: CardhedgerUpstreamMetricsSnapshot;
  windowStartedAt: number;
}

/**
 * Lightweight in-process metrics aggregator for Cardhedger integration.
 *
 * No external systems required — emits structured log lines every 60 s
 * (or on demand via `getSnapshot()`). Data resets on each flush window.
 *
 * Registered as a `@Global()` provider so all feature modules can inject
 * it without explicit module imports.
 *
 * P2 note: replace with Prometheus / OpenTelemetry counter exports when
 * an observability stack is available — the `record*` call sites are the
 * only integration points.
 */
@Injectable()
export class CardhedgerMetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CardhedgerMetricsService.name);

  private current: MetricsBucket = this.freshBucket();
  private flushTimer: NodeJS.Timeout | null = null;
  private currentCircuitState: CircuitState = 'CLOSED';
  private circuitOpenSince: number | null = null;
  private schedulerState: {
    queueDepth: number;
    queuedKeyCount: number;
    processing: boolean;
    lastNullIdRatio: number | null;
    cronEnabled: boolean;
    refreshConcurrency: number;
    recordedAt: number;
  } | null = null;
  private identityCacheHealth: IdentityCacheHealth = {
    mode: 'local',
    redisConnected: false,
  };

  private identityReconciliationState: IdentityReconciliationMetricsState | null =
    null;
  private identitySloState: IdentitySloMetricsSnapshot | null = null;

  // Flush interval in milliseconds — per-minute summary log.
  private static readonly FLUSH_INTERVAL_MS = 60_000;

  onModuleInit(): void {
    this.flushTimer = setInterval(
      () => this.flush(),
      CardhedgerMetricsService.FLUSH_INTERVAL_MS,
    );
  }

  onModuleDestroy(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
  }

  // ─── Record calls (called by CardhedgerService, ResolveService, Scheduler) ──

  /**
   * Record the resolution path taken by `resolveCardForCollectionUncached`.
   * @param path   Which branch resolved (or failed) the card
   * @param depth  Number of search candidates evaluated — only meaningful when path='search'
   */
  recordResolvePath(path: ResolvePath, depth?: number): void {
    this.current.resolvePaths[path]++;
    if (path === 'search' && depth != null && depth >= 1) {
      this.current.searchDepthTotal += depth;
      this.current.searchDepthCount++;
    }
  }

  /**
   * Phase 6 — record Path-2 outcome (card-match-first vs search) for A/B pilot.
   * Only collections that reach Path 2 after cert/card-details paths are counted.
   */
  recordResolvePath2Pilot(input: {
    cardMatchFirstEnabled: boolean;
    durationMs: number;
    success: boolean;
  }): void {
    const bucket = input.cardMatchFirstEnabled
      ? this.current.resolvePath2Pilot.matchFirstOn
      : this.current.resolvePath2Pilot.matchFirstOff;
    bucket.attempts++;
    if (input.success) bucket.success++;
    bucket.latencyMsTotal += Math.max(0, Math.floor(input.durationMs));
  }

  /**
   * Notify the metrics service of a circuit state transition.
   * Called by `CardhedgerService` whenever the circuit changes state.
   */
  recordCircuitStateChange(next: CircuitState): void {
    const prev = this.currentCircuitState;
    this.currentCircuitState = next;

    if (prev !== 'OPEN' && next === 'OPEN') {
      // Circuit just opened — start measuring open duration.
      this.circuitOpenSince = Date.now();
    } else if (prev === 'OPEN' && next !== 'OPEN' && this.circuitOpenSince != null) {
      // Circuit just closed / went HALF_OPEN — accumulate open duration.
      this.current.circuitOpenDurationMs += Date.now() - this.circuitOpenSince;
      this.circuitOpenSince = null;
    }
  }

  /**
   * Record a cold-start batch reduction event.
   * Shadow-mode events are logged by the scheduler but NOT counted here as actual
   * reductions (they don't affect runtime, so inflating the ratio would mislead tuning).
   */
  recordBatchReduction(
    originalCount: number,
    reducedCount: number,
    shadowMode: boolean,
  ): void {
    if (shadowMode) return;
    this.current.batchOriginalTotal += originalCount;
    this.current.batchReducedTotal += reducedCount;
    this.current.batchReductionCount++;
  }

  /**
   * Called by the snapshot scheduler to push its current runtime state into
   * the metrics service. This allows health/admin surfaces to read scheduler
   * state without injecting the scheduler directly (which would require importing
   * MarketplaceSnapshotsModule and creates circular module context issues).
   */
  recordSchedulerState(state: {
    queueDepth: number;
    queuedKeyCount: number;
    processing: boolean;
    lastNullIdRatio: number | null;
    cronEnabled: boolean;
    refreshConcurrency: number;
  }): void {
    this.schedulerState = { ...state, recordedAt: Date.now() };
  }

  getSchedulerState(): (typeof this.schedulerState) {
    return this.schedulerState;
  }

  recordIdentityCacheHit(layer: IdentityCacheLayer): void {
    this.current.identityCacheHits[layer]++;
  }

  recordIdentityCacheMiss(layer: IdentityCacheLayer): void {
    this.current.identityCacheMisses[layer]++;
  }

  recordIdentityCacheHealth(health: IdentityCacheHealth): void {
    this.identityCacheHealth = { ...health };
  }

  getIdentityCacheHealth(): IdentityCacheHealth {
    return { ...this.identityCacheHealth };
  }

  getIdentityCacheMetrics(): {
    hits: Record<IdentityCacheLayer, number>;
    misses: Record<IdentityCacheLayer, number>;
  } {
    return {
      hits: { ...this.current.identityCacheHits },
      misses: { ...this.current.identityCacheMisses },
    };
  }

  recordIdentityCacheDrift(kind: IdentityCacheDriftKind): void {
    this.current.identityCacheDriftChecks++;
    this.current.identityCacheDrift[kind]++;
  }

  recordIdentityWriteHint(outcome: IdentityWriteHintOutcome): void {
    this.current.identityWriteHint[outcome]++;
  }

  recordIdentityCacheWrite(outcome: IdentityCacheWriteOutcome): void {
    this.current.identityCacheWrite[outcome]++;
  }

  recordIdentityRedisFailure(
    op: IdentityRedisOp,
    reason: IdentityRedisFailureReason,
  ): void {
    this.current.identityRedisFailure[op][reason]++;
  }

  recordIdentityAuditClear(outcome: IdentityAuditClearOutcome): void {
    this.current.identityAuditClear[outcome]++;
  }

  recordIdentityCacheRepair(outcome: IdentityCacheRepairOutcome): void {
    this.current.identityCacheRepair[outcome]++;
  }

  recordIdentityReconciliation(outcome: IdentityReconciliationOutcome): void {
    this.current.identityReconciliation[outcome]++;
  }

  recordIdentityLogInvalid(): void {
    this.current.identityLogInvalid++;
  }

  /**
   * Record one Cardhedger upstream HTTP call (from {@link CardhedgerService.forwardJson}
   * / `forwardBinary`). Endpoint is normalized; operation is optional.
   */
  recordUpstreamCall(input: {
    upstreamPath: string;
    method: 'GET' | 'POST';
    outcome: UpstreamCallOutcome;
    durationMs: number;
    operation?: CardhedgerUpstreamOperation;
  }): void {
    const normalized = normalizeCardhedgerUpstreamPath(input.upstreamPath);
    const slug = cardhedgerUpstreamEndpointSlug(normalized);
    const bucket =
      this.current.upstreamByEndpoint[slug] ??
      ({ success: 0, error: 0, durationMsTotal: 0 } satisfies UpstreamEndpointCounts);
    if (input.outcome === 'success') {
      bucket.success++;
    } else {
      bucket.error++;
    }
    bucket.durationMsTotal += Math.max(0, Math.floor(input.durationMs));
    this.current.upstreamByEndpoint[slug] = bucket;

    if (input.operation) {
      const opKey = input.operation;
      this.current.upstreamByOperation[opKey] =
        (this.current.upstreamByOperation[opKey] ?? 0) + 1;
    }
  }

  getUpstreamMetrics(): CardhedgerUpstreamMetricsSnapshot {
    return this.buildUpstreamSnapshot(this.current);
  }

  recordIdentityReconciliationRun(summary: {
    hotKeyCount: number;
    scanned: number;
    coverageRatio: number;
    hit: number;
    miss: number;
    repair: number;
    skipped: number;
  }): void {
    this.identityReconciliationState = {
      hotKeyCount: summary.hotKeyCount,
      scanned: summary.scanned,
      coverageRatio: summary.coverageRatio,
    };
  }

  getIdentityReconciliationState(): IdentityReconciliationMetricsState | null {
    return this.identityReconciliationState
      ? { ...this.identityReconciliationState }
      : null;
  }

  recordIdentitySloEvaluation(
    snapshot: Omit<IdentitySloMetricsSnapshot, 'evaluatedAt'> &
      Partial<Pick<IdentitySloMetricsSnapshot, 'evaluatedAt'>>,
  ): void {
    this.identitySloState = {
      ...snapshot,
      reasons: [...snapshot.reasons],
      evaluatedAt: snapshot.evaluatedAt ?? new Date().toISOString(),
    };
  }

  getIdentitySloEvaluation(): IdentitySloMetricsSnapshot | null {
    return this.identitySloState
      ? { ...this.identitySloState, reasons: [...this.identitySloState.reasons] }
      : null;
  }

  getIdentityLogInvalidCount(): number {
    return this.current.identityLogInvalid;
  }

  getIdentityObservabilityMetrics(): {
    driftChecks: number;
    drift: Record<IdentityCacheDriftKind, number>;
    writeHint: Record<IdentityWriteHintOutcome, number>;
    cacheWrite: Record<IdentityCacheWriteOutcome, number>;
    redisFailure: Record<
      IdentityRedisOp,
      Record<IdentityRedisFailureReason, number>
    >;
    auditClear: Record<IdentityAuditClearOutcome, number>;
    cacheRepair: Record<IdentityCacheRepairOutcome, number>;
    reconciliation: Record<IdentityReconciliationOutcome, number>;
  } {
    return {
      driftChecks: this.current.identityCacheDriftChecks,
      drift: { ...this.current.identityCacheDrift },
      writeHint: { ...this.current.identityWriteHint },
      cacheWrite: { ...this.current.identityCacheWrite },
      redisFailure: {
        get: { ...this.current.identityRedisFailure.get },
        set: { ...this.current.identityRedisFailure.set },
        exists: { ...this.current.identityRedisFailure.exists },
        delete: { ...this.current.identityRedisFailure.delete },
      },
      auditClear: { ...this.current.identityAuditClear },
      cacheRepair: { ...this.current.identityCacheRepair },
      reconciliation: { ...this.current.identityReconciliation },
    };
  }

  // ─── Snapshot ────────────────────────────────────────────────────────────────

  /**
   * Returns a point-in-time view of the current metrics window.
   * Does NOT reset the window — call from the scheduler for per-run profiles.
   */
  getSnapshot(): CardhedgerMetricsSnapshot {
    const b = this.current;
    const resolveTotal = (Object.values(b.resolvePaths) as number[]).reduce(
      (s, v) => s + v,
      0,
    );

    const searchDepthAvg =
      b.searchDepthCount > 0 ? b.searchDepthTotal / b.searchDepthCount : null;

    const batchReductionRatioAvg =
      b.batchReductionCount > 0 && b.batchOriginalTotal > 0
        ? b.batchReducedTotal / b.batchOriginalTotal
        : null;

    // Add any ongoing circuit-open duration that has not yet been flushed.
    let circuitOpenDurationMs = b.circuitOpenDurationMs;
    if (this.currentCircuitState === 'OPEN' && this.circuitOpenSince != null) {
      circuitOpenDurationMs += Date.now() - this.circuitOpenSince;
    }

    return {
      circuitState: this.currentCircuitState,
      resolveTotal,
      resolvePaths: { ...b.resolvePaths },
      searchDepthAvg,
      resolvePath2Pilot: this.buildResolvePath2PilotSnapshot(b),
      batchReductionCount: b.batchReductionCount,
      batchReductionRatioAvg,
      circuitOpenDurationMs,
      upstream: this.buildUpstreamSnapshot(b),
      windowStartedAt: b.startedAt,
    };
  }

  private buildUpstreamSnapshot(
    b: MetricsBucket,
  ): CardhedgerUpstreamMetricsSnapshot {
    const byEndpoint: Record<string, UpstreamEndpointCounts> = {};
    let success = 0;
    let errors = 0;
    let durationMsTotal = 0;

    for (const [slug, counts] of Object.entries(b.upstreamByEndpoint)) {
      byEndpoint[slug] = { ...counts };
      success += counts.success;
      errors += counts.error;
      durationMsTotal += counts.durationMsTotal;
    }

    const total = success + errors;
    return {
      total,
      success,
      errors,
      avgDurationMs: total > 0 ? durationMsTotal / total : null,
      byEndpoint,
      byOperation: { ...b.upstreamByOperation },
    };
  }

  // ─── Internal flush ──────────────────────────────────────────────────────────

  private flush(): void {
    const snap = this.getSnapshot();
    const idle =
      snap.resolveTotal === 0 &&
      snap.batchReductionCount === 0 &&
      snap.circuitOpenDurationMs === 0 &&
      snap.upstream.total === 0;

    this.current = this.freshBucket();
    this.circuitOpenSince =
      this.currentCircuitState === 'OPEN' ? Date.now() : null;

    if (idle) return;

    const windowSecs = Math.round(
      (Date.now() - snap.windowStartedAt) / 1000,
    );

    this.logger.log(
      JSON.stringify({
        msg: 'cardhedger_metrics_window',
        windowSecs,
        circuitState: snap.circuitState,
        circuitOpenDurationMs: snap.circuitOpenDurationMs,
        resolveTotal: snap.resolveTotal,
        resolvePaths: snap.resolvePaths,
        searchDepthAvg:
          snap.searchDepthAvg != null
            ? Number(snap.searchDepthAvg.toFixed(2))
            : null,
        resolvePath2Pilot: snap.resolvePath2Pilot,
        batchReductionCount: snap.batchReductionCount,
        batchReductionRatioAvg:
          snap.batchReductionRatioAvg != null
            ? Number(snap.batchReductionRatioAvg.toFixed(2))
            : null,
        upstreamTotal: snap.upstream.total,
        upstreamSuccess: snap.upstream.success,
        upstreamErrors: snap.upstream.errors,
        upstreamAvgDurationMs:
          snap.upstream.avgDurationMs != null
            ? Number(snap.upstream.avgDurationMs.toFixed(1))
            : null,
        upstreamByEndpoint: snap.upstream.byEndpoint,
        upstreamByOperation: snap.upstream.byOperation,
      }),
    );
  }

  private freshIdentityDrift(): Record<IdentityCacheDriftKind, number> {
    return {
      match: 0,
      cache_stale: 0,
      cache_ahead: 0,
      cache_phantom: 0,
    };
  }

  private freshIdentityWriteHint(): Record<IdentityWriteHintOutcome, number> {
    return {
      skipped_no_hint: 0,
      unchanged: 0,
      applied: 0,
      evict: 0,
    };
  }

  private freshIdentityCacheWrite(): Record<IdentityCacheWriteOutcome, number> {
    return {
      l2_l1: 0,
      l1_only: 0,
      l2_failed_skip_l1: 0,
    };
  }

  private freshIdentityRedisFailure(): Record<
    IdentityRedisOp,
    Record<IdentityRedisFailureReason, number>
  > {
    const zero = (): Record<IdentityRedisFailureReason, number> => ({
      timeout: 0,
      command_error: 0,
      not_connected: 0,
    });
    return {
      get: zero(),
      set: zero(),
      exists: zero(),
      delete: zero(),
    };
  }

  private freshIdentityAuditClear(): Record<
    IdentityAuditClearOutcome,
    number
  > {
    return {
      cleared: 0,
      skipped_id_changed: 0,
      skipped_not_found: 0,
      skipped_empty_expected: 0,
    };
  }

  private freshIdentityCacheRepair(): Record<
    IdentityCacheRepairOutcome,
    number
  > {
    return { set: 0, evict: 0, skipped_cooldown: 0 };
  }

  private freshIdentityReconciliation(): Record<
    IdentityReconciliationOutcome,
    number
  > {
    return { hit: 0, miss: 0, repair: 0, skipped: 0 };
  }

  private buildResolvePath2PilotSnapshot(
    b: MetricsBucket,
  ): CardhedgerMetricsSnapshot['resolvePath2Pilot'] {
    const toSnap = (bucket: ResolvePath2PilotBucket): ResolvePath2PilotSnapshot => ({
      attempts: bucket.attempts,
      success: bucket.success,
      successRate:
        bucket.attempts > 0 ? bucket.success / bucket.attempts : null,
      avgLatencyMs:
        bucket.attempts > 0 ? bucket.latencyMsTotal / bucket.attempts : null,
    });
    return {
      matchFirstOn: toSnap(b.resolvePath2Pilot.matchFirstOn),
      matchFirstOff: toSnap(b.resolvePath2Pilot.matchFirstOff),
    };
  }

  private freshResolvePath2PilotBucket(): ResolvePath2PilotBucket {
    return { attempts: 0, success: 0, latencyMsTotal: 0 };
  }

  private freshResolvePath2Pilot(): MetricsBucket['resolvePath2Pilot'] {
    return {
      matchFirstOn: this.freshResolvePath2PilotBucket(),
      matchFirstOff: this.freshResolvePath2PilotBucket(),
    };
  }

  private freshBucket(): MetricsBucket {
    return {
      startedAt: Date.now(),
      resolvePaths: {
        card_details: 0,
        details_by_certs: 0,
        spec_id: 0,
        search: 0,
        card_match: 0,
        card_match_first: 0,
        none: 0,
        circuit_open: 0,
      },
      searchDepthTotal: 0,
      searchDepthCount: 0,
      batchOriginalTotal: 0,
      batchReducedTotal: 0,
      batchReductionCount: 0,
      resolvePath2Pilot: this.freshResolvePath2Pilot(),
      circuitOpenDurationMs: 0,
      identityCacheHits: { l1: 0, l2: 0 },
      identityCacheMisses: { l1: 0, l2: 0 },
      identityCacheDriftChecks: 0,
      identityCacheDrift: this.freshIdentityDrift(),
      identityWriteHint: this.freshIdentityWriteHint(),
      identityCacheWrite: this.freshIdentityCacheWrite(),
      identityRedisFailure: this.freshIdentityRedisFailure(),
      identityAuditClear: this.freshIdentityAuditClear(),
      identityCacheRepair: this.freshIdentityCacheRepair(),
      identityReconciliation: this.freshIdentityReconciliation(),
      identityLogInvalid: 0,
      upstreamByEndpoint: {},
      upstreamByOperation: {},
    };
  }
}

export type { CardhedgerUpstreamOperation } from './cardhedger-upstream.util';
