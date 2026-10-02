/**
 * P3.15 — Distributed chaos orchestration integration tests.
 */

import { IdentityCacheChaosOrchestrator } from './identity-cache-chaos.orchestrator';
import { assertReplayClean } from './identity-cache-replay.engine';
import type { ChaosReplayEvent } from './identity-cache-replay.types';
import {
  clearIntegrationKey,
  createIdentityIntegrationHarness,
  resolveIntegrationInfra,
  stopSharedIntegrationInfra,
} from './identity-cache-integration.harness';

const KEY = `chaos-${Date.now().toString(36)}`;

describe('Identity cache chaos orchestration (P3.15)', () => {
  let infraAvailable = false;

  beforeAll(async () => {
    infraAvailable = (await resolveIntegrationInfra()) != null;
  }, 120_000);

  afterAll(async () => {
    await stopSharedIntegrationInfra();
  }, 30_000);

  const itChaos = (name: string, fn: () => Promise<void>, timeout?: number) => {
    it(
      name,
      async () => {
        if (!infraAvailable) {
          // eslint-disable-next-line no-console
          console.warn('SKIP: integration infra unavailable');
          return;
        }
        await fn();
      },
      timeout,
    );
  };

  const runChaos = async (
    events: ChaosReplayEvent[],
    seed: number,
  ): Promise<void> => {
    const infra = await resolveIntegrationInfra();
    if (!infra) throw new Error('infra unavailable');

    const harness = await createIdentityIntegrationHarness(infra);
    const orchestrator = new IdentityCacheChaosOrchestrator();
    try {
      await clearIntegrationKey(harness, KEY);
      await orchestrator.open(harness);
      const result = await orchestrator.replayChaos(events, seed);
      assertReplayClean(result);
      expect(result.chaosTrace.length).toBe(events.length);
    } finally {
      await orchestrator.close();
      await harness.close();
    }
  };

  itChaos('redis partial outage: read ok / write fail then populate converges', async () => {
    const infra = await resolveIntegrationInfra();
    if (!infra) throw new Error('infra unavailable');

    const harness = await createIdentityIntegrationHarness(infra);
    const orchestrator = new IdentityCacheChaosOrchestrator();
    const events: ChaosReplayEvent[] = [
      { type: 'db_set', key: KEY, cardId: 'db-truth' },
      { type: 'chaos_redis_partition', enabled: true },
      { type: 'read_repair', key: KEY, context: 'read_populate' },
      { type: 'chaos_redis_partition', enabled: false },
      { type: 'read_repair', key: KEY, context: 'read_populate' },
    ];
    try {
      await clearIntegrationKey(harness, KEY);
      await orchestrator.open(harness);
      const result = await orchestrator.replayChaos(events, 42);
      expect(result.diffs[0]?.dbValue).toBe('db-truth');
      expect(result.diffs[0]?.aligned).toBe(true);
      expect(result.chaosTrace.length).toBe(events.length);
    } finally {
      await orchestrator.close();
      await harness.close();
    }
  }, 60_000);

  itChaos('pod restart mid-timeline preserves DB authority', async () => {
    await runChaos(
      [
        { type: 'db_set', key: KEY, cardId: 'before-restart' },
        { type: 'chaos_pod_restart' },
        { type: 'read_repair', key: KEY, context: 'read_populate' },
      ],
      99,
    );
  }, 60_000);

  itChaos('concurrent audit + reconcile storm (seeded burst)', async () => {
    await runChaos(
      [
        { type: 'db_set', key: KEY, cardId: 'storm-base' },
        {
          type: 'chaos_concurrent_burst',
          ops: [
            { type: 'db_audit_clear', key: KEY, expectedId: 'storm-base' },
            { type: 'reconcile', key: KEY, allowRepair: true },
            { type: 'db_persist_if_empty', key: KEY, cardId: 'storm-new' },
          ],
        },
        { type: 'read_repair', key: KEY, context: 'read_populate' },
      ],
      13,
    );
  }, 60_000);

  itChaos('DB lock hold extension under real FOR UPDATE', async () => {
    await runChaos(
      [
        { type: 'db_set', key: KEY, cardId: 'locked-id' },
        { type: 'chaos_db_lock_hold', key: KEY, holdMs: 150 },
        { type: 'db_audit_clear', key: KEY, expectedId: 'locked-id' },
      ],
      5,
    );
  }, 60_000);

  itChaos('clock skew TTL misalignment does not corrupt DB', async () => {
    await runChaos(
      [
        { type: 'db_set', key: KEY, cardId: 'skew-db' },
        { type: 'chaos_clock_skew', ttlSkewMs: -120_000 },
        { type: 'cache_write_through', key: KEY, hint: 'skew-db' },
        { type: 'read_repair', key: KEY, context: 'read_populate' },
      ],
      21,
    );
  }, 60_000);

  itChaos('L1/L2 split brain reproduction on real Redis', async () => {
    await runChaos(
      [
        { type: 'db_set', key: KEY, cardId: 'authoritative' },
        {
          type: 'inject_split_brain',
          key: KEY,
          l1Value: 'stale-l1',
          clearL2: true,
        },
        { type: 'read_repair', key: KEY, context: 'read_l1_probe' },
      ],
      7,
    );
  }, 60_000);
});
