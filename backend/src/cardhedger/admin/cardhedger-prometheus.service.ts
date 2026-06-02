import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Gauge, Registry } from 'prom-client';
import { CardhedgerMetricsService } from '../../common/metrics/cardhedger-metrics.service';
import { CardhedgerService } from '../cardhedger.service';

/**
 * Numeric mapping for `cardhedger_circuit_state`.
 * CLOSED=0 is the healthy steady state — dashboards can alert on values > 0.
 */
const CIRCUIT_STATE_VALUES = {
  CLOSED: 0,
  HALF_OPEN: 1,
  OPEN: 2,
} as const;

/**
 * Exposes Cardhedger operational metrics in Prometheus text exposition format.
 *
 * Uses a dedicated `Registry` (not the prom-client global registry) so this
 * module's metrics are isolated from any future default Node.js metrics export.
 *
 * All metrics are **pull-based**: gauge values are collected fresh on every call
 * to `getMetricsText()` via prom-client's `collect()` callback hook — no
 * background timers or duplicate state.
 *
 * Metric sources:
 *   CardhedgerService                       → circuit state + consecutive failures
 *   CardhedgerMetricsService                → resolve path counts + search depth + circuit open duration
 *   CollectionMarketSnapshotSchedulerService → queue depth + null-ID ratio + batch reduction count
 *
 * ─── Metric catalogue ─────────────────────────────────────────────────────────
 *
 * cardhedger_circuit_state                          Gauge   CLOSED=0 HALF_OPEN=1 OPEN=2
 * cardhedger_circuit_consecutive_failures           Gauge   consecutive retryable failures
 * cardhedger_circuit_open_duration_ms               Gauge   cumulative ms OPEN in current window
 * cardhedger_resolve_total{path}                    Gauge   resolve counts by path (current window)
 * cardhedger_search_depth_avg                       Gauge   avg search candidates tried (window)
 * cardhedger_snapshot_queue_depth                   Gauge   in-memory queue length
 * cardhedger_snapshot_null_id_ratio                 Gauge   last observed null-cardhedgerCardId ratio
 * cardhedger_snapshot_batch_reduction_total         Gauge   non-shadow reductions applied (window)
 * cardhedger_identity_cache_hits_total{layer}         Gauge   identity cache hits by layer (l1/l2, window)
 * cardhedger_identity_cache_misses_total{layer}       Gauge   identity cache misses by layer (l1/l2, window)
 * cardhedger_identity_cache_drift_total{kind}         Gauge   sampled cache-vs-DB drift checks (window)
 * cardhedger_identity_write_hint_total{outcome}       Gauge   post-commit write-through hint outcomes (window)
 * cardhedger_identity_cache_write_total{outcome}      Gauge   layered cache write outcomes (window)
 * cardhedger_identity_redis_failure_total{op,reason}  Gauge   L2 Redis command failures (window)
 * cardhedger_identity_audit_clear_total{outcome}      Gauge   audit conditional clear outcomes (window)
 * cardhedger_identity_cache_repair_total{outcome}     Gauge   read-path cache self-healing repairs (window)
 * cardhedger_identity_reconciliation_total{outcome}   Gauge   proactive reconciliation outcomes (window)
 * cardhedger_identity_reconciliation_hot_keys         Gauge   hot keys tracked at last reconciliation tick
 * cardhedger_identity_reconciliation_coverage_ratio   Gauge   scanned/hotKeys from last reconciliation tick
 */
