/** Pure IO command vocabulary — no drift / policy semantics (P3.12). */
export type CacheExecutionOp = 'noop' | 'set' | 'delete' | 'replace';

/** Side-effect instruction emitted by {@link IdentityCacheDecisionEngine}. */
export interface CacheExecutionCommand {
  key: string;
  op: CacheExecutionOp;
  /** Required for `set` and `replace` when a value should be stored. */
  value?: string;
  ttlMs?: number;
  bypassCooldown: boolean;
}

/** Result of applying a {@link CacheExecutionCommand}. */
export interface CacheExecutionResult {
  applied: boolean;
  skippedCooldown: boolean;
}

/** Raw cache + DB observation — no classification (P3.12 IO boundary). */
export interface IdentityCacheState {
  cacheExists: boolean;
  cachedValue: string | null;
  dbValue: string;
}
