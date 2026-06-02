/**
 * P3.14 — Production fidelity integration tests (TypeORM + Redis).
 *
 * Requires Docker (testcontainers) or IDENTITY_INTEGRATION_USE_ENV=1 with
 * POSTGRES_* + REDIS_URL. Skipped when infra is unavailable.
 */

import { IdentityCacheProductionReplayEngine } from './identity-cache-production-replay.engine';
import {
  assertReplayClean,
  formatReplayDiff,
} from './identity-cache-replay.engine';
import type { IdentityReplayEvent } from './identity-cache-replay.types';
import {
  clearIntegrationKey,
  createIdentityIntegrationHarness,
  resolveIntegrationInfra,
  stopSharedIntegrationInfra,
} from './testing/identity-cache-integration.harness';

const KEY = `int-${Date.now().toString(36)}`;

describe('Identity cache production fidelity (P3.14)', () => {
  let infraAvailable = false;

  beforeAll(async () => {
    infraAvailable = (await resolveIntegrationInfra()) != null;
  }, 120_000);

  afterAll(async () => {
    await stopSharedIntegrationInfra();
  }, 30_000);

  const itIntegration = (name: string, fn: () => Promise<void>, timeout?: number) => {
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

  const runWithHarness = async (
    fn: (h: Awaited<ReturnType<typeof createIdentityIntegrationHarness>>) => Promise<void>,
  ) => {
    const infra = await resolveIntegrationInfra();
    if (!infra) throw new Error('infra unavailable');
    const harness = await createIdentityIntegrationHarness(infra);
    try {
      await clearIntegrationKey(harness, KEY);
      await fn(harness);
    } finally {
      await harness.close();
    }
  };

  itIntegration('replays stale cache → read_populate repair on real Postgres + Redis', async () => {
    await runWithHarness(async (h) => {
      const engine = new IdentityCacheProductionReplayEngine();
      const events: IdentityReplayEvent[] = [
        { type: 'db_set', key: KEY, cardId: 'prod-v2' },
        { type: 'cache_write_through', key: KEY, hint: 'prod-v1' },
        { type: 'read_repair', key: KEY, context: 'read_populate' },
      ];

      await engine.open(h);
      const result = await engine.replay(events, 42);
      await engine.close();

      assertReplayClean(result);
      const diff = result.diffs.find((d) => d.key === KEY.toLowerCase());
      expect(diff?.dbValue).toBe('prod-v2');
      expect(diff?.aligned).toBe(true);
      expect(formatReplayDiff(result)).toContain('aligned=true');
    });
  }, 60_000);

  itIntegration('verifies FOR UPDATE audit clear vs write race on real transactions', async () => {
    await runWithHarness(async (h) => {
      const engine = new IdentityCacheProductionReplayEngine();
      const events: IdentityReplayEvent[] = [
        { type: 'db_set', key: KEY, cardId: 'audit-id' },
        { type: 'db_audit_clear', key: KEY, expectedId: 'audit-id' },
        { type: 'db_persist_if_empty', key: KEY, cardId: 'new-write' },
      ];

      await engine.open(h);
      const result = await engine.replay(events, 7);
      await engine.close();

      assertReplayClean(result);
      const diff = result.diffs[0];
      expect(diff.dbValue).toBe('new-write');
    });
  }, 60_000);

  itIntegration('simulation vs production parity for shared timeline', async () => {
    await runWithHarness(async (h) => {
      const engine = new IdentityCacheProductionReplayEngine();
      const events: IdentityReplayEvent[] = [
        { type: 'db_set', key: KEY, cardId: 'parity-db' },
        { type: 'inject_split_brain', key: KEY, l1Value: 'stale', clearL2: true },
        { type: 'read_repair', key: KEY, context: 'read_l1_probe' },
      ];

      const parity = await engine.compareParity(events, 11, h);
      expect(parity.mismatches).toEqual([]);
      expect(parity.dbParity).toBe(true);
      expect(parity.alignedParity).toBe(true);
    });
  }, 90_000);
});
