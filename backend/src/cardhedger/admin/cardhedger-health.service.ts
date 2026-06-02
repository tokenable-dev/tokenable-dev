import { Injectable } from '@nestjs/common';
import { CardhedgerMetricsService } from '../../common/metrics/cardhedger-metrics.service';
import { CardhedgerService } from '../cardhedger.service';

// ─── Response shapes ─────────────────────────────────────────────────────────

export interface CircuitHealth {
  /** Current state of the circuit breaker. */
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  /** Consecutive retryable failures since last successful call. */
  consecutiveFailures: number;
  /** Cumulative milliseconds the circuit was OPEN in the current metrics window. */
  openDurationMs: number;
}

export interface ResolveHealth {
  /**
   * Fraction of resolves that fell through to card-search.
   * null if no resolves have occurred in the current metrics window.
   */
  fallbackSearchRate: number | null;
  /**
   * Average number of search candidates evaluated per successful search-path resolve.
   * null if no search-path resolves occurred.
   */
  searchDepthAvg: number | null;
  /** Per-path counts for the current metrics window. */
  pathCounts: {
    card_details: number;
    spec_id: number;
    search: number;
    none: number;
    circuit_open: number;
  };
  /** Total resolve calls in the current metrics window. */
  resolveTotal: number;
}

export interface SchedulerHealth {
  /** Jobs currently in the in-memory queue. */
  queueDepth: number;
  /** Unique collection keys currently queued (deduplicated). */
  queuedKeyCount: number;
  /** Whether the drain loop is actively processing a batch. */
  processing: boolean;
  /** Last observed null-cardhedgerCardId ratio from the batch-reduction check. null before first cron tick. */
  lastNullIdRatio: number | null;
  /** Number of cron ticks where a non-shadow batch reduction was applied (current window). */
  batchReductionCount: number;
  /** Whether the 15-min cron is enabled. */
  cronEnabled: boolean;
  /** Maximum concurrent snapshot refreshes. */
  refreshConcurrency: number;
}

export interface IdentityCacheHealthSurface {
  /** `local` when REDIS_URL is unset; `layered` when L2 Redis is configured. */
  mode: 'local' | 'layered';
  /** Whether the Redis client is currently connected. Always false in local mode. */
  redisConnected: boolean;
}

export interface IdentityObservabilitySurface {
  driftChecks: number;
  drift: {
    match: number;
    cache_stale: number;
    cache_ahead: number;
    cache_phantom: number;
  };
  writeHint: {
    skipped_no_hint: number;
    unchanged: number;
    applied: number;
    evict: number;
  };
  cacheWrite: {
    l2_l1: number;
    l1_only: number;
    l2_failed_skip_l1: number;
  };
  auditClear: {
    cleared: number;
    skipped_id_changed: number;
    skipped_not_found: number;
    skipped_empty_expected: number;
  };
  cacheRepair: {
    set: number;
    evict: number;
    skipped_cooldown: number;
  };
  reconciliation: {
    hit: number;
    miss: number;
    repair: number;
    skipped: number;
  };
  reconciliationState: {
    hotKeyCount: number;
    scanned: number;
    coverageRatio: number;
  } | null;
}

/** P3.18 — identity cache SLO (same snapshot as Prometheus gauges). */
export interface IdentitySloHealthSurface {
  /** 0–100 composite score; -1 when not yet evaluated. */
  healthScore: number;
  mode: 'normal' | 'throttle' | 'protect' | null;
  reasons: string[];
  /** ISO-8601 UTC of last SLO evaluation recorded to metrics. */
  evaluatedAt: string | null;
}

