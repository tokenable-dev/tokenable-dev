import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CollectionService } from './collection.service';
import { CollectionMarketSnapshotReadService } from './collection-market-snapshot-read.service';
import { CollectionMarketSnapshotSchedulerService } from './collection-market-snapshot-scheduler.service';
import { CollectionMarketSnapshotService } from './collection-market-snapshot.service';
import {
  type GradePriceStrip,
  type UsdPoint,
} from '../utils/collection-market.util';
import { Order, OrderSide, OrderStatus } from '../entities/order.entity';
import { computeRobustMarketStatsFromUsdPrices } from '../utils/collection-market-stats.util';
import type { MarketCollectionPreview } from '../utils/market-reference.types';
import {
  resolveFulfilledAskTokenId,
  resolvePlatformTapeFill,
} from '../utils/platform-tape.util';

export type PriceHistoryDuration =
  | '7d'
  | '30d'
  | '90d'
  | '180d'
  | '365d'
  | 'max';

/** Effective lookback for {@link CollectionMarketBundle.marketChangePct} (product UI: 1 yr). */
export type MarketChangeWindowLabel = PriceHistoryDuration | '24h';

/**
 * Collection catalog reference prices: Cardhedger PSA10 history + bands.
 * `GET …/collections/:key/stats` is **listing-pool liquidity only**, not catalog price.
 */
export type MarketChangePriceSource =
  | 'cardhedger_nm'
  | 'cardhedger_graded'
  | 'none';

/** Listing-pool depth / distribution (USDC) — liquidity signal; not primary “market price”. */
export interface CollectionMarketStatsResponse {
  collectionKey: string;
  floor: number | null;
  median: number | null;
  p25: number | null;
  p75: number | null;
  band: { low: number | null; high: number | null };
  volatility: number | null;
  sampleSize: number;
  isReliable: boolean;
  dataQuality: {
    sampleSize: number;
    trimmed: boolean;
    currency: 'USDC';
  };
  sources: { listings: boolean; trades?: boolean };
  reference?: { cardhedgerCardId: string | null };
}

export interface CollectionMarketBundle {
  collectionKey: string;
  categoryLabel: string | null;
  marketChangePct: number | null;
  marketChangeWindow: MarketChangeWindowLabel;
  marketChangeIsFullYear?: boolean;
  marketChangeSpanSec?: number;
  /** LOCF anchor sale used for {@link marketChangePct}. */
  marketChangeRefUsd?: number | null;
  marketChangeRefAtSec?: number | null;
  marketChangeSource: MarketChangePriceSource | null;
  gradePrices: GradePriceStrip;
  externalUsd: UsdPoint[];
  platformUsd: UsdPoint[];
  cardhedgerPreview: MarketCollectionPreview;
  snapshotStale?: boolean;
  syncedAt?: string;
  reliabilityScore?: number;
}

/** Fulfilled listing (ask) — tape row for collection order book. */
export interface PlatformTapeFillRow {
  t: number;
  priceUsdc: number;
  tokenId: string;
  orderHash: string;
  tapeAggressor: 'buy' | 'sell';
}

function tapeAggressorFromOrderParameters(
  parameters: Record<string, unknown>,
): 'buy' | 'sell' {
  const s = parameters['_tapeFillSide'];
  if (s === 'sell') return 'sell';
  return 'buy';
}

function emptyMarketBundle(
  collectionKey: string,
  platformUsd: UsdPoint[],
  window: PriceHistoryDuration,
): CollectionMarketBundle {
  return {
    collectionKey,
    categoryLabel: null,
    marketChangePct: null,
    marketChangeWindow: window,
    marketChangeSource: 'none',
    gradePrices: { psa10: null, psa9: null, raw: null },
    externalUsd: [],
    platformUsd,
    cardhedgerPreview: {
      enabled: true,
      searchQuery: '',
      matched: false,
      message: 'Market snapshot unavailable',
      card: null,
    },
  };
}

@Injectable()
export class CollectionMarketService {
  private readonly logger = new Logger(CollectionMarketService.name);

