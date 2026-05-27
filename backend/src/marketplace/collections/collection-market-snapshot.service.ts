import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CardhedgerMarketDataService } from './cardhedger-market-data.service';
import { CollectionService } from './collection.service';
import { CollectionMarketSnapshot } from '../entities/collection-market-snapshot.entity';
import { MARKET_NM_HISTORY_MAX_DAYS } from '../utils/market-grade-strip.util';
import { marketHistoryTierFromComponents } from '../utils/market-history-tier.util';
import {
  buildMaterializedSnapshotPayload,
  isSnapshotRowStale,
} from '../utils/market-snapshot-normalize.util';
import type {
  MaterializedMarketSnapshotPayload,
  SnapshotRefreshReason,
} from '../utils/market-snapshot.types';
import { MARKET_SNAPSHOT_SOURCE_VERSION } from '../utils/market-snapshot.types';
import { psaPublicApiAllowedForSnapshotReason } from '../utils/psa-components-mirror.util';

/**
 * Builds and persists materialized Cardhedger snapshots.
 * All upstream Cardhedger work for refresh paths lives here.
 */
@Injectable()
export class CollectionMarketSnapshotService {
  private readonly logger = new Logger(CollectionMarketSnapshotService.name);
  private readonly inflight = new Map<
    string,
    Promise<CollectionMarketSnapshot | null>
  >();

  constructor(
    @InjectRepository(CollectionMarketSnapshot)
    private readonly snapshotRepo: Repository<CollectionMarketSnapshot>,
    @Inject(forwardRef(() => CollectionService))
    private readonly collectionService: CollectionService,
    private readonly cardMarketData: CardhedgerMarketDataService,
    private readonly config: ConfigService,
  ) {}

  staleAfterSec(): number {
    const raw = Number(
      this.config.get<string>('MARKET_SNAPSHOT_STALE_AFTER_SEC') ?? '900',
    );
    if (!Number.isFinite(raw) || raw < 60) return 900;
    return Math.min(Math.floor(raw), 86_400);
  }

  onDemandEnabled(): boolean {
    const raw = this.config.get<string>('MARKET_SNAPSHOT_ON_DEMAND');
    return raw !== '0' && raw !== 'false';
  }

  async findByKey(
    collectionKey: string,
  ): Promise<CollectionMarketSnapshot | null> {
    const key = collectionKey.toLowerCase();
    return this.snapshotRepo.findOne({ where: { collectionKey: key } });
  }

  async findByKeys(
    collectionKeys: string[],
  ): Promise<Map<string, CollectionMarketSnapshot>> {
    const keys = [
      ...new Set(collectionKeys.map((k) => k.toLowerCase()).filter(Boolean)),
    ];
    if (keys.length === 0) return new Map();
    const rows = await this.snapshotRepo
      .createQueryBuilder('s')
      .where('s.collection_key IN (:...keys)', { keys })
      .getMany();
    return new Map(rows.map((r) => [r.collectionKey, r]));
  }

  isRowStale(row: CollectionMarketSnapshot | null | undefined): boolean {
    if (!row?.syncedAt) return true;
    if (row.sourceVersion !== MARKET_SNAPSHOT_SOURCE_VERSION) return true;
    return isSnapshotRowStale(row.staleAfter);
  }

  /**
   * False when the row is a cold-start race artifact (e.g. preview "Collection not found"
   * while `marketplace_collections` already exists) or lacks chart-grade series.
   */
  async isUsableForRead(
    row: CollectionMarketSnapshot | null | undefined,
    collectionKey: string,
  ): Promise<boolean> {
    if (!row?.previewJson || !row.syncedAt) return false;
    if (row.sourceVersion !== MARKET_SNAPSHOT_SOURCE_VERSION) return false;

    const msg = String(row.previewJson.message ?? '').trim();
    if (msg === 'Collection not found') return false;

    const extLen = row.externalUsdJson?.length ?? 0;
    if (extLen >= 2) return true;

    const card = row.previewJson.card;
    const matched = Boolean(row.previewJson.matched && card);
    if (matched) {
      const top = card?.topPrice;
      if (typeof top === 'number' && Number.isFinite(top) && top > 0) {
        return true;
      }
      const headline = row.headlineUsd;
      if (
        typeof headline === 'number' &&
        Number.isFinite(headline) &&
        headline > 0
      ) {
        return true;
      }
    }

    /** Do not serve empty matched:false rows — triggers cold_start refresh on GET market-series. */
    return false;
  }

  /** Fire-and-forget viewed-at bump for refresh prioritization. */
  touchLastViewed(collectionKey: string): void {
    const key = collectionKey.toLowerCase();
    void this.snapshotRepo
      .update({ collectionKey: key }, { lastViewedAt: new Date() })
      .catch(() => undefined);
  }

  /**
   * Fetch Cardhedger upstream, normalize, upsert snapshot row.
   * Idempotent — safe for cron and on-demand cold start.
   */
  async refreshSnapshot(
    collectionKey: string,
    reason: SnapshotRefreshReason = 'cron',
  ): Promise<CollectionMarketSnapshot | null> {
    const key = collectionKey.toLowerCase();
    const existing = this.inflight.get(key);
    if (existing) return existing;

    const work = this.refreshSnapshotInner(key, reason).finally(() => {
      this.inflight.delete(key);
    });
    this.inflight.set(key, work);
    return work;
  }

