import { Injectable, Optional } from '@nestjs/common';
import { CardhedgerMetricsService } from '../../common/metrics/cardhedger-metrics.service';
import {
  IDENTITY_CACHE_DEFAULT_TTL_MS,
  InProcessIdentityCacheProvider,
  type IdentityCacheProvider,
} from './identity-cache.provider';
import { RedisIdentityCacheProvider } from './redis-identity-cache.provider';

type CacheLayer = 'l1' | 'l2';

/**
 * Two-tier identity cache: L2 Redis (authoritative) + L1 in-process (fast local reads).
 *
 * Read order:  L2 → L1. On L2 hit, L1 is refreshed.
 * Write order: L2 → L1. Redis is authoritative across pods.
 *
 * Hit/miss metrics are recorded in {@link exists} only — callers such as
 * `CollectionIdentityService.readOrResolve` use exists → get, so recording in
 * both would double-count.
 *
 * P3.19: no per-operation cache logs — metrics only.
 */
@Injectable()
export class LayeredIdentityCacheProvider implements IdentityCacheProvider {
  constructor(
    private readonly l1: InProcessIdentityCacheProvider,
    private readonly l2: RedisIdentityCacheProvider,
    @Optional() private readonly metrics?: CardhedgerMetricsService,
  ) {}

  async get(key: string): Promise<string | null> {
    if (this.l2.isEnabled()) {
      const l2Exists = await this.l2.exists(key);
      if (l2Exists) {
        const value = await this.l2.get(key);
        await this.l1.set(key, value, IDENTITY_CACHE_DEFAULT_TTL_MS);
        return value;
      }
      if (this.l2.isConnected()) {
        await this.l1.delete(key);
        return null;
      }
    }

    return this.l1.get(key);
  }

  async set(key: string, value: string | null, ttlMs: number): Promise<void> {
    let l2Stored = true;
    if (this.l2.isEnabled()) {
      l2Stored = await this.l2.trySet(key, value, ttlMs);
    }
    if (!this.l2.isEnabled()) {
      await this.l1.set(key, value, ttlMs);
      this.metrics?.recordIdentityCacheWrite('l1_only');
      return;
    }
    if (l2Stored) {
      await this.l1.set(key, value, ttlMs);
      this.metrics?.recordIdentityCacheWrite('l2_l1');
      return;
    }
    this.metrics?.recordIdentityCacheWrite('l2_failed_skip_l1');
  }

  async exists(key: string): Promise<boolean> {
    if (this.l2.isEnabled()) {
      const l2Exists = await this.l2.exists(key);
      if (l2Exists) {
        this.recordHit('l2');
        return true;
      }
      if (this.l2.isConnected()) {
        await this.l1.delete(key);
        this.recordMiss('l2');
        return false;
      }
      this.recordMiss('l2');
    }

    const l1Exists = await this.l1.exists(key);
    if (l1Exists) {
      this.recordHit('l1');
      return true;
    }

    this.recordMiss('l1');
    return false;
  }

  async delete(key: string): Promise<void> {
    await this.l1.delete(key);
    if (this.l2.isEnabled()) {
      await this.l2.delete(key);
    }
  }

  /**
   * Read-path probe: L2 miss while L1 still holds a value (pre-eviction window or
   * Redis disconnected). Used by {@link CollectionIdentityService} for L1 stale mitigation.
   */
  async probeL2MissL1Hit(key: string): Promise<string | null> {
    if (!this.l2.isEnabled()) return null;

    const l2Exists = await this.l2.exists(key);
    if (l2Exists) return null;

    if (this.l2.isConnected()) {
      const l1Value = await this.l1.get(key);
      return l1Value ?? null;
    }

    return null;
  }

  private recordHit(layer: CacheLayer): void {
    this.metrics?.recordIdentityCacheHit(layer);
  }

  private recordMiss(layer: CacheLayer): void {
    this.metrics?.recordIdentityCacheMiss(layer);
  }
}
