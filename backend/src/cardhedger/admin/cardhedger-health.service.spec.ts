/**
 * P3.18 — Identity SLO health surface (SSOT via CardhedgerMetricsService).
 */

import { CardhedgerHealthService } from './cardhedger-health.service';
import type { CardhedgerMetricsService } from '../../common/metrics/cardhedger-metrics.service';
import type { CardhedgerService } from '../cardhedger.service';
import type { ConfigService } from '@nestjs/config';

describe('CardhedgerHealthService identitySlo (P3.18)', () => {
  const cardhedger = {
    getCircuitState: () => ({ state: 'CLOSED', consecutiveFailures: 0 }),
  } as unknown as CardhedgerService;

  const config = {
    get: (key: string) =>
      key === 'marketplace.cardhedgerFeatureFlags'
        ? {
            fmvBatchEnabled: false,
            batchPricesByCertEnabled: false,
            batchPriceEstimateEnabled: false,
            pricesByCertOcrEnabled: false,
            cardMatchFirst: false,
            mintPreviewSkipComps: false,
            certPricePilotCompare: false,
            priceWebhookEnabled: false,
            priceSubscribeEnabled: false,
            dailyPriceDeltaImportEnabled: false,
            dailyPriceExportCsvEnabled: false,
          }
        : undefined,
  } as unknown as ConfigService;

  const emptyUpstream = {
    total: 0,
    success: 0,
    errors: 0,
    avgDurationMs: null,
    byEndpoint: {},
    byOperation: {},
  };

  function metricsStub(
    overrides: Partial<CardhedgerMetricsService> = {},
  ): CardhedgerMetricsService {
    return {
      getSnapshot: () => ({
        circuitOpenDurationMs: 0,
        resolveTotal: 0,
        resolvePaths: {},
        searchDepthAvg: null,
        batchReductionCount: 0,
        upstream: emptyUpstream,
        windowStartedAt: Date.now(),
      }),
      getSchedulerState: () => null,
      getIdentityCacheHealth: () => ({ mode: 'layered', redisConnected: true }),
      getIdentityObservabilityMetrics: () => ({
        driftChecks: 0,
        drift: { match: 0, cache_stale: 0, cache_ahead: 0, cache_phantom: 0 },
        writeHint: {
          skipped_no_hint: 0,
          unchanged: 0,
          applied: 0,
          evict: 0,
        },
        cacheWrite: { l2_l1: 0, l1_only: 0, l2_failed_skip_l1: 0 },
        auditClear: {
          cleared: 0,
          skipped_id_changed: 0,
          skipped_not_found: 0,
          skipped_empty_expected: 0,
        },
        cacheRepair: { set: 0, evict: 0, skipped_cooldown: 0 },
        reconciliation: { hit: 0, miss: 0, repair: 0, skipped: 0 },
      }),
      getIdentityReconciliationState: () => null,
      getIdentitySloEvaluation: () => null,
      getUpstreamMetrics: () => emptyUpstream,
      ...overrides,
    } as unknown as CardhedgerMetricsService;
  }

  it('returns not_yet_evaluated when SLO snapshot is absent', () => {
    const health = new CardhedgerHealthService(
      cardhedger,
      metricsStub(),
      config,
    );
    const slo = health.getIdentitySloHealth();
    expect(slo.healthScore).toBe(-1);
    expect(slo.mode).toBeNull();
    expect(slo.reasons).toEqual(['not_yet_evaluated']);
    expect(slo.evaluatedAt).toBeNull();
  });

  it('mirrors metrics SLO snapshot (same source as Prometheus)', () => {
    const metrics = metricsStub({
      getIdentitySloEvaluation: () => ({
        healthScore: 72,
        mode: 'throttle' as const,
        driftRate: 0.02,
        redisFailureRate: 0,
        reconcileSkipRate: 0.1,
        reasons: ['drift_rate_warn=0.0200', 'mode=throttle'],
        evaluatedAt: '2026-06-01T12:00:00.000Z',
      }),
    });

    const health = new CardhedgerHealthService(cardhedger, metrics, config);
    const payload = health.getFullHealth();
    expect(payload.identitySlo).toEqual({
      healthScore: 72,
      mode: 'throttle',
      reasons: ['drift_rate_warn=0.0200', 'mode=throttle'],
      evaluatedAt: '2026-06-01T12:00:00.000Z',
    });
  });
});
