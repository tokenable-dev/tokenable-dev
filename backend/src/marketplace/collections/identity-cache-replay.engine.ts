/**
 * P3.13 — Deterministic event replay + chaos validation for identity cache.
 *
 * Replays write / audit / repair / reconcile timelines with seeded interleaving,
 * produces DB-vs-cache diff, invariant violations, and race trace logs.
 */

import { IdentityCacheDecisionEngine } from './identity-cache-decision.engine';
import { checkReplayInvariants } from './identity-cache-replay-invariants';
import type {
  IdentityReplayEvent,
  InvariantViolation,
  ReplayResult,
  ReplayStateDiff,
  ReplayTraceEntry,
} from './identity-cache-replay.types';
export type {
  IdentityReplayEvent,
  InvariantId,
  InvariantViolation,
  ReplayResult,
  ReplayStateDiff,
  ReplayTraceEntry,
} from './identity-cache-replay.types';
import {
  createSeededRng,
  IdentityScenarioRunner,
  pickSeeded,
} from './identity-cache-simulation.harness';

// ---------------------------------------------------------------------------
// Replay engine
// ---------------------------------------------------------------------------

export class IdentityCacheReplayEngine {
  async replay(
    events: IdentityReplayEvent[],
    seed = 42,
  ): Promise<ReplayResult> {
    const runner = new IdentityScenarioRunner();
    const trace: ReplayTraceEntry[] = [];
    const violations: InvariantViolation[] = [];
    const rng = createSeededRng(seed);

    for (let index = 0; index < events.length; index++) {
      const event = events[index];
      const note = await this.applyEvent(runner, event, rng);
      const key = 'key' in event ? event.key.toLowerCase() : '';
      trace.push({
        ...this.snapshotTrace(index, event, runner, key, note),
        runtime: 'simulation',
      });

      const diff = this.diffKey(runner, key);
      if (key) checkReplayInvariants(event, index, diff.dbValue, diff, violations);
    }

    const keys = [
      ...new Set(
        events
          .filter((e) => 'key' in e)
          .map((e) => (e as IdentityReplayEvent & { key: string }).key.toLowerCase()),
      ),
    ];
    const diffs = keys.map((key) => this.diffKey(runner, key));

    return { seed, runtime: 'simulation', trace, diffs, violations };
  }

  /** Generate concurrent race interleaving from a base timeline + seed. */
  interleaveRace(
    audit: IdentityReplayEvent,
    write: IdentityReplayEvent,
    reconcile: IdentityReplayEvent,
    seed: number,
  ): IdentityReplayEvent[] {
    const rng = createSeededRng(seed);
    const orders = [
      [audit, write, reconcile],
      [write, audit, reconcile],
      [reconcile, audit, write],
      [audit, reconcile, write],
      [write, reconcile, audit],
      [reconcile, write, audit],
    ];
    return pickSeeded(rng, orders);
  }

