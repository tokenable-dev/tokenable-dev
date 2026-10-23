import { IdentityCacheDecisionEngine } from './identity-cache-decision.engine';

describe('IdentityCacheDecisionEngine (P3.10 policy ownership)', () => {
  const engine = new IdentityCacheDecisionEngine();

  describe('classify + decideAction', () => {
    it.each([
      ['match', true, 'card-a', 'card-a', 'skip'],
      ['cache_stale', true, 'old', 'new', 'evict_then_set'],
      ['cache_ahead', true, 'cached', '', 'skip'],
      ['miss', false, null, 'card-a', 'set'],
      ['match empty', false, null, '', 'skip'],
    ] as const)(
      '%s → action=%s',
      (_label, cacheExists, cached, db, expectedAction) => {
        const decision = engine.decide({
          cacheExists,
          cachedValue: cached,
          dbValue: db,
        });
        expect(decision.action).toBe(expectedAction);
      },
    );

    it('classifies empty-cache + empty-db exists as match (not phantom)', () => {
      const decision = engine.decide({
        cacheExists: true,
        cachedValue: '',
        dbValue: '',
      });
      expect(decision.driftKind).toBe('match');
      expect(decision.action).toBe('skip');
    });
  });

  describe('policy gates', () => {
    it('records drift metrics only on read_sync/read_async and not miss', () => {
      expect(engine.shouldRecordDriftMetric('read_sync', 'cache_stale')).toBe(
        true,
      );
      expect(engine.shouldRecordDriftMetric('read_async', 'cache_ahead')).toBe(
        true,
      );
      expect(engine.shouldRecordDriftMetric('read_sync', 'miss')).toBe(false);
      expect(
        engine.shouldRecordDriftMetric('read_populate', 'cache_stale'),
      ).toBe(false);
    });

    it('bypasses cooldown only on read_populate', () => {
      expect(engine.shouldBypassRepairCooldown('read_populate')).toBe(true);
      expect(engine.shouldBypassRepairCooldown('read_sync')).toBe(false);
    });

    it('overrides cache hit return only on sync cache_stale', () => {
      expect(
        engine.shouldOverrideCacheHitReturn('read_sync', 'cache_stale'),
      ).toBe(true);
      expect(
        engine.shouldOverrideCacheHitReturn('read_async', 'cache_stale'),
      ).toBe(false);
      expect(engine.shouldOverrideCacheHitReturn('read_sync', 'match')).toBe(
        false,
      );
    });
  });

  describe('buildExecutionCommand (P3.12 IO boundary)', () => {
    it.each([
      ['skip', 'skip', 'card-a', 'noop'],
      ['set', 'set', 'card-a', 'set'],
      ['set empty', 'set', '', 'delete'],
      ['evict', 'evict', '', 'delete'],
      ['evict_then_set', 'evict_then_set', 'card-a', 'replace'],
    ] as const)(
      'action=%s → op=%s',
      (_label, action, dbValue, expectedOp) => {
        const cmd = engine.buildExecutionCommand(
          'key-1',
          action,
          dbValue,
          false,
        );
        expect(cmd.op).toBe(expectedOp);
        expect(cmd.key).toBe('key-1');
      },
    );

    it('isExecutable returns false for noop', () => {
      const cmd = engine.buildExecutionCommand('k', 'skip', 'x', false);
      expect(engine.isExecutable(cmd)).toBe(false);
    });
  });

  describe('reconciliationOutcome', () => {
    it('maps match to hit and cache_ahead to miss', () => {
      const match = engine.decide({
        cacheExists: true,
        cachedValue: 'x',
        dbValue: 'x',
      });
      expect(
        engine.reconciliationOutcome(match, { repaired: false, skippedCooldown: false }, true),
      ).toBe('hit');

      const ahead = engine.decide({
        cacheExists: true,
        cachedValue: 'x',
        dbValue: '',
      });
      expect(
        engine.reconciliationOutcome(ahead, { repaired: false, skippedCooldown: false }, true),
      ).toBe('miss');
    });
  });
});
