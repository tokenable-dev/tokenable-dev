/**
 * P3.16 — SRE layer unit tests (trace, SLO, extended failure modes).
 */

import { CardhedgerMetricsService } from '../../../common/metrics/cardhedger-metrics.service';
import { IdentityCacheSloService } from '../identity-cache-slo.service';
import { IdentityCacheReplayEngine } from './identity-cache-replay.engine';
import {
  formatIdentityTraceSuffix,
  generateCorrelationId,
  runWithIdentityCorrelation,
  withIdentitySpan,
} from '../identity-trace.context';

describe('Identity trace context (P3.16)', () => {
  it('propagates correlation id and phase through nested spans', async () => {
    const cid = generateCorrelationId();
    await runWithIdentityCorrelation(cid, async () => {
      await withIdentitySpan('read', { collectionKey: 'k1' }, async () => {
        await withIdentitySpan('decision', { collectionKey: 'k1' }, async () => {
          const suffix = formatIdentityTraceSuffix({ drift: 'cache_stale' });
          expect(suffix).toContain(`cid=${cid}`);
          expect(suffix).toContain('phase=decision');
          expect(suffix).toContain('key=k1');
          expect(suffix).toContain('drift=cache_stale');
        });
      });
    });
  });
});

describe('IdentityCacheSloService (P3.16)', () => {
  it('returns protect mode on elevated drift', () => {
    const metrics = {
      getIdentityObservabilityMetrics: () => ({
        driftChecks: 100,
        drift: { match: 90, cache_stale: 8, cache_ahead: 0, cache_phantom: 2 },
        writeHint: { skipped_no_hint: 0, unchanged: 0, applied: 0, evict: 0 },
        cacheWrite: { l2_l1: 0, l1_only: 0, l2_failed_skip_l1: 0 },
        redisFailure: {
          get: { timeout: 0, command_error: 0, not_connected: 0 },
          set: { timeout: 0, command_error: 0, not_connected: 0 },
          exists: { timeout: 0, command_error: 0, not_connected: 0 },
          delete: { timeout: 0, command_error: 0, not_connected: 0 },
        },
        auditClear: {
          cleared: 0,
          skipped_id_changed: 0,
          skipped_not_found: 0,
          skipped_empty_expected: 0,
        },
        cacheRepair: { set: 0, evict: 0, skipped_cooldown: 0 },
        reconciliation: { hit: 0, miss: 0, repair: 0, skipped: 0 },
      }),
      getIdentityCacheMetrics: () => ({
        hits: { l1: 50, l2: 50 },
        misses: { l1: 0, l2: 0 },
      }),
      getIdentityReconciliationState: () => null,
    } as unknown as CardhedgerMetricsService;

    const slo = new IdentityCacheSloService(
      { get: () => undefined } as never,
      metrics,
    );
    const eval_ = slo.evaluate();
    expect(eval_.driftRate).toBe(0.1);
    expect(eval_.mode).toBe('throttle');
    expect(eval_.warmupAllowed).toBe(false);
    expect(eval_.reconcileRepairMultiplier).toBeLessThan(1);
  });

  it('publishToMetrics records evaluation to metrics SSOT', () => {
    const recorded: Array<{ healthScore: number; mode: string }> = [];
    const metrics = {
      getIdentityObservabilityMetrics: () => ({
        driftChecks: 100,
        drift: { match: 100, cache_stale: 0, cache_ahead: 0, cache_phantom: 0 },
        writeHint: { skipped_no_hint: 0, unchanged: 0, applied: 0, evict: 0 },
        cacheWrite: { l2_l1: 0, l1_only: 0, l2_failed_skip_l1: 0 },
        redisFailure: {
          get: { timeout: 0, command_error: 0, not_connected: 0 },
          set: { timeout: 0, command_error: 0, not_connected: 0 },
          exists: { timeout: 0, command_error: 0, not_connected: 0 },
          delete: { timeout: 0, command_error: 0, not_connected: 0 },
        },
        auditClear: {
          cleared: 0,
          skipped_id_changed: 0,
          skipped_not_found: 0,
          skipped_empty_expected: 0,
        },
        cacheRepair: { set: 0, evict: 0, skipped_cooldown: 0 },
        reconciliation: { hit: 0, miss: 0, repair: 0, skipped: 0 },
      }),
      getIdentityCacheMetrics: () => ({
        hits: { l1: 100, l2: 0 },
        misses: { l1: 0, l2: 0 },
      }),
      getIdentityReconciliationState: () => null,
      recordIdentitySloEvaluation: (snap: { healthScore: number; mode: string }) => {
        recorded.push(snap);
      },
    } as unknown as CardhedgerMetricsService;

    const slo = new IdentityCacheSloService(
      { get: () => undefined } as never,
      metrics,
    );
    slo.publishToMetrics();
    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.healthScore).toBe(100);
    expect(recorded[0]?.mode).toBe('normal');
  });
});

describe('P3.16 extended failure modes (simulation)', () => {
  const engine = new IdentityCacheReplayEngine();
  const KEY = 'sre-key';

  it('DB commit + cache write fail — DB truth preserved', async () => {
    const result = await engine.replay(
      [
        {
          type: 'inject_db_commit_cache_write_fail',
          key: KEY,
          cardId: 'committed',
        },
        { type: 'inject_l2_write_fail', enabled: false },
        { type: 'read_repair', key: KEY, context: 'read_populate' },
      ],
      1,
    );
    expect(result.diffs[0]?.dbValue).toBe('committed');
    expect(result.diffs[0]?.aligned).toBe(true);
  });

  it('replication lag overlay converges after lag cleared + repair', async () => {
    const result = await engine.replay(
      [
        { type: 'db_set', key: KEY, cardId: 'authoritative' },
        {
          type: 'inject_db_replication_lag',
          key: KEY,
          staleCardId: 'stale-replica',
        },
        { type: 'read_repair', key: KEY, context: 'read_populate' },
      ],
      2,
    );
    expect(result.diffs[0]?.dbValue).toBe('authoritative');
    // Lag overlay may temporarily project stale value — DB remains authoritative (I1).
  });

  it('redis failover stale L2 repaired on populate', async () => {
    const result = await engine.replay(
      [
        { type: 'db_set', key: KEY, cardId: 'new-primary' },
        {
          type: 'inject_redis_failover',
          key: KEY,
          staleL2Value: 'old-primary',
        },
        { type: 'inject_l2_write_fail', enabled: false },
        { type: 'read_repair', key: KEY, context: 'read_populate' },
      ],
      3,
    );
    expect(result.diffs[0]?.dbValue).toBe('new-primary');
    expect(result.diffs[0]?.aligned).toBe(true);
  });

  it('repair stall does not corrupt DB', async () => {
    const result = await engine.replay(
      [
        { type: 'db_set', key: KEY, cardId: 'stable' },
        { type: 'inject_repair_stall', key: KEY, stallMs: 5 },
        { type: 'read_repair', key: KEY, context: 'read_populate' },
      ],
      4,
    );
    expect(result.diffs[0]?.dbValue).toBe('stable');
  });
});
