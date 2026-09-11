import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CardhedgerMetricsService } from '../../common/metrics/cardhedger-metrics.service';
import { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import type {
  CacheExecutionCommand,
  CacheExecutionResult,
  IdentityCacheState,
} from './identity-cache-execution.types';
import { IDENTITY_CACHE_TTL_MS } from './identity-cache-consistency.types';
import {
  IDENTITY_CACHE_PROVIDER,
  type IdentityCacheProvider,
} from './identity-cache.provider';
import { LayeredIdentityCacheProvider } from './layered-identity-cache.provider';

/** Dedup window for repair DB loads and cache mutations per key. */
const REPAIR_COOLDOWN_MS = 10_000;
/** Prune expired cooldown entries when map exceeds this size (P3.17). */
const REPAIR_COOLDOWN_MAX_ENTRIES = 10_000;

/**
 * Pure IO boundary for identity cache (P3.12).
 *
 * No drift classification, no policy enums, no decision engine dependency.
 * No logging (P3.21).
 */
@Injectable()
export class IdentityCacheExecutionService {
  private readonly repairCooldownUntil = new Map<string, number>();
  private readonly repairInFlight = new Map<string, Promise<void>>();
  private readonly dbLoadInFlight = new Map<string, Promise<string>>();

  constructor(
    @InjectRepository(MarketplaceCollection)
    private readonly collectionRepo: Repository<MarketplaceCollection>,
    @Inject(IDENTITY_CACHE_PROVIDER)
    private readonly cache: IdentityCacheProvider,
    @Optional() private readonly layeredCache?: LayeredIdentityCacheProvider,
    @Optional() private readonly metrics?: CardhedgerMetricsService,
  ) {}

  async loadDbCardId(key: string): Promise<string> {
    const normalized = key.toLowerCase();
    const pending = this.dbLoadInFlight.get(normalized);
    if (pending) return pending;

    const promise = (async () => {
      const row = await this.collectionRepo.findOne({
        where: { collectionKey: normalized },
      });
      return row ? this.storedCardId(row.components) : '';
    })();

    this.dbLoadInFlight.set(normalized, promise);
    try {
      return await promise;
    } finally {
      this.dbLoadInFlight.delete(normalized);
    }
  }

  async readCacheState(
    key: string,
  ): Promise<{ cacheExists: boolean; cachedValue: string | null }> {
    const normalized = key.toLowerCase();
    const cacheExists = await this.cache.exists(normalized);
    const cachedValue = cacheExists ? await this.cache.get(normalized) : null;
    return { cacheExists, cachedValue };
  }

  async loadState(key: string): Promise<IdentityCacheState> {
    const normalized = key.toLowerCase();
    const dbValue = await this.loadDbCardId(normalized);
    const { cacheExists, cachedValue } = await this.readCacheState(normalized);
    return { cacheExists, cachedValue, dbValue };
  }

  async probeL2MissL1Hit(key: string): Promise<string | null> {
    return (await this.layeredCache?.probeL2MissL1Hit(key)) ?? null;
  }

  async execute(command: CacheExecutionCommand): Promise<CacheExecutionResult> {
    const normalized = command.key.toLowerCase();

    if (command.op === 'noop') {
      return { applied: false, skippedCooldown: false };
    }

    if (!command.bypassCooldown && this.isRepairCooldown(normalized)) {
      this.metrics?.recordIdentityCacheRepair('skipped_cooldown');
      return { applied: false, skippedCooldown: true };
    }

    const running = this.repairInFlight.get(normalized);
    if (running) {
      await running;
      return { applied: false, skippedCooldown: false };
    }

    const task = (async () => {
      if (!command.bypassCooldown) this.markRepairCooldown(normalized);

      switch (command.op) {
        case 'set':
          if (command.value) {
            await this.cache.set(
              normalized,
              command.value,
              command.ttlMs ?? IDENTITY_CACHE_TTL_MS,
            );
            this.metrics?.recordIdentityCacheRepair('set');
          }
          return;
        case 'delete':
          await this.cache.delete(normalized);
          this.metrics?.recordIdentityCacheRepair('evict');
          return;
        case 'replace':
          await this.cache.delete(normalized);
          if (command.value) {
            await this.cache.set(
              normalized,
              command.value,
              command.ttlMs ?? IDENTITY_CACHE_TTL_MS,
            );
            this.metrics?.recordIdentityCacheRepair('set');
          }
          return;
        default:
          return;
      }
    })();

    this.repairInFlight.set(normalized, task);
    try {
      await task;
      return { applied: true, skippedCooldown: false };
    } finally {
      this.repairInFlight.delete(normalized);
    }
  }

  private storedCardId(comp: Record<string, unknown>): string {
    return typeof comp.cardhedgerCardId === 'string'
      ? comp.cardhedgerCardId.trim()
      : '';
  }

  private isRepairCooldown(key: string): boolean {
    const until = this.repairCooldownUntil.get(key);
    return until != null && Date.now() < until;
  }

  private markRepairCooldown(key: string): void {
    this.repairCooldownUntil.set(key, Date.now() + REPAIR_COOLDOWN_MS);
    this.pruneExpiredRepairCooldowns();
  }

  private pruneExpiredRepairCooldowns(): void {
    if (this.repairCooldownUntil.size <= REPAIR_COOLDOWN_MAX_ENTRIES) return;
    const now = Date.now();
    for (const [key, until] of this.repairCooldownUntil) {
      if (until <= now) this.repairCooldownUntil.delete(key);
    }
  }
}
