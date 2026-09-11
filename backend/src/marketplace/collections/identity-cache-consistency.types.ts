/** Shared TTL for identity cache repair writes (L1 + L2). */
export const IDENTITY_CACHE_TTL_MS = 3 * 60 * 1000;

export type {
  CacheExecutionCommand,
  CacheExecutionOp,
  CacheExecutionResult,
  IdentityCacheState,
} from './identity-cache-execution.types';
/**
 * Drift kinds for cache-vs-DB comparison.
 *
 * Policy ownership: classification lives only in {@link IdentityCacheDecisionEngine}.
 * `cache_phantom` is a defensive fall-through (normally unreachable given current rules).
 */
export type IdentityDriftKind =
  | 'match'
  | 'cache_stale'
  | 'cache_ahead'
  | 'cache_phantom'
  | 'miss';

export type IdentityRepairAction = 'skip' | 'set' | 'evict' | 'evict_then_set';

export type IdentityConsistencyContext =
  | 'read_sync'
  | 'read_async'
  | 'read_populate'
  | 'read_l1_probe'
  | 'reconcile';

export interface IdentityCacheDecisionInput {
  cacheExists: boolean;
  cachedValue: string | null;
  dbValue: string;
}

export interface IdentityCacheDecision {
  driftKind: IdentityDriftKind;
  action: IdentityRepairAction;
  dbValue: string;
}

export interface IdentityConsistencyResult {
  returnValue: string | null;
  driftKind: IdentityDriftKind;
  action: IdentityRepairAction;
  repaired: boolean;
  skippedCooldown: boolean;
}

export type IdentityReconciliationOutcome =
  | 'hit'
  | 'miss'
  | 'repair'
  | 'skipped';

export interface IdentityCacheExecuteResult {
  repaired: boolean;
  skippedCooldown: boolean;
}
