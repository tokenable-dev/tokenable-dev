/**
 * Pluggable TTL cache — memory today, Redis tomorrow.
 * Namespaces isolate Cardhedger resolve/prices/history keys.
 */
export interface TtlCacheProvider {
  get<T>(namespace: string, key: string): T | undefined;
  set<T>(namespace: string, key: string, value: T, ttlMs: number): void;
  delete(namespace: string, key: string): void;
  clearNamespace(namespace: string): void;
}

export const TTL_CACHE_PROVIDER = Symbol('TTL_CACHE_PROVIDER');