  private async applyEvent(
    runner: IdentityScenarioRunner,
    event: IdentityReplayEvent,
    _rng: () => number,
  ): Promise<string | undefined> {
    switch (event.type) {
      case 'db_persist_if_empty': {
        const ok = runner.db.persistIdIfEmpty(event.key, event.cardId);
        return ok ? 'persist_ok' : 'persist_blocked';
      }
      case 'db_set':
        runner.db.setCardId(event.key, event.cardId);
        return 'db_set';
      case 'db_audit_clear': {
        const ok = runner.db.clearIfUnchanged(event.key, event.expectedId);
        if (ok) await runner.applyPostCommitCache(event.key, null);
        return ok ? 'audit_cleared' : 'audit_skipped';
      }
      case 'cache_write_through':
        await runner.applyPostCommitCache(event.key, event.hint);
        return 'write_through';
      case 'read_repair':
        await runner.evaluateAndRepair(event.key, event.context);
        return 'read_repair';
      case 'reconcile':
        await runner.reconcileKey(event.key, () => event.allowRepair);
        return 'reconcile';
      case 'inject_l2_write_fail':
        runner.cache.l2WriteFails = event.enabled;
        return event.enabled ? 'l2_write_fail_on' : 'l2_write_fail_off';
      case 'inject_l2_read_fail':
        runner.cache.l2ReadFails = event.enabled;
        return event.enabled ? 'l2_read_fail_on' : 'l2_read_fail_off';
      case 'inject_l2_disconnect':
        runner.cache.l2Connected = event.connected;
        return event.connected ? 'l2_connected' : 'l2_disconnected';
      case 'inject_split_brain':
        if (event.clearL2) runner.cache.l2.delete(event.key.toLowerCase());
        runner.cache.l1.set(event.key.toLowerCase(), event.l1Value);
        return 'split_brain';
      case 'inject_db_commit_cache_write_fail':
        runner.db.setCardId(event.key, event.cardId);
        runner.cache.l2WriteFails = true;
        await runner.applyPostCommitCache(event.key, event.cardId);
        return 'db_commit_cache_write_fail';
      case 'inject_db_replication_lag':
        runner.replicationLag.set(event.key.toLowerCase(), event.staleCardId);
        return 'db_replication_lag';
      case 'inject_redis_failover':
        runner.cache.l2.set(event.key.toLowerCase(), event.staleL2Value);
        runner.cache.l2WriteFails = true;
        runner.cache.l2ReadFails = false;
        return 'redis_failover';
      case 'inject_repair_stall':
        runner.executor.stallMs = event.stallMs;
        return 'repair_stall';
      default:
        return undefined;
    }
  }

  private snapshotTrace(
    index: number,
    event: IdentityReplayEvent,
    runner: IdentityScenarioRunner,
    key: string,
    note?: string,
  ): ReplayTraceEntry {
    const k = key || 'unknown';
    return {
      index,
      event,
      dbAfter: key ? runner.db.getCardId(k) : '',
      cacheL1: key ? (runner.cache.l1.get(k) ?? null) : null,
      cacheL2: key ? (runner.cache.l2.get(k) ?? null) : null,
      note,
    };
  }

  private diffKey(
    runner: IdentityScenarioRunner,
    key: string,
  ): ReplayStateDiff {
    const k = key.toLowerCase();
    const dbValue = runner.db.getCardId(k);
    const cacheL1 = runner.cache.l1.get(k) ?? null;
    const cacheL2 = runner.cache.l2.get(k) ?? null;
    const cacheEffective = runner.cache.l2Connected
      ? cacheL2
      : cacheL1;
    const aligned =
      dbValue === ''
        ? cacheEffective === null || cacheEffective === ''
        : cacheEffective === dbValue;
    return { key: k, dbValue, cacheEffective, cacheL1, cacheL2, aligned };
  }
}

/** Assert replay completed with zero invariant violations. */
export function assertReplayClean(result: ReplayResult): void {
  if (result.violations.length > 0) {
    const summary = result.violations
      .map((v) => `[${v.invariant}]@${v.atIndex} ${v.key}: ${v.detail}`)
      .join('\n');
    throw new Error(`Replay invariant violations:\n${summary}`);
  }
}

export function formatReplayDiff(result: ReplayResult): string {
  return result.diffs
    .map(
      (d) =>
        `${d.key} db=${d.dbValue || '∅'} l1=${d.cacheL1 ?? '∅'} l2=${d.cacheL2 ?? '∅'} aligned=${d.aligned}`,
    )
    .join('\n');
}

export function formatReplayTrace(result: ReplayResult): string {
  return result.trace
    .map(
      (t) =>
        `#${t.index} ${t.event.type}${t.note ? ` (${t.note})` : ''} db=${t.dbAfter || '∅'} l1=${t.cacheL1 ?? '∅'} l2=${t.cacheL2 ?? '∅'}`,
    )
    .join('\n');
}
