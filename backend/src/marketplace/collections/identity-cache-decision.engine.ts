import { Injectable } from '@nestjs/common';
import type {
  CacheExecutionCommand,
  IdentityCacheState,
} from './identity-cache-execution.types';
import {
  IDENTITY_CACHE_TTL_MS,
  type IdentityCacheDecision,
  type IdentityCacheDecisionInput,
  type IdentityCacheSnapshot,
  type IdentityConsistencyContext,
  type IdentityDriftKind,
  type IdentityRepairAction,
} from './identity-cache-consistency.types';

/**
 * Pure cache-vs-DB decision layer (P3.8 / P3.10).
 *
 * **Policy ownership:** This class is the system-wide single source of truth for
 * drift classification, repair action selection, read-path return resolution,
 * reconciliation bucketing, and context-specific policy gates.
 *
 * Explicit exceptions (DB-authoritative, not drift repair):
 * - Write-through (`applyPostCommitCache`) — post-commit hint from locked TX
 * - Audit clear (`clearCardhedgerCardIdIfUnchanged`) — conditional DB clear under lock
 *
 * No IO, no side effects — classification and action selection only.
 *
 * | Drift        | Action          |
 * |--------------|-----------------|
 * | match        | skip            |
 * | cache_stale  | evict + set DB  |
 * | cache_phantom| set DB          |
 * | cache_ahead  | skip            |
 * | miss         | set DB          |
 */
@Injectable()
export class IdentityCacheDecisionEngine {
  classify(
    cacheExists: boolean,
    cachedValue: string | null,
    dbValue: string,
  ): IdentityDriftKind {
    if (!cacheExists) {
      return dbValue ? 'miss' : 'match';
    }
    const cached = cachedValue ?? '';
    if (cached === dbValue) return 'match';
    if (dbValue && cached !== dbValue) return 'cache_stale';
    if (!dbValue && cached) return 'cache_ahead';
    return 'cache_phantom';
  }

  decideAction(
    driftKind: IdentityDriftKind,
    dbValue: string,
  ): IdentityRepairAction {
    switch (driftKind) {
      case 'match':
      case 'cache_ahead':
        return 'skip';
      case 'cache_stale':
        return 'evict_then_set';
      case 'cache_phantom':
      case 'miss':
        return dbValue ? 'set' : 'evict';
      default:
        return 'skip';
    }
  }

  decide(input: IdentityCacheDecisionInput): IdentityCacheDecision {
    const driftKind = this.classify(
      input.cacheExists,
      input.cachedValue,
      input.dbValue,
    );
    return {
      driftKind,
      action: this.decideAction(driftKind, input.dbValue),
      dbValue: input.dbValue,
    };
  }

  decideFromState(state: IdentityCacheState): IdentityCacheDecision {
    return this.decide({
      cacheExists: state.cacheExists,
      cachedValue: state.cachedValue,
      dbValue: state.dbValue,
    });
  }

  /** @deprecated Use {@link decideFromState} — retained for snapshot-shaped inputs. */
  decideFromSnapshot(snapshot: IdentityCacheSnapshot): IdentityCacheDecision {
    return this.decideFromState(snapshot);
  }

  /** Map policy action → pure IO command (P3.12). */
  buildExecutionCommand(
    key: string,
    action: IdentityRepairAction,
    dbValue: string,
    bypassCooldown: boolean,
  ): CacheExecutionCommand {
    const normalized = key.toLowerCase();
    switch (action) {
      case 'skip':
        return { key: normalized, op: 'noop', bypassCooldown };
      case 'set':
        return dbValue
          ? {
              key: normalized,
              op: 'set',
              value: dbValue,
              ttlMs: IDENTITY_CACHE_TTL_MS,
              bypassCooldown,
            }
          : { key: normalized, op: 'delete', bypassCooldown };
      case 'evict':
        return { key: normalized, op: 'delete', bypassCooldown };
      case 'evict_then_set':
        return {
          key: normalized,
          op: 'replace',
          value: dbValue || undefined,
          ttlMs: IDENTITY_CACHE_TTL_MS,
          bypassCooldown,
        };
      default:
        return { key: normalized, op: 'noop', bypassCooldown };
    }
  }

  isExecutable(command: CacheExecutionCommand): boolean {
    return command.op !== 'noop';
  }

  /** Pure drift event descriptor — caller emits via {@link IdentityStructuredLogger}. */
  describeDriftEvent(
    driftKind: IdentityDriftKind,
  ): { level: 'warn' | 'debug'; driftKind: IdentityDriftKind } | null {
    if (driftKind === 'match' || driftKind === 'miss') return null;
    if (driftKind === 'cache_ahead') {
      return { level: 'debug', driftKind };
    }
    return { level: 'warn', driftKind };
  }

  resolveReturnValue(
    driftKind: IdentityDriftKind,
    dbValue: string,
    cachedValue: string | null,
    repaired: boolean,
    context: IdentityConsistencyContext,
  ): string | null {
    if (context === 'read_sync' || context === 'read_l1_probe') {
      if (driftKind === 'cache_stale' && (repaired || dbValue)) {
        return dbValue || null;
      }
    }
    if (context === 'read_populate') {
      return dbValue || null;
    }
    if (repaired && driftKind !== 'cache_ahead' && dbValue) {
      return dbValue;
    }
    return cachedValue || dbValue || null;
  }

  /** Reconciliation metric bucket from a decision (pure mapping). */
  reconciliationOutcome(
    decision: IdentityCacheDecision,
    executeResult: { repaired: boolean; skippedCooldown: boolean },
    repairAllowed: boolean,
  ): 'hit' | 'miss' | 'repair' | 'skipped' {
    if (decision.driftKind === 'match') return 'hit';
    if (decision.driftKind === 'cache_ahead') return 'miss';
    if (decision.action === 'skip') return 'miss';
    if (!repairAllowed) return 'skipped';
    if (executeResult.skippedCooldown) return 'skipped';
    return executeResult.repaired ? 'repair' : 'miss';
  }

  /** Whether sampled drift metrics should be recorded for this context/kind. */
  shouldRecordDriftMetric(
    context: IdentityConsistencyContext,
    driftKind: IdentityDriftKind,
  ): boolean {
    return (
      (context === 'read_sync' || context === 'read_async') &&
      driftKind !== 'miss'
    );
  }

  /** Whether repair cooldown is bypassed (populate path writes immediately). */
  shouldBypassRepairCooldown(context: IdentityConsistencyContext): boolean {
    return context === 'read_populate';
  }

  /**
   * Whether a sync read-path hit should return the repair result instead of
   * the stale cached value (cache_stale only).
   */
  shouldOverrideCacheHitReturn(
    context: IdentityConsistencyContext,
    driftKind: IdentityDriftKind,
  ): boolean {
    return context === 'read_sync' && driftKind === 'cache_stale';
  }
}