  private async refreshSnapshotInner(
    key: string,
    reason: SnapshotRefreshReason,
  ): Promise<CollectionMarketSnapshot | null> {
    const started = Date.now();
    try {
      const allowPsaUpstream = psaPublicApiAllowedForSnapshotReason(
        reason,
        this.config.get<string>('PSA_PUBLIC_API_REFRESH_ON_SNAPSHOT'),
      );
      await this.collectionService.refreshPsaPublicSnapshotForCollection(key, {
        allowUpstream: allowPsaUpstream,
      });
      let col = await this.collectionService.findOne(key);
      if (col) {
        await this.collectionService.auditCardhedgerCardIdExact(key, {
          clearOnMismatch: true,
        });
        await this.collectionService.ensureMintParallelVarietyFromListings(key);
        col = await this.collectionService.findOne(key);
      }
      if (col) {
        col =
          await this.collectionService.mergePsaSnapshotIntoComponentsFromDb(
            col,
          );
      }
      const historyTier = marketHistoryTierFromComponents(col?.components);
      const { preview, history } = await this.cardMarketData.getBundledCardData(
        col,
        {
          tier: historyTier,
          period: '1y',
          maxCalendarDays: MARKET_NM_HISTORY_MAX_DAYS,
          maxRequests: 5,
        },
      );

      const payload = buildMaterializedSnapshotPayload({
        collectionKey: key,
        historyTier,
        preview,
        historyPoints: history.points,
      });

      const row = await this.upsertPayload(payload);
      this.logger.log(
        JSON.stringify({
          msg: 'market_snapshot_refreshed',
          collectionKey: key,
          reason,
          matched: preview.matched,
          cardhedgerCardId: payload.cardhedgerCardId,
          durationMs: Date.now() - started,
        }),
      );
      return row;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(
        `refreshSnapshot failed key=${key} reason=${reason}: ${msg}`,
      );
      await this.markRefreshError(key, msg);
      return this.findByKey(key);
    }
  }

  private async upsertPayload(
    payload: MaterializedMarketSnapshotPayload,
  ): Promise<CollectionMarketSnapshot> {
    const now = new Date();
    const staleAfter = new Date(now.getTime() + this.staleAfterSec() * 1000);
    const entity: Partial<CollectionMarketSnapshot> = {
      collectionKey: payload.collectionKey,
      cardhedgerCardId: payload.cardhedgerCardId,
      psa10Usd: payload.psa10Usd,
      psa9Usd: payload.psa9Usd,
      rawUsd: payload.rawUsd,
      headlineUsd: payload.headlineUsd,
      spotPriceBasis: payload.spotPriceBasis,
      change7dPct: payload.change7dPct,
      change30dPct: payload.change30dPct,
      sparkline90dJson: payload.sparkline90dJson,
      previewJson: payload.previewJson,
      externalUsdJson: payload.externalUsdJson,
      gradePricesJson: payload.gradePricesJson,
      categoryLabel: payload.categoryLabel,
      historyTier: payload.historyTier,
      reliabilityScore: payload.reliabilityScore,
      marketState: payload.marketState,
      syncedAt: now,
      staleAfter,
      sourceVersion: payload.sourceVersion,
      lastRefreshError: null,
    };

    await this.snapshotRepo.upsert(entity, ['collectionKey']);
    const saved = await this.findByKey(payload.collectionKey);
    if (!saved) {
      throw new Error(
        `upsert succeeded but row missing for ${payload.collectionKey}`,
      );
    }

    return saved;
  }

  private async markRefreshError(
    collectionKey: string,
    message: string,
  ): Promise<void> {
    const key = collectionKey.toLowerCase();
    const existing = await this.findByKey(key);
    if (existing) {
      await this.snapshotRepo.update(
        { collectionKey: key },
        {
          marketState: 'error',
          lastRefreshError: message.slice(0, 2000),
        },
      );
      return;
    }
    await this.snapshotRepo.upsert(
      {
        collectionKey: key,
        marketState: 'error',
        lastRefreshError: message.slice(0, 2000),
        sourceVersion: MARKET_SNAPSHOT_SOURCE_VERSION,
      },
      ['collectionKey'],
    );
  }

  /**
   * Cold-start path: build snapshot once when no row exists.
   * Returns null when on-demand refresh is disabled and row is missing.
   */
  async ensureSnapshot(
    collectionKey: string,
    reason: SnapshotRefreshReason = 'cold_start',
  ): Promise<CollectionMarketSnapshot | null> {
    const key = collectionKey.toLowerCase();
    const existing = await this.findByKey(key);
    if (
      existing?.syncedAt &&
      existing.previewJson &&
      (await this.isUsableForRead(existing, key))
    ) {
      return existing;
    }
    if (!this.onDemandEnabled()) return existing;
    return this.refreshSnapshot(key, reason);
  }
}