export interface CardhedgerHealthPayload {
  circuit: CircuitHealth;
  resolve: ResolveHealth;
  scheduler: SchedulerHealth;
  identityCache: IdentityCacheHealthSurface;
  identityObservability: IdentityObservabilitySurface;
  identitySlo: IdentitySloHealthSurface;
  /** ISO-8601 UTC timestamp of when this snapshot was taken. */
  timestamp: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Aggregates read-only operational health data from:
 *   - CardhedgerService        (circuit breaker state)
 *   - CardhedgerMetricsService (resolve paths, scheduler state, identity cache)
 *
 * Scheduler and identity cache state are read from `CardhedgerMetricsService`
 * (push-based) to avoid importing marketplace modules from the admin layer.
 *
 * No business logic, no writes, no side effects.
 */
@Injectable()
export class CardhedgerHealthService {
  constructor(
    private readonly cardhedger: CardhedgerService,
    private readonly metrics: CardhedgerMetricsService,
  ) {}

  getFullHealth(): CardhedgerHealthPayload {
    return {
      circuit: this.getCircuitHealth(),
      resolve: this.getResolveHealth(),
      scheduler: this.getSchedulerHealth(),
      identityCache: this.getIdentityCacheHealth(),
      identityObservability: this.getIdentityObservability(),
      identitySlo: this.getIdentitySloHealth(),
      timestamp: new Date().toISOString(),
    };
  }

  getCircuitHealth(): CircuitHealth {
    const cb = this.cardhedger.getCircuitState();
    const snap = this.metrics.getSnapshot();
    return {
      state: cb.state as CircuitHealth['state'],
      consecutiveFailures: cb.consecutiveFailures,
      openDurationMs: snap.circuitOpenDurationMs,
    };
  }

  getResolveHealth(): ResolveHealth {
    const snap = this.metrics.getSnapshot();
    const { resolveTotal, resolvePaths, searchDepthAvg } = snap;

    // fallbackSearchRate excludes circuit_open events (those aren't real resolves)
    const effectiveTotal = resolveTotal - (resolvePaths.circuit_open ?? 0);
    const fallbackSearchRate =
      effectiveTotal > 0 ? resolvePaths.search / effectiveTotal : null;

    return {
      fallbackSearchRate,
      searchDepthAvg,
      pathCounts: {
        card_details: resolvePaths.card_details,
        spec_id: resolvePaths.spec_id,
        search: resolvePaths.search,
        none: resolvePaths.none,
        circuit_open: resolvePaths.circuit_open,
      },
      resolveTotal,
    };
  }

  getSchedulerHealth(): SchedulerHealth {
    const state = this.metrics.getSchedulerState();
    const snap = this.metrics.getSnapshot();
    if (!state) {
      // Scheduler has not yet recorded any state (no cron tick since boot).
      return {
        queueDepth: 0,
        queuedKeyCount: 0,
        processing: false,
        lastNullIdRatio: null,
        batchReductionCount: snap.batchReductionCount,
        cronEnabled: false,
        refreshConcurrency: 0,
      };
    }
    return {
      queueDepth: state.queueDepth,
      queuedKeyCount: state.queuedKeyCount,
      processing: state.processing,
      lastNullIdRatio: state.lastNullIdRatio,
      batchReductionCount: snap.batchReductionCount,
      cronEnabled: state.cronEnabled,
      refreshConcurrency: state.refreshConcurrency,
    };
  }

  getIdentityCacheHealth(): IdentityCacheHealthSurface {
    return this.metrics.getIdentityCacheHealth();
  }

  getIdentitySloHealth(): IdentitySloHealthSurface {
    const slo = this.metrics.getIdentitySloEvaluation();
    if (!slo) {
      return {
        healthScore: -1,
        mode: null,
        reasons: ['not_yet_evaluated'],
        evaluatedAt: null,
      };
    }
    return {
      healthScore: slo.healthScore,
      mode: slo.mode,
      reasons: slo.reasons,
      evaluatedAt: slo.evaluatedAt,
    };
  }

  getIdentityObservability(): IdentityObservabilitySurface {
    const o = this.metrics.getIdentityObservabilityMetrics();
    return {
      driftChecks: o.driftChecks,
      drift: o.drift,
      writeHint: o.writeHint,
      cacheWrite: o.cacheWrite,
      auditClear: o.auditClear,
      cacheRepair: o.cacheRepair,
      reconciliation: o.reconciliation,
      reconciliationState: this.metrics.getIdentityReconciliationState(),
    };
  }
}
