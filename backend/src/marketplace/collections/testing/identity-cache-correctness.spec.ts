/**
 * P3.11 — System-level correctness validation for identity cache scenarios.
 *
 * Invariants under test:
 *   I1 — DB is always source of truth for repair decisions
 *   I2 — No stale cache value overwrites a newer DB value after repair
 *   I3 — Write-path conditional UPDATE prevents identity corruption
 *   I4 — Audit clear cannot erase a newer identity write
 *   I5 — Cache eventually converges to DB after repair (when not cooldown-blocked)
 */

import {
  IdentityScenarioRunner,
  SimulatedIdentityDb,
  SimulatedLayeredCache,
} from './identity-cache-simulation.harness';

describe('Identity cache correctness (P3.11)', () => {
  const KEY = 'test-key';

  describe('scenario: concurrent audit clear vs identity write race', () => {
    it('audit clear does not erase a newer write (I3/I4)', async () => {
      const db = new SimulatedIdentityDb();
      db.setCardId(KEY, 'audit-snapshot');

      const auditWins = db.clearIfUnchanged(KEY, 'audit-snapshot');
      expect(auditWins).toBe(true);
      expect(db.getCardId(KEY)).toBe('');

      db.setCardId(KEY, 'new-write');
      const staleAudit = db.clearIfUnchanged(KEY, 'audit-snapshot');
      expect(staleAudit).toBe(false);
      expect(db.getCardId(KEY)).toBe('new-write');
    });

    it('concurrent write wins over empty-slot race via persistIdIfEmpty (I3)', async () => {
      const db = new SimulatedIdentityDb();

      const first = db.persistIdIfEmpty(KEY, 'mint-a');
      const second = db.persistIdIfEmpty(KEY, 'cert-b');
      expect(first).toBe(true);
      expect(second).toBe(false);
      expect(db.getCardId(KEY)).toBe('mint-a');
    });

    it('interleaved audit + write under lock preserves DB truth (I4)', async () => {
      const db = new SimulatedIdentityDb();
      db.setCardId(KEY, 'old-id');

      await Promise.all([
        db.withKeyLock(KEY, async () => {
          await db.persistIdIfEmpty(KEY, 'race-write');
        }),
        db.withKeyLock(KEY, async () => {
          db.clearIfUnchanged(KEY, 'old-id');
        }),
      ]);

      const finalId = db.getCardId(KEY);
      expect(finalId === '' || finalId === 'race-write').toBe(true);
      expect(finalId).not.toBe('old-id');
    });
  });

  describe('scenario: cache stale + DB update ordering conflict', () => {
    it('repair evicts stale cache and sets DB value (I1/I2/I5)', async () => {
      const sim = new IdentityScenarioRunner();
      sim.db.setCardId(KEY, 'db-new');
      sim.cache.l1.set(KEY, 'cache-old');
      sim.cache.l2.set(KEY, 'cache-old');

      const result = await sim.evaluateAndRepair(KEY, 'read_sync', {
        cacheExists: true,
        cachedValue: 'cache-old',
      });

      expect(result.decision.driftKind).toBe('cache_stale');
      expect(result.returnValue).toBe('db-new');
      expect(await sim.cache.get(KEY)).toBe('db-new');
    });

    it('write-through after DB commit does not regress to stale cache (I2)', async () => {
      const sim = new IdentityScenarioRunner();
      sim.db.setCardId(KEY, 'committed');
      sim.cache.l2.set(KEY, 'stale');
      sim.cache.l1.set(KEY, 'stale');

      await sim.applyPostCommitCache(KEY, 'committed');
      expect(await sim.cache.get(KEY)).toBe('committed');
    });
  });

  describe('scenario: L1 stale + L2 miss split brain', () => {
    it('probe detects L1-only stale and repair converges to DB (I5)', async () => {
      const sim = new IdentityScenarioRunner();
      sim.db.setCardId(KEY, 'authoritative');
      sim.cache.l1.set(KEY, 'stale-l1');
      // L2 intentionally empty — split brain

      const l1Value = sim.cache.probeL2MissL1Hit(KEY);
      expect(l1Value).toBe('stale-l1');

      const result = await sim.evaluateAndRepair(KEY, 'read_l1_probe', {
        cacheExists: true,
        cachedValue: l1Value,
      });

      expect(result.decision.driftKind).toBe('cache_stale');
      expect(result.returnValue).toBe('authoritative');
      expect(sim.cache.l2.get(KEY)).toBe('authoritative');
      expect(sim.cache.l1.get(KEY)).toBe('authoritative');
    });
  });

  describe('scenario: Redis failure (write + read partial failure)', () => {
    it('L2 write failure skips L1 set — no false local hit (I2)', async () => {
      const cache = new SimulatedLayeredCache();
      cache.l2Connected = true;
      cache.l2WriteFails = true;

      await cache.set(KEY, 'should-not-stick', 60_000);
      expect(cache.l1.has(KEY)).toBe(false);
      expect(cache.l2.has(KEY)).toBe(false);
    });

    it('L2 read failure falls back to L1 without corrupting DB truth on repair (I1)', async () => {
      const sim = new IdentityScenarioRunner();
      sim.db.setCardId(KEY, 'db-truth');
      sim.cache.l1.set(KEY, 'stale');
      sim.cache.l2ReadFails = true;

      const result = await sim.evaluateAndRepair(KEY, 'read_populate');
      expect(result.returnValue).toBe('db-truth');
    });

    it('L2 disconnected allows L1-only mode without overwriting DB authority (I1)', async () => {
      const sim = new IdentityScenarioRunner();
      sim.db.setCardId(KEY, 'db-only');
      sim.cache.l2Connected = false;
      sim.cache.l1.set(KEY, 'local-stale');

      const result = await sim.evaluateAndRepair(KEY, 'read_sync', {
        cacheExists: true,
        cachedValue: 'local-stale',
      });
      expect(result.returnValue).toBe('db-only');
    });
  });

  describe('scenario: reconciliation during active write burst', () => {
    it('reconcile repairs stale cache to current DB (I5)', async () => {
      const sim = new IdentityScenarioRunner();
      sim.db.setCardId(KEY, 'burst-final');
      sim.cache.l2.set(KEY, 'burst-stale');
      sim.cache.l1.set(KEY, 'burst-stale');

      const outcome = await sim.reconcileKey(KEY, () => true);
      expect(outcome).toBe('repair');
      expect(await sim.cache.get(KEY)).toBe('burst-final');
    });

    it('reconcile skip when repair budget exhausted — no corruption (I3)', async () => {
      const sim = new IdentityScenarioRunner();
      sim.db.setCardId(KEY, 'db-val');
      sim.cache.l2.set(KEY, 'stale');

      const outcome = await sim.reconcileKey(KEY, () => false);
      expect(outcome).toBe('skipped');
      expect(await sim.cache.get(KEY)).toBe('stale');
      expect(sim.db.getCardId(KEY)).toBe('db-val');
    });

    it('DB update during reconcile window — repair targets latest DB snapshot (I1)', async () => {
      const sim = new IdentityScenarioRunner();
      sim.cache.l2.set(KEY, 'v1');
      sim.db.setCardId(KEY, 'v1');

      sim.db.setCardId(KEY, 'v2');
      const result = await sim.evaluateAndRepair(KEY, 'reconcile', {
        cacheExists: true,
        cachedValue: 'v1',
      });

      expect(result.decision.driftKind).toBe('cache_stale');
      expect(await sim.cache.get(KEY)).toBe('v2');
    });
  });
});
