import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CollectionMarketSnapshotService } from './collection-market-snapshot.service';
import { Order, OrderSide, OrderStatus } from '../entities/order.entity';
import { CollectionMarketSnapshot } from '../entities/collection-market-snapshot.entity';
import { RwaToken } from '../entities/rwa-token.entity';
import type {
  SnapshotRefreshJob,
  SnapshotRefreshReason,
} from '../utils/market-snapshot.types';

/**
 * Schedules materialized snapshot refresh.
 * In-memory queue today — swap enqueue/process for BullMQ workers later.
 */
@Injectable()
export class CollectionMarketSnapshotSchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(
    CollectionMarketSnapshotSchedulerService.name,
  );
  private readonly queue: SnapshotRefreshJob[] = [];
  private readonly queuedKeys = new Set<string>();
  private processing = false;
  private drainTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: ConfigService,
    @Inject(forwardRef(() => CollectionMarketSnapshotService))
    private readonly snapshotService: CollectionMarketSnapshotService,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(CollectionMarketSnapshot)
    private readonly snapshotRepo: Repository<CollectionMarketSnapshot>,
    @InjectRepository(RwaToken)
    private readonly rwaTokenRepo: Repository<RwaToken>,
  ) {}

  prewarmEnabled(): boolean {
    const raw = this.config.get<string>('MARKET_SNAPSHOT_PREWARM_ENABLED');
    if (raw === '1' || raw === 'true') return true;
    if (raw === '0' || raw === 'false') return false;
    /** Cron off → skip boot snapshot flood (Cardhedger/PSA can starve the HTTP event loop locally). */
    if (!this.cronEnabled()) return false;
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  onModuleInit(): void {
    if (!this.prewarmEnabled()) return;
    const delay = this.prewarmDelayMs();
    if (delay <= 0) return;
    setTimeout(() => {
      void this.runScheduledRefresh('prewarm');
    }, delay);
  }

  onModuleDestroy(): void {
    if (this.drainTimer) clearTimeout(this.drainTimer);
  }

  refreshConcurrency(): number {
    const raw = Number(
      this.config.get<string>('MARKET_SNAPSHOT_REFRESH_CONCURRENCY') ?? '4',
    );
    if (!Number.isFinite(raw) || raw < 1) return 4;
    return Math.min(Math.floor(raw), 16);
  }

  recentFillDays(): number {
    const raw = Number(
      this.config.get<string>('MARKET_SNAPSHOT_RECENT_FILL_DAYS') ?? '30',
    );
    if (!Number.isFinite(raw) || raw < 1) return 30;
    return Math.min(Math.floor(raw), 180);
  }

  viewedLookbackDays(): number {
    const raw = Number(
      this.config.get<string>('MARKET_SNAPSHOT_VIEWED_LOOKBACK_DAYS') ?? '7',
    );
    if (!Number.isFinite(raw) || raw < 1) return 7;
    return Math.min(Math.floor(raw), 90);
  }

  prewarmDelayMs(): number {
    const raw = Number(
      this.config.get<string>('MARKET_SNAPSHOT_PREWARM_DELAY_MS') ?? '8000',
    );
    if (!Number.isFinite(raw) || raw < 0) return 8000;
    return Math.min(Math.floor(raw), 120_000);
  }

  cronEnabled(): boolean {
    const raw = this.config.get<string>('MARKET_SNAPSHOT_CRON_ENABLED');
    return raw !== '0' && raw !== 'false';
  }

  /** Public enqueue API — used by scheduler and stale-while-revalidate hooks. */
  enqueue(collectionKey: string, reason: SnapshotRefreshReason): void {
    const key = collectionKey.toLowerCase();
    if (!key || this.queuedKeys.has(key)) return;
    const priority = this.priorityForReason(reason);
    this.queue.push({
      collectionKey: key,
      reason,
      priority,
      enqueuedAt: Date.now(),
      attempt: 0,
    });
    this.queuedKeys.add(key);
    this.queue.sort((a, b) => b.priority - a.priority || a.enqueuedAt - b.enqueuedAt);
    this.scheduleDrain();
  }

  private priorityForReason(reason: SnapshotRefreshReason): number {
    switch (reason) {
      case 'cold_start':
        return 100;
      case 'stale_swr':
        return 80;
      case 'manual':
        return 60;
      case 'cron':
      default:
        return 40;
    }
  }

  private scheduleDrain(): void {
    if (this.processing) return;
    if (this.drainTimer) return;
    this.drainTimer = setTimeout(() => {
      this.drainTimer = null;
      void this.drainQueue();
    }, 50);
  }

  private async drainQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    const concurrency = this.refreshConcurrency();
    try {
      while (this.queue.length > 0) {
        const batch: SnapshotRefreshJob[] = [];
        while (batch.length < concurrency && this.queue.length > 0) {
          const job = this.queue.shift();
          if (!job) break;
          this.queuedKeys.delete(job.collectionKey);
          batch.push(job);
        }
        await Promise.all(
          batch.map(async (job) => {
            try {
              await this.snapshotService.refreshSnapshot(
                job.collectionKey,
                job.reason,
              );
            } catch (e) {
              this.logger.warn(
                `queue refresh failed key=${job.collectionKey}: ${e instanceof Error ? e.message : String(e)}`,
              );
            }
          }),
        );
        if (this.queue.length > 0) {
          await new Promise((r) => setTimeout(r, 200));
        }
      }
    } finally {
      this.processing = false;
      if (this.queue.length > 0) this.scheduleDrain();
    }
  }

  @Cron('0 */15 * * * *')
  async handleCronTick(): Promise<void> {
    if (!this.cronEnabled()) return;
    await this.runScheduledRefresh('cron');
  }

  /** 09:00 KST daily full refresh for known portfolio collections. */
  @Cron('0 0 0 * * *')
  async handleDailyPortfolioPrewarm(): Promise<void> {
    if (!this.cronEnabled()) return;
    const rows = await this.rwaTokenRepo
      .createQueryBuilder('t')
      .select('DISTINCT t.collection_key', 'collectionKey')
      .where('t.collection_key IS NOT NULL')
      .getRawMany<{ collectionKey: string }>();
    let count = 0;
    for (const r of rows) {
      const key = r.collectionKey?.trim().toLowerCase();
      if (!key) continue;
      this.enqueue(key, 'cron');
      count++;
    }
    this.logger.log(
      JSON.stringify({
        msg: 'market_snapshot_daily_portfolio_prewarm',
        timezone: 'KST',
        enqueued: count,
      }),
    );
  }

  private async runScheduledRefresh(trigger: string): Promise<void> {
    const keys = await this.discoverRefreshCandidates();
    for (const key of keys) {
      this.enqueue(key, 'cron');
    }
    this.logger.log(
      JSON.stringify({
        msg: 'market_snapshot_refresh_scheduled',
        trigger,
        candidateCount: keys.length,
        queueDepth: this.queue.length,
      }),
    );
  }

  /**
   * Active listings, recent fills, recently viewed, and stale/missing snapshots.
   * Skips collections with no marketplace activity signals.
   */
  async discoverRefreshCandidates(): Promise<string[]> {
    const keys = new Set<string>();
    const fillSince = new Date(
      Date.now() - this.recentFillDays() * 86_400_000,
    );
    const viewedSince = new Date(
      Date.now() - this.viewedLookbackDays() * 86_400_000,
    );

    const activeRows = await this.orderRepo
      .createQueryBuilder('o')
      .select('DISTINCT o.collection_key', 'collectionKey')
      .where('o.collection_key IS NOT NULL')
      .andWhere('o.side = :side', { side: OrderSide.ASK })
      .andWhere('o.status = :status', { status: OrderStatus.ACTIVE })
      .getRawMany<{ collectionKey: string }>();
    for (const r of activeRows) {
      if (r.collectionKey) keys.add(r.collectionKey.toLowerCase());
    }

    const recentFills = await this.orderRepo
      .createQueryBuilder('o')
      .select('DISTINCT o.collection_key', 'collectionKey')
      .where('o.collection_key IS NOT NULL')
      .andWhere('o.status = :status', { status: OrderStatus.FULFILLED })
      .andWhere('o.updated_at >= :since', { since: fillSince })
      .getRawMany<{ collectionKey: string }>();
    for (const r of recentFills) {
      if (r.collectionKey) keys.add(r.collectionKey.toLowerCase());
    }

    const viewed = await this.snapshotRepo
      .createQueryBuilder('s')
      .select('s.collection_key', 'collectionKey')
      .where('s.last_viewed_at >= :since', { since: viewedSince })
      .getRawMany<{ collectionKey: string }>();
    for (const r of viewed) {
      if (r.collectionKey) keys.add(r.collectionKey.toLowerCase());
    }

    const staleOrMissing = await this.snapshotRepo
      .createQueryBuilder('s')
      .select('s.collection_key', 'collectionKey')
      .where('s.synced_at IS NULL')
      .orWhere('s.stale_after IS NULL')
      .orWhere('s.stale_after <= :now', { now: new Date() })
      .getRawMany<{ collectionKey: string }>();
    for (const r of staleOrMissing) {
      if (r.collectionKey) keys.add(r.collectionKey.toLowerCase());
    }

    const maxBatch = Math.max(
      10,
      Number(this.config.get<string>('MARKET_SNAPSHOT_CRON_MAX_KEYS') ?? '120') ||
        120,
    );
    return [...keys].slice(0, maxBatch);
  }
}
