import { Injectable } from '@nestjs/common';
import type { TtlCacheProvider } from './ttl-cache.interface';

type CacheEntry = { value: unknown; expiresAt: number };

/**
 * Process-local TTL cache with namespace isolation.
 * Replace binding with a Redis-backed provider for multi-instance consistency.
 */
@Injectable()
export class MemoryTtlCacheProvider implements TtlCacheProvider {
  private readonly stores = new Map<string, Map<string, CacheEntry>>();

  get<T>(namespace: string, key: string): T | undefined {
    const store = this.stores.get(namespace);
    if (!store) return undefined;
    const entry = store.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(namespace: string, key: string, value: T, ttlMs: number): void {
    const ttl = Math.max(0, ttlMs);
    let store = this.stores.get(namespace);
    if (!store) {
      store = new Map();
      this.stores.set(namespace, store);
    }
    store.set(key, { value, expiresAt: Date.now() + ttl });
  }

  delete(namespace: string, key: string): void {
    this.stores.get(namespace)?.delete(key);
  }

  clearNamespace(namespace: string): void {
    this.stores.delete(namespace);
  }
}
