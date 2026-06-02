/**
 * Pluggable cache abstraction for `collection.components.cardhedgerCardId`.
 *
 * **P2 architecture:**
 *   CollectionIdentityService → LayeredIdentityCacheProvider
 *     ├── L1 InProcessIdentityCacheProvider (process-local Map)
 *     └── L2 RedisIdentityCacheProvider    (when `REDIS_URL` is set)
 *
 * When `REDIS_URL` is absent, LayeredIdentityCacheProvider skips L2 and
 * behaves identically to L1-only mode.
 */

import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default TTL for identity cache entries (L1 + L2). */
export const IDENTITY_CACHE_DEFAULT_TTL_MS = 3 * 60 * 1000; // 3 min

/** Default L1 expired-key sweep interval (P3.18). */
export const IDENTITY_L1_SWEEP_INTERVAL_MS_DEFAULT = 5 * 60 * 1000; // 5 min

/** Redis sentinel stored when the cached cardhedgerCardId is explicitly null. */
export const IDENTITY_CACHE_NULL_SENTINEL = '__null__';

/** Redis key prefix — full key: `identity:cardhedger:{collectionKey}`. */
export const IDENTITY_CACHE_KEY_PREFIX = 'identity:cardhedger:';

export function identityCacheRedisKey(collectionKey: string): string {
  return `${IDENTITY_CACHE_KEY_PREFIX}${collectionKey.toLowerCase()}`;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Async cache for collection cardhedgerCardId values.
 *
 * `get` returns `null` for both "not in cache" and "value is null".
 * Use `exists` to distinguish these two cases when caching null tombstones.
 */
export interface IdentityCacheProvider {
  get(key: string): Promise<string | null>;
  set(key: string, value: string | null, ttlMs: number): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** Remove a key from all layers. Idempotent — no-op when absent. */
  delete(key: string): Promise<void>;
}

export const IDENTITY_CACHE_PROVIDER = Symbol('IDENTITY_CACHE_PROVIDER');

// ---------------------------------------------------------------------------
// L1 — process-local TTL Map
// ---------------------------------------------------------------------------

/**
 * In-process TTL cache backed by a `Map`.
 * Used as L1 in {@link LayeredIdentityCacheProvider}.
 *
 * P3.18: periodic sweep removes expired entries that were never read again,
 * preventing unbounded Map growth without changing cache semantics.
 */
@Injectable()
export class InProcessIdentityCacheProvider
  implements IdentityCacheProvider, OnModuleInit, OnModuleDestroy
{
  private readonly map = new Map<
    string,
    { value: string | null; expiresAt: number }
  >();

  private readonly sweepIntervalMs: number;
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(private readonly config: ConfigService) {
    this.sweepIntervalMs = parseSweepIntervalMs(
      this.config.get<string>('IDENTITY_L1_SWEEP_INTERVAL_MS'),
    );
  }

  onModuleInit(): void {
    this.sweepTimer = setInterval(() => {
      this.sweepExpired();
    }, this.sweepIntervalMs);
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
  }

  async get(key: string): Promise<string | null> {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string | null, ttlMs: number): Promise<void> {
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.map.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return false;
    }
    return true;
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }

  /** TTL-based cleanup only — does not evict live (unexpired) entries. */
  sweepExpired(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.map) {
      if (now > entry.expiresAt) {
        this.map.delete(key);
        removed++;
      }
    }
    return removed;
  }
}

function parseSweepIntervalMs(raw: string | undefined): number {
  const n = Number(raw ?? IDENTITY_L1_SWEEP_INTERVAL_MS_DEFAULT);
  if (!Number.isFinite(n)) return IDENTITY_L1_SWEEP_INTERVAL_MS_DEFAULT;
  return Math.min(3_600_000, Math.max(60_000, Math.floor(n)));
}
