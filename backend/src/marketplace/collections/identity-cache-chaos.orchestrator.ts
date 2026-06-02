/**
 * P3.15 — Distributed chaos orchestration on production-fidelity harness.
 */

import { identityCacheRedisKey } from './identity-cache.provider';
import { IDENTITY_CACHE_TTL_MS } from './identity-cache-consistency.types';
import {
  checkReplayInvariants,
  computeAligned,
} from './identity-cache-replay-invariants';
import type {
  ChaosReplayEvent,
  IdentityReplayEvent,
  ReplayResult,
  ReplayStateDiff,
  ReplayTraceEntry,
} from './identity-cache-replay.types';
import { IdentityCacheProductionReplayEngine } from './identity-cache-production-replay.engine';
import { createSeededRng } from './identity-cache-simulation.harness';
import type { IdentityIntegrationHarness } from './testing/identity-cache-integration.harness';
import {
  readDbCardId,
  readL1Direct,
  readRedisL2,
  seedCollectionRow,
} from './testing/identity-cache-integration.harness';
import { MarketplaceCollection } from '../entities/marketplace-collection.entity';

export interface ChaosOrchestrationResult extends ReplayResult {
  chaosTrace: string[];
}

export class IdentityCacheChaosOrchestrator {
  private harness: IdentityIntegrationHarness | null = null;
  private podB: IdentityIntegrationHarness | null = null;
  private ttlSkewMs = 0;
  private readonly production = new IdentityCacheProductionReplayEngine();

  async open(harness: IdentityIntegrationHarness): Promise<void> {
    this.harness = harness;
    await this.production.open(harness);
  }

  async close(): Promise<void> {
    await this.production.close();
    if (this.podB) await this.podB.close();
    this.podB = null;
    this.harness = null;
    this.ttlSkewMs = 0;
  }

  async replayChaos(
    events: ChaosReplayEvent[],
    seed = 42,
  ): Promise<ChaosOrchestrationResult> {
    if (!this.harness) throw new Error('Chaos orchestrator not open');

    const trace: ReplayTraceEntry[] = [];
    const chaosTrace: string[] = [];
    const violations: ReplayResult['violations'] = [];
    const rng = createSeededRng(seed);

    for (let index = 0; index < events.length; index++) {
      const event = events[index];
      const note = await this.applyChaosEvent(event, rng);
      chaosTrace.push(
        `#${index} ${event.type}${note ? ` → ${note}` : ''} seed=${seed}`,
      );

      if (this.isIdentityReplayEvent(event)) {
        const key = event.key.toLowerCase();
        trace.push(await this.snapshotTrace(index, event, key, note));
        const diff = await this.diffKey(key);
        checkReplayInvariants(event, index, diff.dbValue, diff, violations);
      } else {
        trace.push({
          index,
          event,
          runtime: 'production',
          dbAfter: '',
          cacheL1: null,
          cacheL2: null,
          note,
        });
      }
    }

    const keys = this.collectKeys(events);
    const diffs: ReplayStateDiff[] = [];
    for (const key of keys) diffs.push(await this.diffKey(key));

    return {
      seed,
      runtime: 'production',
      trace,
      diffs,
      violations,
      chaosTrace,
    };
  }

  private isIdentityReplayEvent(
    event: ChaosReplayEvent,
  ): event is IdentityReplayEvent & { key: string } {
    if (event.type.startsWith('chaos_')) return false;
    return 'key' in event;
  }

  private collectKeys(events: ChaosReplayEvent[]): string[] {
    const keys = new Set<string>();
    for (const e of events) {
      if ('key' in e) keys.add(e.key.toLowerCase());
      if (e.type === 'chaos_concurrent_burst') {
        for (const op of e.ops) {
          if ('key' in op) keys.add(op.key.toLowerCase());
        }
      }
    }
    return [...keys];
  }