@Injectable()
export class CardhedgerPrometheusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CardhedgerPrometheusService.name);
  readonly registry = new Registry();

  constructor(
    private readonly cardhedger: CardhedgerService,
    private readonly metrics: CardhedgerMetricsService,
  ) {}

  onModuleInit(): void {
    this.registerMetrics();
    this.logger.log(
      `[prometheus] registered ${Object.keys(this.registry.getSingleMetricAsString).length || 8} metrics in isolated registry`,
    );
  }

  onModuleDestroy(): void {
    this.registry.clear();
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /** Returns the Prometheus text exposition format string. */
  async getMetricsText(): Promise<string> {
    return this.registry.metrics();
  }

  /** Content-Type header value required by the Prometheus exposition format. */
  get contentType(): string {
    return this.registry.contentType;
  }

  // ─── Metric registration ───────────────────────────────────────────────────

  private registerMetrics(): void {
    // Capture service references for use inside collect() closures.
    // (Inside collect(), `this` refers to the Gauge — we need the service refs.)
    const cardhedger = this.cardhedger;
    const metricsService = this.metrics;

    // ── Circuit breaker ──────────────────────────────────────────────────────

    new Gauge({
      name: 'cardhedger_circuit_state',
      help: 'Circuit breaker state: CLOSED=0, HALF_OPEN=1, OPEN=2. Alert when > 0.',
      registers: [this.registry],
      collect() {
        const { state } = cardhedger.getCircuitState();
        this.set(
          CIRCUIT_STATE_VALUES[state as keyof typeof CIRCUIT_STATE_VALUES] ?? 0,
        );
      },
    });

    new Gauge({
      name: 'cardhedger_circuit_consecutive_failures',
      help: 'Consecutive retryable failures (429/5xx/network) since last successful call.',
      registers: [this.registry],
      collect() {
        this.set(cardhedger.getCircuitState().consecutiveFailures);
      },
    });

    new Gauge({
      name: 'cardhedger_circuit_open_duration_ms',
      help: 'Cumulative milliseconds the circuit was OPEN in the current metrics window (60 s).',
      registers: [this.registry],
      collect() {
        this.set(metricsService.getSnapshot().circuitOpenDurationMs);
      },
    });

    // ── Resolution paths ─────────────────────────────────────────────────────

    new Gauge({
      name: 'cardhedger_resolve_total',
      help: [
        'Resolve path counts for the current 60-second metrics window.',
        'Labels: card_details (stored ID direct hit), spec_id (PSA spec-map hit),',
        'search (card-search fallback), none (no match found), circuit_open (circuit blocked call).',
      ].join(' '),
      labelNames: ['path'] as const,
      registers: [this.registry],
      collect() {
        const { resolvePaths } = metricsService.getSnapshot();
        // Reset first so stale label combinations don't persist across windows.
        this.reset();
        for (const [path, count] of Object.entries(resolvePaths)) {
          this.labels(path).set(count);
        }
      },
    });

    new Gauge({
      name: 'cardhedger_search_depth_avg',
      help: [
        'Average number of card-search candidates evaluated per successful search-path resolve',
        'in the current 60-second metrics window. -1 = no search-path resolves yet.',
      ].join(' '),
      registers: [this.registry],
      collect() {
        const { searchDepthAvg } = metricsService.getSnapshot();
        // Use -1 as sentinel so Prometheus users can distinguish "no data" from "depth=0"
        this.set(searchDepthAvg ?? -1);
      },
    });

    // ── Snapshot scheduler ───────────────────────────────────────────────────
    // Scheduler state is pushed into CardhedgerMetricsService by the scheduler
    // on each cron tick via recordSchedulerState(). Reading from the metrics
    // service avoids a direct dependency on CollectionMarketSnapshotSchedulerService
    // which would require importing MarketplaceSnapshotsModule and causes an
    // unresolvable circular module context.

    new Gauge({
      name: 'cardhedger_snapshot_queue_depth',
      help: 'Number of collection keys currently in the in-memory snapshot refresh queue.',
      registers: [this.registry],
      collect() {
        this.set(metricsService.getSchedulerState()?.queueDepth ?? 0);
      },
    });

    new Gauge({
      name: 'cardhedger_snapshot_null_id_ratio',
      help: [
        'Last observed fraction of snapshot candidates with null cardhedger_card_id.',
        '-1 = no cron tick has run yet (no observation available).',
        'Values above MARKET_SNAPSHOT_NULL_ID_RATIO_THRESHOLD trigger cold-start batch reduction.',
      ].join(' '),
      registers: [this.registry],
      collect() {
        const state = metricsService.getSchedulerState();
        this.set(state?.lastNullIdRatio ?? -1);
      },
    });

    new Gauge({
      name: 'cardhedger_snapshot_batch_reduction_total',
      help: [
        'Number of cron ticks in the current 60-second window where cold-start batch reduction',
        'was applied (non-shadow mode). Resets with each metrics window flush.',
      ].join(' '),
      registers: [this.registry],
      collect() {
        this.set(metricsService.getSnapshot().batchReductionCount);
      },
    });

    // ── Identity cache ───────────────────────────────────────────────────────

    new Gauge({
      name: 'cardhedger_identity_cache_hits_total',
      help: 'Identity cache hits in the current 60-second metrics window.',
      labelNames: ['layer'] as const,
      registers: [this.registry],
      collect() {
        const { hits } = metricsService.getIdentityCacheMetrics();
        this.reset();
        for (const layer of ['l1', 'l2'] as const) {
          this.labels(layer).set(hits[layer]);
        }
      },
    });

    new Gauge({
      name: 'cardhedger_identity_cache_misses_total',
      help: 'Identity cache misses in the current 60-second metrics window.',
      labelNames: ['layer'] as const,
      registers: [this.registry],
      collect() {
        const { misses } = metricsService.getIdentityCacheMetrics();
        this.reset();
        for (const layer of ['l1', 'l2'] as const) {
          this.labels(layer).set(misses[layer]);
        }
      },
    });

    new Gauge({
      name: 'cardhedger_identity_cache_drift_total',
      help: [
        'Sampled cache-vs-DB drift check results in the current 60-second window.',
        'Kinds: match, cache_stale (wrong ID), cache_ahead (cache populated before DB commit), cache_phantom.',
      ].join(' '),
      labelNames: ['kind'] as const,
      registers: [this.registry],
      collect() {
        const { drift } = metricsService.getIdentityObservabilityMetrics();
        this.reset();
        for (const [kind, count] of Object.entries(drift)) {
          this.labels(kind).set(count);
        }
      },
    });

    new Gauge({
      name: 'cardhedger_identity_cache_drift_checks_total',
      help: 'Number of sampled cache-vs-DB drift checks performed in the current 60-second window.',
      registers: [this.registry],
      collect() {
        this.set(
          metricsService.getIdentityObservabilityMetrics().driftChecks,
        );
      },
    });

    new Gauge({
      name: 'cardhedger_identity_write_hint_total',
      help: [
        'Post-commit write-through cache hint outcomes in the current 60-second window.',
        'Outcomes: skipped_no_hint, unchanged, applied, evict.',
      ].join(' '),
      labelNames: ['outcome'] as const,
      registers: [this.registry],
      collect() {
        const { writeHint } = metricsService.getIdentityObservabilityMetrics();
        this.reset();
        for (const [outcome, count] of Object.entries(writeHint)) {
          this.labels(outcome).set(count);
        }
      },
    });

    new Gauge({
      name: 'cardhedger_identity_cache_write_total',
      help: [
        'Layered identity cache write outcomes in the current 60-second window.',
        'Outcomes: l2_l1 (both layers), l1_only (no Redis), l2_failed_skip_l1 (Redis write failed).',
      ].join(' '),
      labelNames: ['outcome'] as const,
      registers: [this.registry],
      collect() {
        const { cacheWrite } = metricsService.getIdentityObservabilityMetrics();
        this.reset();
        for (const [outcome, count] of Object.entries(cacheWrite)) {
          this.labels(outcome).set(count);
        }
      },
    });

    new Gauge({
      name: 'cardhedger_identity_redis_failure_total',
      help: [
        'L2 Redis identity cache command failures in the current 60-second window.',
        'Reasons: timeout, command_error, not_connected.',
      ].join(' '),
      labelNames: ['operation', 'reason'] as const,
      registers: [this.registry],
      collect() {
        const { redisFailure } =
          metricsService.getIdentityObservabilityMetrics();
        this.reset();
        for (const [op, reasons] of Object.entries(redisFailure)) {
          for (const [reason, count] of Object.entries(reasons)) {
            this.labels(op, reason).set(count);
          }
        }
      },
    });

    new Gauge({
      name: 'cardhedger_identity_audit_clear_total',
      help: [
        'Audit conditional clear outcomes in the current 60-second window.',
        'Outcomes: cleared, skipped_id_changed, skipped_not_found, skipped_empty_expected.',
      ].join(' '),
      labelNames: ['outcome'] as const,
      registers: [this.registry],
      collect() {
        const { auditClear } =
          metricsService.getIdentityObservabilityMetrics();
        this.reset();
        for (const [outcome, count] of Object.entries(auditClear)) {
          this.labels(outcome).set(count);
        }
      },
    });

    new Gauge({
      name: 'cardhedger_identity_cache_repair_total',
      help: [
        'Read-path identity cache self-healing repair outcomes in the current 60-second window.',
        'Outcomes: set (re-aligned to DB), evict (DB empty), skipped_cooldown (deduped within 10 s window).',
      ].join(' '),
      labelNames: ['outcome'] as const,
      registers: [this.registry],
      collect() {
        const { cacheRepair } =
          metricsService.getIdentityObservabilityMetrics();
        this.reset();
        for (const [outcome, count] of Object.entries(cacheRepair)) {
          this.labels(outcome).set(count);
        }
      },
    });

    new Gauge({
      name: 'cardhedger_identity_reconciliation_total',
      help: [
        'Proactive identity cache reconciliation outcomes in the current 60-second window.',
        'Outcomes: hit (aligned), miss (observed drift without repair), repair (cache fixed), skipped (rate limited).',
      ].join(' '),
      labelNames: ['outcome'] as const,
      registers: [this.registry],
      collect() {
        const { reconciliation } =
          metricsService.getIdentityObservabilityMetrics();
        this.reset();
        for (const [outcome, count] of Object.entries(reconciliation)) {
          this.labels(outcome).set(count);
        }
      },
    });

    new Gauge({
      name: 'cardhedger_identity_reconciliation_hot_keys',
      help: 'Number of hot keys tracked in the LRU at the last reconciliation tick.',
      registers: [this.registry],
      collect() {
        this.set(
          metricsService.getIdentityReconciliationState()?.hotKeyCount ?? 0,
        );
      },
    });

    new Gauge({
      name: 'cardhedger_identity_reconciliation_coverage_ratio',
      help: [
        'Fraction of hot keys scanned in the last reconciliation tick (scanned/hotKeys).',
        '-1 = no reconciliation tick has completed yet.',
      ].join(' '),
      registers: [this.registry],
      collect() {
        const state = metricsService.getIdentityReconciliationState();
        this.set(state?.coverageRatio ?? -1);
      },
    });

    new Gauge({
      name: 'cardhedger_identity_consistency_health_score',
      help: [
        'Composite identity cache consistency health score (0–100) from last SLO evaluation.',
        '-1 = not yet evaluated.',
      ].join(' '),
      registers: [this.registry],
      collect() {
        const slo = metricsService.getIdentitySloEvaluation();
        this.set(slo?.healthScore ?? -1);
      },
    });

    new Gauge({
      name: 'cardhedger_identity_degradation_mode',
      help: [
        'Identity cache degradation mode from last SLO evaluation.',
        '0=normal, 1=throttle, 2=protect, -1=unknown.',
      ].join(' '),
      registers: [this.registry],
      collect() {
        const slo = metricsService.getIdentitySloEvaluation();
        const mode = slo?.mode ?? 'unknown';
        const v =
          mode === 'normal' ? 0 : mode === 'throttle' ? 1 : mode === 'protect' ? 2 : -1;
        this.set(v);
      },
    });

    new Gauge({
      name: 'cardhedger_identity_log_invalid_total',
      help: 'Identity structured log events dropped due to schema validation failure (current 60s window).',
      registers: [this.registry],
      collect() {
        this.set(metricsService.getIdentityLogInvalidCount());
      },
    });
  }
}