  constructor(
    private readonly collectionService: CollectionService,
    private readonly config: ConfigService,
    private readonly snapshotService: CollectionMarketSnapshotService,
    private readonly snapshotRead: CollectionMarketSnapshotReadService,
    private readonly snapshotScheduler: CollectionMarketSnapshotSchedulerService,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  private touchAndMaybeRefreshStale(
    collectionKey: string,
    stale: boolean,
  ): void {
    this.snapshotService.touchLastViewed(collectionKey);
    if (stale) {
      this.snapshotScheduler.enqueue(collectionKey, 'stale_swr');
    }
  }

  /**
   * Materialized snapshot read — platform trades always from orders DB.
   */
  async getCollectionMarketBundle(
    collectionKey: string,
    priceHistoryDuration: PriceHistoryDuration = '365d',
  ): Promise<CollectionMarketBundle> {
    const key = collectionKey.toLowerCase();
    const window: PriceHistoryDuration = [
      '7d',
      '30d',
      '90d',
      '180d',
      '365d',
      'max',
    ].includes(priceHistoryDuration)
      ? priceHistoryDuration
      : '365d';

    const { platformUsd } = await this.platformTradesForApi(key);
    let row = await this.snapshotService.findByKey(key);

    if (!(await this.snapshotService.isUsableForRead(row, key))) {
      row =
        (await this.snapshotService.ensureSnapshot(key, 'cold_start')) ?? row;
    }

    if (
      row?.previewJson &&
      !(await this.snapshotService.isUsableForRead(row, key))
    ) {
      row = await this.snapshotService.refreshSnapshot(key, 'manual');
    }

    if (!row?.previewJson) {
      return emptyMarketBundle(key, platformUsd, window);
    }

    const stale = this.snapshotService.isRowStale(row);
    this.touchAndMaybeRefreshStale(key, stale);
    return this.snapshotRead.buildBundleFromRow(row, window, platformUsd).bundle;
  }

  private usdcContractAddressLower(): string {
    const raw = this.config.get<string>('USDC_CONTRACT_ADDRESS');
    if (raw && String(raw).trim()) {
      return String(raw).trim().toLowerCase();
    }
    return '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238';
  }

  private isUsdcConsiderationToken(token: string | null | undefined): boolean {
    if (!token || !String(token).trim()) return false;
    return (
      String(token).trim().toLowerCase() === this.usdcContractAddressLower()
    );
  }

  private usdcMicrosToNumber(amount: string): number | null {
    try {
      const v = Number(BigInt(amount)) / 1_000_000;
      return Number.isFinite(v) ? v : null;
    } catch {
      return null;
    }
  }

  private classifyUsdcConsideration(o: Order): {
    usd: number | null;
    skip: 'none' | 'non_usdc' | 'invalid_amount';
  } {
    if (!this.isUsdcConsiderationToken(o.considerationToken)) {
      return { usd: null, skip: 'non_usdc' };
    }
    const v = this.usdcMicrosToNumber(o.considerationAmount);
    if (v == null || v <= 0) return { usd: null, skip: 'invalid_amount' };
    return { usd: v, skip: 'none' };
  }

  private usdcPriceFromOrder(o: Order, label: string): number | null {
    const { usd, skip } = this.classifyUsdcConsideration(o);
    if (skip === 'non_usdc') {
      this.logger.warn(
        `collection market stats: skipping non-USDC order (${label}) orderHash=${o.orderHash} token=${o.considerationToken}`,
      );
      return null;
    }
    if (skip === 'invalid_amount') {
      this.logger.warn(
        `collection market stats: invalid USDC considerationAmount (${label}) orderHash=${o.orderHash} amount=${String(o.considerationAmount).slice(0, 48)}`,
      );
      return null;
    }
    return usd;
  }

  async platformTradesForApi(collectionKey: string): Promise<{
    platformUsd: UsdPoint[];
    trades: PlatformTapeFillRow[];
  }> {
    const k = collectionKey.toLowerCase();
  /** Fulfilled asks + collection bids (criteria match / buy flow). */
    const rows = await this.orderRepo.find({
      where: {
        collectionKey: k,
        status: OrderStatus.FULFILLED,
      },
      order: { updatedAt: 'ASC' },
    });
    const valid: { order: Order; tokenId: string; priceUsdc: number }[] = [];
    for (const o of rows) {
      const priceUsdc = this.usdcPriceFromOrder(o, 'platform-trades');
      const fill = resolvePlatformTapeFill(o, priceUsdc);
      if (!fill) continue;
      valid.push({ order: o, tokenId: fill.tokenId, priceUsdc: fill.priceUsdc });
    }
    const platformUsd: UsdPoint[] = valid.map(({ order: o, priceUsdc }) => ({
      t: Math.floor(o.updatedAt.getTime() / 1000),
      v: priceUsdc,
    }));
    const recent = valid.slice(-80);
    const trades: PlatformTapeFillRow[] = [...recent].reverse().map(
      ({ order: o, tokenId, priceUsdc }) => ({
        t: Math.floor(o.updatedAt.getTime() / 1000),
        priceUsdc,
        tokenId,
        orderHash: o.orderHash,
        tapeAggressor: tapeAggressorFromOrderParameters(o.parameters),
      }),
    );
    return { platformUsd, trades };
  }

  async getCollectionMarketStats(
    collectionKey: string,
  ): Promise<CollectionMarketStatsResponse> {
    const key = collectionKey.toLowerCase();
    const col = await this.collectionService.findOne(key);
    const expectedUsdc = this.usdcContractAddressLower();

    const prices: number[] = [];
    const asks = await this.collectionService.activeListingsForCollection(key);
    let askNonUsdc = 0;
    let askInvalidAmount = 0;
    let poolFromActiveAsks = 0;
    for (const o of asks) {
      const { usd, skip } = this.classifyUsdcConsideration(o);
      if (skip === 'non_usdc') {
        askNonUsdc++;
        continue;
      }
      if (skip === 'invalid_amount') {
        askInvalidAmount++;
        continue;
      }
      prices.push(usd!);
      poolFromActiveAsks++;
    }

    let poolFromFulfilledAsks = 0;
    const fulfilled = await this.orderRepo.find({
      where: {
        collectionKey: key,
        status: OrderStatus.FULFILLED,
        side: OrderSide.ASK,
      },
      order: { updatedAt: 'ASC' },
    });
    let fulfilledSkippedToken = 0;
    let fulfilledNonUsdc = 0;
    let fulfilledInvalidAmount = 0;
    for (const o of fulfilled) {
      const { usd, skip } = this.classifyUsdcConsideration(o);
      if (skip === 'non_usdc') {
        fulfilledNonUsdc++;
        continue;
      }
      if (skip === 'invalid_amount') {
        fulfilledInvalidAmount++;
        continue;
      }
      prices.push(usd!);
      poolFromFulfilledAsks++;
    }
    const tradesUsed = poolFromFulfilledAsks > 0;

    const stats = computeRobustMarketStatsFromUsdPrices(prices);
    const comp = col?.components ?? {};
    const chid =
      typeof comp.cardhedgerCardId === 'string' && comp.cardhedgerCardId.trim()
        ? comp.cardhedgerCardId.trim()
        : null;

    const rawPoolN = prices.length;
    let unreliableReason: string | null = null;
    if (rawPoolN === 0) {
      unreliableReason =
        asks.length === 0 && fulfilled.length === 0
          ? 'no_order_rows_for_collection_key'
          : 'no_usdc_prices_after_filter';
    } else if (rawPoolN < 5) {
      unreliableReason = 'sample_below_min_reliable(5)';
    }

    const diag = this.config.get<string>('MARKETPLACE_PIPELINE_DIAG');
    const diagOn = diag === '1' || diag === 'true';
    let globalActiveAskNullKeyCount: number | undefined;
    let globalActiveAskTotal: number | undefined;
    if (diagOn && rawPoolN === 0) {
      globalActiveAskNullKeyCount = await this.orderRepo.count({
        where: {
          side: OrderSide.ASK,
          status: OrderStatus.ACTIVE,
          collectionKey: IsNull(),
        },
      });
      globalActiveAskTotal = await this.orderRepo.count({
        where: { side: OrderSide.ASK, status: OrderStatus.ACTIVE },
      });
    }

    const statsLog = JSON.stringify({
      msg: 'collection_market_stats',
      collectionKey: key,
      marketplaceCollectionRow: Boolean(col),
      referenceCardhedgerCardIdPresent: Boolean(chid),
      usdcAddressExpectedLower: expectedUsdc,
      activeAskRowsDb: asks.length,
      poolFromActiveAsks,
      activeAskSkippedNonUsdc: askNonUsdc,
      activeAskSkippedInvalidAmount: askInvalidAmount,
      fulfilledAskRowsDb: fulfilled.length,
      poolFromFulfilledAsks,
      fulfilledSkippedNoTokenOrZero: fulfilledSkippedToken,
      fulfilledSkippedNonUsdc: fulfilledNonUsdc,
      fulfilledSkippedInvalidAmount: fulfilledInvalidAmount,
      usdcObservationCount: rawPoolN,
      sampleSize: stats.sampleSize,
      isReliable: stats.isReliable,
      unreliableReason,
      ...(diagOn && rawPoolN === 0
        ? {
            globalActiveAskTotal,
            globalActiveAskRowsWithNullCollectionKey:
              globalActiveAskNullKeyCount,
          }
        : {}),
    });
    const shouldDebugOnly =
      !diagOn &&
      (unreliableReason === 'no_order_rows_for_collection_key' ||
        unreliableReason === 'no_usdc_prices_after_filter' ||
        unreliableReason === 'sample_below_min_reliable(5)');
    if (shouldDebugOnly) {
      this.logger.debug(statsLog);
    } else {
      this.logger.log(statsLog);
    }

    return {
      collectionKey: key,
      floor: stats.floor,
      median: stats.median,
      p25: stats.p25,
      p75: stats.p75,
      band: stats.band,
      volatility: stats.volatility,
      sampleSize: stats.sampleSize,
      isReliable: stats.isReliable,
      dataQuality: {
        sampleSize: stats.sampleSize,
        trimmed: stats.trimmed,
        currency: 'USDC',
      },
      sources: { listings: true, trades: tradesUsed },
      reference: { cardhedgerCardId: chid },
    };
  }

  async batchListSnapshots(
    collectionKeys: string[],
    priceHistoryDuration: PriceHistoryDuration = '365d',
  ): Promise<{ items: CollectionListSnapshot[] }> {
    const keys = [...new Set(collectionKeys.map((k) => k.toLowerCase()))].slice(
      0,
      60,
    );
    const window = priceHistoryDuration;

    const snapshotMap = await this.snapshotService.findByKeys(keys);
    const missing: string[] = [];
    for (const key of keys) {
      const row = snapshotMap.get(key);
      if (!(await this.snapshotService.isUsableForRead(row, key))) {
        missing.push(key);
      }
    }
    if (missing.length > 0 && this.snapshotService.onDemandEnabled()) {
      const COLD_CONCURRENCY = 4;
      for (let i = 0; i < missing.length; i += COLD_CONCURRENCY) {
        const chunk = missing.slice(i, i + COLD_CONCURRENCY);
        await Promise.all(
          chunk.map((k) => this.snapshotService.ensureSnapshot(k, 'cold_start')),
        );
      }
      const refreshed = await this.snapshotService.findByKeys(missing);
      for (const [k, v] of refreshed) snapshotMap.set(k, v);
    }

    const items: CollectionListSnapshot[] = [];
    for (const key of keys) {
      try {
        const row = snapshotMap.get(key);
        const stats = await this.getCollectionMarketStats(key).catch(() => null);
        if (row?.previewJson) {
          const stale = this.snapshotService.isRowStale(row);
          this.touchAndMaybeRefreshStale(key, stale);
          const { platformUsd } = await this.platformTradesForApi(key);
          const bundle = this.snapshotRead.buildBundleFromRow(
            row,
            window,
            platformUsd,
          ).bundle;
          items.push(bundleToListSnapshot(bundle, stats));
          continue;
        }
        items.push(emptyListSnapshot(key, window));
      } catch (e) {
        this.logger.warn(`batch snapshot failed for ${key}: ${String(e)}`);
        items.push(emptyListSnapshot(key, window));
      }
    }
    return { items };
  }

  async batchPortfolioMarketData(
    collectionKeys: string[],
    opts: {
      priceHistoryDuration?: PriceHistoryDuration;
    } = {},
  ): Promise<{
    items: Array<{
      collectionKey: string;
      stats: CollectionMarketStatsResponse | null;
      series: CollectionMarketBundle | null;
    }>;
  }> {
    const windowRaw = opts.priceHistoryDuration ?? '365d';
    const d: PriceHistoryDuration = [
      '7d',
      '30d',
      '90d',
      '180d',
      '365d',
      'max',
    ].includes(windowRaw)
      ? windowRaw
      : 'max';

    const keys = [
      ...new Set(
        collectionKeys
          .map((k) =>
            String(k ?? '')
              .trim()
              .toLowerCase(),
          )
          .filter((k) => k.length > 0),
      ),
    ].slice(0, 60);

    const PORTFOLIO_BATCH_CONCURRENCY = 8;
    const items: Array<{
      collectionKey: string;
      stats: CollectionMarketStatsResponse | null;
      series: CollectionMarketBundle | null;
    }> = [];

    for (let i = 0; i < keys.length; i += PORTFOLIO_BATCH_CONCURRENCY) {
      const chunk = keys.slice(i, i + PORTFOLIO_BATCH_CONCURRENCY);
      const chunkResults = await Promise.all(
        chunk.map(async (key) => {
          try {
            const [stats, series] = await Promise.all([
              this.getCollectionMarketStats(key).catch(() => null),
              this.getCollectionMarketBundle(key, d).catch(() => null),
            ]);
            return { collectionKey: key, stats, series };
          } catch {
            return { collectionKey: key, stats: null, series: null };
          }
        }),
      );
      items.push(...chunkResults);
    }
    return { items };
  }
}

export interface CollectionListSnapshot {
  collectionKey: string;
  categoryLabel: string | null;
  marketChangePct: number | null;
  marketChangeWindow: MarketChangeWindowLabel;
  marketChangeIsFullYear?: boolean;
  marketChangeSpanSec?: number;
  marketChangeSource: MarketChangePriceSource | null;
  gradePrices: GradePriceStrip;
  sparklineUsd: UsdPoint[];
  marketStats: CollectionMarketStatsResponse | null;
  lastTokenableTradeUsdc: number | null;
  lastTokenableTradeAtSec: number | null;
  snapshotStale?: boolean;
  syncedAt?: string;
  reliabilityScore?: number;
}

function emptyListSnapshot(
  key: string,
  window: PriceHistoryDuration,
): CollectionListSnapshot {
  return {
    collectionKey: key,
    categoryLabel: null,
    marketChangePct: null,
    marketChangeWindow: window,
    marketChangeSource: null,
    gradePrices: { psa10: null, psa9: null, raw: null },
    sparklineUsd: [],
    marketStats: null,
    lastTokenableTradeUsdc: null,
    lastTokenableTradeAtSec: null,
  };
}

function bundleToListSnapshot(
  bundle: CollectionMarketBundle,
  marketStats: CollectionMarketStatsResponse | null,
): CollectionListSnapshot {
  const spark = downsampleSpark(bundle.externalUsd, 48);
  const lastPt =
    bundle.platformUsd.length > 0
      ? bundle.platformUsd[bundle.platformUsd.length - 1]
      : null;
  return {
    collectionKey: bundle.collectionKey,
    categoryLabel: bundle.categoryLabel,
    marketChangePct: bundle.marketChangePct,
    marketChangeWindow: bundle.marketChangeWindow,
    marketChangeIsFullYear: bundle.marketChangeIsFullYear,
    marketChangeSpanSec: bundle.marketChangeSpanSec,
    marketChangeSource: bundle.marketChangeSource,
    gradePrices: bundle.gradePrices,
    sparklineUsd: spark,
    marketStats,
    lastTokenableTradeUsdc:
      lastPt != null && Number.isFinite(lastPt.v) && lastPt.v > 0
        ? lastPt.v
        : null,
    lastTokenableTradeAtSec:
      lastPt != null && Number.isFinite(lastPt.t) && lastPt.t > 0
        ? lastPt.t
        : null,
    snapshotStale: bundle.snapshotStale,
    syncedAt: bundle.syncedAt,
    reliabilityScore: bundle.reliabilityScore,
  };
}

function downsampleSpark(points: UsdPoint[], maxPoints: number): UsdPoint[] {
  if (points.length <= maxPoints) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  const out: UsdPoint[] = [];
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round(i * step);
    out.push(points[Math.min(idx, points.length - 1)]);
  }
  return out;
}
