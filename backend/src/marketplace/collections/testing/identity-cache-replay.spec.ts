/**
 * P3.13 — Deterministic replay and chaos validation suite.
 */

import {
  assertReplayClean,
  formatReplayDiff,
  formatReplayTrace,
  IdentityCacheReplayEngine,
  type IdentityReplayEvent,
} from './identity-cache-replay.engine';

describe('IdentityCacheReplayEngine (P3.13)', () => {
  const KEY = 'col-abc';
  const engine = new IdentityCacheReplayEngine();

  it('replays write → stale cache → populate repair with deterministic outcome', async () => {
    const events: IdentityReplayEvent[] = [
      { type: 'db_set', key: KEY, cardId: 'id-v2' },
      { type: 'cache_write_through', key: KEY, hint: 'id-v1' },
      { type: 'read_repair', key: KEY, context: 'read_populate' },
    ];

    const result = await engine.replay(events, 42);
    assertReplayClean(result);

    const diff = result.diffs.find((d) => d.key === KEY);
    expect(diff?.aligned).toBe(true);
    expect(diff?.dbValue).toBe('id-v2');
    expect(diff?.cacheEffective).toBe('id-v2');
  });

  it('replays audit clear vs write race with seeded interleaving', async () => {
    const audit: IdentityReplayEvent = {
      type: 'db_audit_clear',
      key: KEY,
      expectedId: 'snapshot-id',
    };
    const write: IdentityReplayEvent = {
      type: 'db_persist_if_empty',
      key: KEY,
      cardId: 'new-write',
    };
    const reconcile: IdentityReplayEvent = {
      type: 'reconcile',
      key: KEY,
      allowRepair: true,
    };

    for (let seed = 0; seed < 6; seed++) {
      const runner = new IdentityCacheReplayEngine();
      const events: IdentityReplayEvent[] = [
        { type: 'db_set', key: KEY, cardId: 'snapshot-id' },
        ...runner.interleaveRace(audit, write, reconcile, seed),
      ];
      const result = await engine.replay(events, seed);
      expect(result.violations.filter((v) => v.invariant === 'I4_audit_no_erase_newer')).toHaveLength(0);
      const db = result.diffs.find((d) => d.key === KEY)?.dbValue ?? '';
      expect(db === '' || db === 'new-write' || db === 'snapshot-id').toBe(true);
    }
  });

  it('reproduces L1/L2 split brain and converges via read repair', async () => {
    const events: IdentityReplayEvent[] = [
      { type: 'db_set', key: KEY, cardId: 'authoritative' },
      { type: 'inject_split_brain', key: KEY, l1Value: 'stale-l1', clearL2: true },
      { type: 'read_repair', key: KEY, context: 'read_l1_probe' },
    ];

    const result = await engine.replay(events, 7);
    assertReplayClean(result);
    expect(result.diffs[0]?.cacheEffective).toBe('authoritative');
  });

  it('simulates Redis write failure without false L1 projection', async () => {
    const events: IdentityReplayEvent[] = [
      { type: 'db_set', key: KEY, cardId: 'db-only' },
      { type: 'inject_l2_write_fail', enabled: true },
      { type: 'read_repair', key: KEY, context: 'read_populate' },
    ];

    const result = await engine.replay(events, 99);
    const diff = result.diffs.find((d) => d.key === KEY);
    expect(diff?.dbValue).toBe('db-only');
    expect(diff?.cacheL1 ?? null).toBeNull();
  });

  it('replays reconcile during write burst', async () => {
    const events: IdentityReplayEvent[] = [
      { type: 'db_set', key: KEY, cardId: 'v1' },
      { type: 'cache_write_through', key: KEY, hint: 'v1' },
      { type: 'db_set', key: KEY, cardId: 'v2' },
      { type: 'reconcile', key: KEY, allowRepair: true },
    ];

    const result = await engine.replay(events, 13);
    assertReplayClean(result);
    expect(result.diffs[0]?.aligned).toBe(true);
    expect(result.diffs[0]?.dbValue).toBe('v2');
  });

  it('same seed + same events → identical trace and diff', async () => {
    const events: IdentityReplayEvent[] = [
      { type: 'db_persist_if_empty', key: KEY, cardId: 'a' },
      { type: 'inject_l2_disconnect', connected: false },
      { type: 'read_repair', key: KEY, context: 'read_sync' },
    ];

    const r1 = await engine.replay(events, 123);
    const r2 = await engine.replay(events, 123);

    expect(formatReplayTrace(r1)).toBe(formatReplayTrace(r2));
    expect(formatReplayDiff(r1)).toBe(formatReplayDiff(r2));
  });
});