  private async applyChaosEvent(
    event: ChaosReplayEvent,
    rng: () => number,
  ): Promise<string | undefined> {
    const h = this.harness!;

    if (this.isIdentityReplayEvent(event)) {
      return this.applyIdentityEvent(event);
    }

    switch (event.type) {
      case 'chaos_pod_restart': {
        if (this.podB) await this.podB.close();
        this.podB = await h.spawnPod();
        return 'pod_restarted';
      }
      case 'chaos_db_lock_hold':
        await this.holdDbLock(event.key, event.holdMs);
        return `db_lock_hold_${event.holdMs}ms`;
      case 'chaos_concurrent_burst': {
        await Promise.all(
          event.ops.map((op) => this.applyIdentityEvent(op)),
        );
        return `burst_${event.ops.length}`;
      }
      case 'chaos_clock_skew':
        this.ttlSkewMs = event.ttlSkewMs;
        return `ttl_skew_${event.ttlSkewMs}ms`;
      case 'chaos_redis_partition':
        h.l2.applyFault({ type: 'chaos_redis_partition', enabled: event.enabled });
        return event.enabled ? 'redis_partition_on' : 'redis_partition_off';
      default:
        void rng;
        return undefined;
    }
  }

  private async applyIdentityEvent(
    event: IdentityReplayEvent,
  ): Promise<string | undefined> {
    const h = this.harness!;
    const active = this.podB ?? h;

    switch (event.type) {
      case 'db_persist_if_empty': {
        await seedCollectionRow(active.repo, event.key);
        await active.identity.writeFromCertLookup(event.key, event.cardId);
        return 'persist';
      }
      case 'db_set':
        await seedCollectionRow(active.repo, event.key, event.cardId);
        return 'db_set';
      case 'db_audit_clear': {
        const r = await active.identity.clearCardhedgerCardIdIfUnchanged(
          event.key,
          event.expectedId,
        );
        return r.cleared ? 'audit_cleared' : 'audit_skipped';
      }
      case 'cache_write_through': {
        const cmd = active.decision.buildExecutionCommand(
          event.key,
          event.hint ? 'set' : 'evict',
          event.hint ?? '',
          true,
        );
        if (this.ttlSkewMs && cmd.ttlMs) {
          cmd.ttlMs = Math.max(1_000, cmd.ttlMs + this.ttlSkewMs);
        }
        await active.execution.execute(cmd);
        return 'write_through';
      }
      case 'read_repair':
        await active.identity.readOrResolve(event.key);
        return 'read_repair';
      case 'reconcile':
        await this.reconcileOn(active, event.key, () => event.allowRepair);
        return 'reconcile';
      case 'inject_l2_write_fail':
      case 'inject_l2_read_fail':
      case 'inject_l2_disconnect':
        active.l2.applyFault(event);
        return event.type;
      case 'inject_split_brain': {
        const k = event.key.toLowerCase();
        if (event.clearL2) {
          await active.redisReader.del(identityCacheRedisKey(k));
        }
        await active.l1.set(k, event.l1Value, IDENTITY_CACHE_TTL_MS);
        return 'split_brain';
      }
      default:
        return undefined;
    }
  }

  private async reconcileOn(
    harness: IdentityIntegrationHarness,
    key: string,
    allowRepair: () => boolean,
  ): Promise<void> {
    const state = await harness.execution.loadState(key);
    const decision = harness.decision.decideFromState(state);
    const command = harness.decision.buildExecutionCommand(
      key,
      decision.action,
      decision.dbValue,
      false,
    );
    if (harness.decision.isExecutable(command) && allowRepair()) {
      await harness.execution.execute(command);
    }
  }

  private async holdDbLock(key: string, holdMs: number): Promise<void> {
    const h = this.harness!;
    await h.repo.manager.transaction(async (em) => {
      await em.findOne(MarketplaceCollection, {
        where: { collectionKey: key.toLowerCase() },
        lock: { mode: 'pessimistic_write' },
      });
      await sleep(holdMs);
    });
  }

  private async snapshotTrace(
    index: number,
    event: IdentityReplayEvent,
    key: string,
    note?: string,
  ): Promise<ReplayTraceEntry> {
    const h = this.harness!;
    return {
      index,
      event,
      runtime: 'production',
      dbAfter: await readDbCardId(h.repo, key),
      cacheL1: await readL1Direct(h.l1, key),
      cacheL2: await readRedisL2(h.redisReader, key),
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
