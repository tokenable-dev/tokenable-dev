/**
 * P3.14 — Production-fidelity replay against real TypeORM + Redis infrastructure.
 */

import { identityCacheRedisKey } from './identity-cache.provider';
import { IDENTITY_CACHE_TTL_MS } from './identity-cache-consistency.types';
import {
  checkReplayInvariants,
  computeAligned,
} from './identity-cache-replay-invariants';
import type {
  IdentityReplayEvent,
  ReplayResult,
  ReplayStateDiff,
  ReplayTraceEntry,
} from './identity-cache-replay.types';
import { IdentityCacheReplayEngine } from './identity-cache-replay.engine';
import {
  createSeededRng,
  pickSeeded,
} from './identity-cache-simulation.harness';
import type { IdentityIntegrationHarness } from './testing/identity-cache-integration.harness';
import {
  readDbCardId,
  readL1Direct,
  readRedisL2,
  seedCollectionRow,
} from './testing/identity-cache-integration.harness';

export class IdentityCacheProductionReplayEngine {
  private harness: IdentityIntegrationHarness | null = null;
  private readonly simulation = new IdentityCacheReplayEngine();

  async open(harness: IdentityIntegrationHarness): Promise<void> {
    this.harness = harness;
  }

  async close(): Promise<void> {
    this.harness = null;
  }

  async replay(events: IdentityReplayEvent[], seed = 42): Promise<ReplayResult> {
    if (!this.harness) throw new Error('Production replay harness not open');

    const trace: ReplayTraceEntry[] = [];
    const violations: ReplayResult['violations'] = [];
    const rng = createSeededRng(seed);

    for (let index = 0; index < events.length; index++) {
      const event = events[index];
      const note = await this.applyEvent(event, rng);
      const key = 'key' in event ? event.key.toLowerCase() : '';
      trace.push(await this.snapshotTrace(index, event, key, note));
      const diff = key ? await this.diffKey(key) : null;
      if (diff) checkReplayInvariants(event, index, diff.dbValue, diff, violations);
    }

    const keys = [
      ...new Set(
        events
          .filter((e) => 'key' in e)
          .map((e) => (e as IdentityReplayEvent & { key: string }).key.toLowerCase()),
      ),
    ];
    const diffs: ReplayStateDiff[] = [];
    for (const key of keys) diffs.push(await this.diffKey(key));

    return { seed, runtime: 'production', trace, diffs, violations };
  }

  /** Compare simulation vs production final state for parity (P3.14). */
  async compareParity(
    events: IdentityReplayEvent[],
    seed: number,
    harness: IdentityIntegrationHarness,
  ): Promise<{
    dbParity: boolean;
    alignedParity: boolean;
    mismatches: string[];
    simulation: ReplayResult;
    production: ReplayResult;
  }> {
    const simulation = await this.simulation.replay(events, seed);
    await this.open(harness);
    const production = await this.replay(events, seed);
    await this.close();

    const mismatches: string[] = [];
    const simByKey = new Map(simulation.diffs.map((d) => [d.key, d]));
    for (const prod of production.diffs) {
      const sim = simByKey.get(prod.key);
      if (!sim) {
        mismatches.push(`missing simulation diff for ${prod.key}`);
        continue;
      }
      if (sim.dbValue !== prod.dbValue) {
        mismatches.push(
          `${prod.key} db sim=${sim.dbValue} prod=${prod.dbValue}`,
        );
      }
      if (sim.aligned !== prod.aligned) {
        mismatches.push(
          `${prod.key} aligned sim=${sim.aligned} prod=${prod.aligned}`,
        );
      }
    }

    return {
      dbParity: mismatches.every((m) => !m.includes(' db ')),
      alignedParity: mismatches.every((m) => !m.includes('aligned')),
      mismatches,
      simulation,
      production,
    };
  }

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
    event: IdentityReplayEvent,
    _rng: () => number,
  ): Promise<string | undefined> {
    const h = this.harness!;

    switch (event.type) {
      case 'db_persist_if_empty': {
        await seedCollectionRow(h.repo, event.key);
        await h.identity.writeFromCertLookup(event.key, event.cardId);
        const db = await readDbCardId(h.repo, event.key);
        return db === event.cardId ? 'persist_ok' : 'persist_blocked';
      }
      case 'db_set':
        await seedCollectionRow(h.repo, event.key, event.cardId);
        return 'db_set';
      case 'db_audit_clear': {
        const result = await h.identity.clearCardhedgerCardIdIfUnchanged(
          event.key,
          event.expectedId,
        );
        return result.cleared ? 'audit_cleared' : 'audit_skipped';
      }
      case 'cache_write_through': {
        const command = h.decision.buildExecutionCommand(
          event.key,
          event.hint ? 'set' : 'evict',
          event.hint ?? '',
          true,
        );
        await h.execution.execute(command);
        return 'write_through';
      }
      case 'read_repair':
        await h.identity.readOrResolve(event.key);
        return 'read_repair';
      case 'reconcile':
        await this.reconcileKey(event.key, () => event.allowRepair);
        return 'reconcile';
      case 'inject_l2_write_fail':
      case 'inject_l2_read_fail':
      case 'inject_l2_disconnect':
        h.l2.applyFault(event);
        return event.type;
      case 'inject_split_brain': {
        const k = event.key.toLowerCase();
        if (event.clearL2) {
          await h.redisReader.del(identityCacheRedisKey(k));
        }
        await h.l1.set(k, event.l1Value, IDENTITY_CACHE_TTL_MS);
        return 'split_brain';
      }
      default:
        return undefined;
    }
  }

  private async reconcileKey(
    key: string,
    allowRepair: () => boolean,
  ): Promise<void> {
    const h = this.harness!;
    const state = await h.execution.loadState(key);
    const decision = h.decision.decideFromState(state);
    const command = h.decision.buildExecutionCommand(
      key,
      decision.action,
      decision.dbValue,
      false,
    );
    if (h.decision.isExecutable(command) && allowRepair()) {
      await h.execution.execute(command);
    }
  }

  private async snapshotTrace(
    index: number,
    event: IdentityReplayEvent,
    key: string,
    note?: string,
  ): Promise<ReplayTraceEntry> {
    const h = this.harness!;
    const k = key || 'unknown';
    return {
      index,
      event,
      runtime: 'production',
      dbAfter: key ? await readDbCardId(h.repo, k) : '',
      cacheL1: key ? await readL1Direct(h.l1, k) : null,
      cacheL2: key ? await readRedisL2(h.redisReader, k) : null,
      note,
    };
  }

  private async diffKey(key: string): Promise<ReplayStateDiff> {
    const h = this.harness!;
    const k = key.toLowerCase();
    const dbValue = await readDbCardId(h.repo, k);
    const cacheL1 = await readL1Direct(h.l1, k);
    const cacheL2 = await readRedisL2(h.redisReader, k);
    const cacheEffective = h.l2.isConnected() ? cacheL2 : cacheL1;
    return {
      key: k,
      dbValue,
      cacheEffective,
      cacheL1,
      cacheL2,
      aligned: computeAligned(dbValue, cacheEffective),
    };
  }
}
