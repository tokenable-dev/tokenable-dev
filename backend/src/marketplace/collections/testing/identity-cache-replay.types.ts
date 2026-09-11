import type { IdentityConsistencyContext } from '../identity-cache-consistency.types';

// ---------------------------------------------------------------------------
// Shared replay event model (simulation + production)
// ---------------------------------------------------------------------------

export type IdentityReplayEvent =
  | { type: 'db_persist_if_empty'; key: string; cardId: string }
  | { type: 'db_set'; key: string; cardId: string }
  | { type: 'db_audit_clear'; key: string; expectedId: string }
  | { type: 'cache_write_through'; key: string; hint: string | null }
  | { type: 'read_repair'; key: string; context: IdentityConsistencyContext }
  | { type: 'reconcile'; key: string; allowRepair: boolean }
  | { type: 'inject_l2_write_fail'; enabled: boolean }
  | { type: 'inject_l2_read_fail'; enabled: boolean }
  | { type: 'inject_l2_disconnect'; connected: boolean }
  | { type: 'inject_split_brain'; key: string; l1Value: string; clearL2: boolean }
  /** P3.16 — DB committed; cache write-through fails (partial projection). */
  | { type: 'inject_db_commit_cache_write_fail'; key: string; cardId: string }
  /** P3.16 — stale replica read overrides authoritative DB in decision input. */
  | { type: 'inject_db_replication_lag'; key: string; staleCardId: string }
  /** P3.16 — Redis failover: stale L2 + write partition. */
  | { type: 'inject_redis_failover'; key: string; staleL2Value: string }
  /** P3.16 — event loop / GC stall proxy before repair execute. */
  | { type: 'inject_repair_stall'; key: string; stallMs: number };

/** P3.15 — chaos extensions layered on top of identity replay events. */
export type ChaosReplayEvent =
  | IdentityReplayEvent
  | { type: 'chaos_pod_restart' }
  | { type: 'chaos_db_lock_hold'; key: string; holdMs: number }
  | {
      type: 'chaos_concurrent_burst';
      ops: IdentityReplayEvent[];
    }
  | { type: 'chaos_clock_skew'; ttlSkewMs: number }
  | { type: 'chaos_redis_partition'; enabled: boolean };

export interface ReplayTraceEntry {
  index: number;
  event: IdentityReplayEvent | ChaosReplayEvent;
  dbAfter: string;
  cacheL1: string | null;
  cacheL2: string | null;
  note?: string;
  runtime?: 'simulation' | 'production';
}

export interface ReplayStateDiff {
  key: string;
  dbValue: string;
  cacheEffective: string | null;
  cacheL1: string | null;
  cacheL2: string | null;
  aligned: boolean;
}

export type InvariantId =
  | 'I1_db_authoritative'
  | 'I2_no_stale_overwrite_after_repair'
  | 'I3_write_first_wins'
  | 'I4_audit_no_erase_newer'
  | 'I5_eventual_convergence';

export interface InvariantViolation {
  invariant: InvariantId;
  atIndex: number;
  key: string;
  detail: string;
}

export interface ReplayResult {
  seed: number;
  runtime: 'simulation' | 'production';
  trace: ReplayTraceEntry[];
  diffs: ReplayStateDiff[];
  violations: InvariantViolation[];
}

export interface ParityReport {
  seed: number;
  simulation: ReplayResult;
  production: ReplayResult;
  dbParity: boolean;
  alignedParity: boolean;
  mismatches: string[];
}
