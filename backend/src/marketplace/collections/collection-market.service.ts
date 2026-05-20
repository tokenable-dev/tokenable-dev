import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CardhedgerMarketDataService } from './cardhedger-market-data.service';
import { CollectionService } from './collection.service';
import {
  percentChangeReferenceOverLagSec,
  type GradePriceStrip,
  type UsdPoint,
} from '../utils/collection-market.util';
import {
  blendCatalogSpotUsdFromPreview,
  gradeStripFromHistoryTier,
  nmHistoryDaysForBundleWindow,
} from '../utils/market-grade-strip.util';
import { marketHistoryTierFromComponents } from '../utils/market-history-tier.util';
import type { MarketBundleCacheV1 } from '../utils/market-bundle-cache.types';
import { tokenablePriceHistoryDurationToPeriod } from '../utils/price-history-period.util';
import { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import { Order, OrderSide, OrderStatus } from '../entities/order.entity';
import { computeRobustMarketStatsFromUsdPrices } from '../utils/collection-market-stats.util';
import type { MarketCollectionPreview } from '../utils/market-reference.types';

export type PriceHistoryDuration = '7d' | '30d' | '90d' | '180d' | '365d';

/** Labels effective lookback used for {@link CollectionMarketBundle.marketChangePct}. */
export type MarketChangeWindowLabel = PriceHistoryDuration | '24h';

const SEC_DAY = 86_400;
/** Longest-first; when insufficient history we try shorter horizons (markets list often lacks full 365d ticks). */
const MARKET_CHANGE_LAG_CHAIN: readonly {
  lagSec: number;
  window: MarketChangeWindowLabel;
}[] = [
  { lagSec: 365 * SEC_DAY, window: '365d' },
  { lagSec: 180 * SEC_DAY, window: '180d' },
  { lagSec: 90 * SEC_DAY, window: '90d' },
  { lagSec: 30 * SEC_DAY, window: '30d' },
  { lagSec: 7 * SEC_DAY, window: '7d' },
  { lagSec: SEC_DAY, window: '24h' },
];

function marketChangePctWithFallback(
  externalUsd: UsdPoint[],
  preferred: PriceHistoryDuration,
): { pct: number | null; window: MarketChangeWindowLabel } {
  const startIdx = MARKET_CHANGE_LAG_CHAIN.findIndex((e) => e.window === preferred);
  const from = startIdx >= 0 ? startIdx : 0;
  for (let i = from; i < MARKET_CHANGE_LAG_CHAIN.length; i++) {
    const { lagSec, window } = MARKET_CHANGE_LAG_CHAIN[i]!;
    const pct = percentChangeReferenceOverLagSec(externalUsd, lagSec);
    if (pct != null) return { pct, window };
  }
  return { pct: null, window: preferred };
}

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
  /** Strong on-platform liquidity (`sampleSize` threshold), not external price validity. */
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
  /** % change vs interpolated price at (latest − bundle history window lag) on external reference series. */
  marketChangePct: number | null;
  /** Lookback label for {@link marketChangePct} — matches effective lag (`365d`…`24h`; may shorten if history is sparse). */
  marketChangeWindow: MarketChangeWindowLabel;
  /** Market change source label. */
  marketChangeSource: MarketChangePriceSource | null;
  /** Legacy — always false. */
  isMockExternalPrices: boolean;
  /** Reference strip aligned to platform PSA10-only policy. */
  gradePrices: GradePriceStrip;
  /** External USD reference series (downsampled for list snapshots). */
  externalUsd: UsdPoint[];
  platformUsd: UsdPoint[];
  /**
   * The exact Cardhedger preview used to derive {@link gradePrices} and (after tail sync)
   * {@link externalUsd}. Clients should prefer this over a separate `GET …/cardhedger` call so
   * headline spot and chart share one resolution.
   */
  cardhedgerPreview: MarketCollectionPreview;
}

/** Fulfilled listing (ask) — tape row for collection order book. */
export interface PlatformTapeFillRow {
  t: number;
  priceUsdc: number;
  tokenId: string;
  orderHash: string;
  /**
   * `buy` = buyer fulfilled listing (`fulfillOrder` on ask).
   * `sell` = seller matched listing to collection bid (`fulfillMatchedPair`).
   * Older rows without `_tapeFillSide` in parameters default to `buy`.
   */
  tapeAggressor: 'buy' | 'sell';
}

function tapeAggressorFromOrderParameters(
  parameters: Record<string, unknown>,
): 'buy' | 'sell' {
  const s = parameters['_tapeFillSide'];
  if (s === 'sell') return 'sell';
  return 'buy';
}

@Injectable()
export class CollectionMarketService {
  private readonly logger = new Logger(CollectionMarketService.name);

  /** 0 disables server-side Cardhedger bundle cache (see `MarketBundleCacheV1`). */
  private marketBundleCacheTtlMs(): number {
    const raw = this.config.get<string>('MARKET_BUNDLE_CACHE_SEC');
    const sec = Number(raw);
    if (!Number.isFinite(sec) || sec < 0) return 120;
    if (sec === 0) return 0;
    return Math.min(Math.floor(sec), 86_400) * 1000;
  }

  private isUsableMarketBundleCache(
    col: MarketplaceCollection,
    cached: unknown,
    window: PriceHistoryDuration,
    ttlMs: number,
  ): cached is MarketBundleCacheV1 {
    if (ttlMs <= 0) return false;
    if (!col.marketBundleCachedAt) return false;
    if (Date.now() - col.marketBundleCachedAt.getTime() >= ttlMs) return false;
    if (!cached || typeof cached !== 'object') return false;
    const c = cached as Partial<MarketBundleCacheV1>;
    if (c.v !== 1) return false;
    if (c.window !== window) return false;
    const hint =
      typeof col.components?.cardhedgerCardId === 'string'
        ? col.components.cardhedgerCardId.trim()
        : '';
    const nh = hint.length > 0 ? hint : null;
    if (c.cardhedgerCardIdHint !== nh) return false;
    const hist = marketHistoryTierFromComponents(col.components);
    if (c.historyTier !== hist) return false;
    const rowR = col.cardhedgerResolvedCardId?.trim() || '';
    const res = c.resolvedCardId?.trim() || '';
    if (rowR.length > 0 && res.length > 0 && rowR !== res) return false;
    return true;
  }

  constructor(
    private readonly collectionService: CollectionService,
    private readonly cardMarketData: CardhedgerMarketDataService,
    private readonly config: ConfigService,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  private async retryOnce<T>(fn: () => Promise<T>, waitMs = 250): Promise<T> {
    try {
      return await fn();
    } catch {
      await new Promise((r) => setTimeout(r, waitMs));
      return fn();
    }
  }

  /** Canonical USDC contract for listing consideration (env or Sepolia default). */
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

  /**
   * Same rules as stats/trades USDC extraction (6-decimal micros string).
   * Used for counting skips in `getCollectionMarketStats` diagnostics without double-logging.
   */
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

  /**
   * Stats pipeline: USDC 6-decimal micros only. Non-USDC rows are ignored with a warning.
   */
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

  /**
   * Full chart series + up to 80 most recent fills for the Trades tab (single DB query).
   */
  async platformTradesForApi(collectionKey: string): Promise<{
    platformUsd: UsdPoint[];
    trades: PlatformTapeFillRow[];
  }> {
    const k = collectionKey.toLowerCase();
    const rows = await this.orderRepo.find({
      where: {
        collectionKey: k,
        status: OrderStatus.FULFILLED,
        side: OrderSide.ASK,
      },
      order: { updatedAt: 'ASC' },
    });
    const valid: Order[] = [];
    for (const o of rows) {
      if (!o.tokenId || o.tokenId === '0') continue;
      const v = this.usdcPriceFromOrder(o, 'platform-trades');
      if (v == null) continue;
      valid.push(o);
    }
    const platformUsd: UsdPoint[] = valid.map((o) => ({
      t: Math.floor(o.updatedAt.getTime() / 1000),
      v: this.usdcMicrosToNumber(o.considerationAmount)!,
    }));
    const recent = valid.slice(-80);
    const trades: PlatformTapeFillRow[] = [...recent].reverse().map((o) => ({
      t: Math.floor(o.updatedAt.getTime() / 1000),
      priceUsdc: this.usdcMicrosToNumber(o.considerationAmount)!,
      tokenId: String(o.tokenId),
      orderHash: o.orderHash,
      tapeAggressor: tapeAggressorFromOrderParameters(o.parameters),
    }));
    return { platformUsd, trades };
  }

  /**
   * Listing + fulfilled ask pool statistics for `collectionKey`.
   * `cardhedgerCardId` is returned under `reference` only — never used in floor/median/band/vol.
   */
  async getCollectionMarketStats(
    collectionKey: string,
  ): Promise<CollectionMarketStatsResponse> {
    const key = collectionKey.toLowerCase();
    /** Pool stats are listing-derived; a `marketplace_collections` row is optional (e.g. client-derived bucket key before first listing). */
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
        this.logger.warn(
          `collection market stats: skipping non-USDC order (active-listing) orderHash=${o.orderHash} token=${o.considerationToken}`,
        );
        continue;
      }
      if (skip === 'invalid_amount') {
        askInvalidAmount++;
        this.logger.warn(
          `collection market stats: invalid USDC considerationAmount (active-listing) orderHash=${o.orderHash} amount=${String(o.considerationAmount).slice(0, 48)}`,
        );
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
      if (!o.tokenId || o.tokenId === '0') {
        fulfilledSkippedToken++;
        continue;
      }
      const { usd, skip } = this.classifyUsdcConsideration(o);
      if (skip === 'non_usdc') {
        fulfilledNonUsdc++;
        this.logger.warn(
          `collection market stats: skipping non-USDC order (fulfilled-ask) orderHash=${o.orderHash} token=${o.considerationToken}`,
        );
        continue;
      }
      if (skip === 'invalid_amount') {
        fulfilledInvalidAmount++;
        this.logger.warn(
          `collection market stats: invalid USDC considerationAmount (fulfilled-ask) orderHash=${o.orderHash} amount=${String(o.considerationAmount).slice(0, 48)}`,
        );
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
      /** USDC prices merged into pool (active + eligible fulfilled) before IQR / min-sample gate */
      usdcObservationCount: rawPoolN,
      sampleSize: stats.sampleSize,
      isReliable: stats.isReliable,
      unreliableReason,
      ...(diagOn && rawPoolN === 0
        ? {
            globalActiveAskTotal,
            globalActiveAskRowsWithNullCollectionKey:
              globalActiveAskNullKeyCount,
            pipelineHint:
              'If globalActiveAskRowsWithNullCollectionKey > 0 but activeAskRowsDb is 0, orders likely have NULL collection_key while UI stats use a meta-derived 64-char key.',
          }
        : {}),
      note: 'Active listing query: orders.collection_key = key AND status = active AND side = ask. Stats path lowercases key; sha256 digest is lowercase hex.',
    });
    // Normal states for thin markets (new collection / few bids/asks) should not spam INFO logs.
    // Keep detailed stats in DEBUG unless diagnostics are explicitly enabled.
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

  async getCollectionMarketBundle(
    collectionKey: string,
    priceHistoryDuration: PriceHistoryDuration = '365d',
    _hintTokenId?: string | null,
  ): Promise<CollectionMarketBundle> {
    const key = collectionKey.toLowerCase();
    const col = await this.collectionService.findOne(key);
    const { platformUsd } = await this.platformTradesForApi(key);

    const window: PriceHistoryDuration = [
      '7d',
      '30d',
      '90d',
      '180d',
      '365d',
    ].includes(priceHistoryDuration)
      ? priceHistoryDuration
      : '365d';
    const chartHistoryDays = nmHistoryDaysForBundleWindow(window);
    const historyTier = marketHistoryTierFromComponents(col?.components);
    const historyPeriod = tokenablePriceHistoryDurationToPeriod(window);
    const cacheTtlMs = this.marketBundleCacheTtlMs();

    const cachedRaw =
      col?.marketBundleCacheJson as Record<string, unknown> | null | undefined;
    if (
      col &&
      cacheTtlMs > 0 &&
      this.isUsableMarketBundleCache(col, cachedRaw, window, cacheTtlMs)
    ) {
      const hit = cachedRaw as MarketBundleCacheV1;
      const externalUsd = hit.externalUsd;
      const { pct: marketChangePct, window: resolvedChangeWindow } =
        marketChangePctWithFallback(externalUsd, window);
      const marketChangeSource: MarketChangePriceSource | null =
        marketChangePct != null && externalUsd.length >= 2
          ? hit.historyTier === 'NEAR_MINT'
            ? 'cardhedger_nm'
            : 'cardhedger_graded'
          : 'none';
      const bundle: CollectionMarketBundle = {
        collectionKey: key,
        categoryLabel: hit.categoryLabel,
        marketChangePct,
        marketChangeWindow: resolvedChangeWindow,
        marketChangeSource,
        isMockExternalPrices: false,
        gradePrices: hit.gradePrices,
        externalUsd,
        platformUsd,
        cardhedgerPreview: hit.preview,
      };
      if (hit.preview.matched && hit.preview.card?.id) {
        this.collectionService.mergeCardhedgerPricingSnapshot(key, {
          cardId: hit.preview.card.id,
          headlineUsd:
            hit.preview.card.topPrice != null &&
            Number.isFinite(hit.preview.card.topPrice)
              ? hit.preview.card.topPrice
              : null,
          basis: hit.preview.card.spotPriceBasis ?? null,
        });
      }
      return bundle;
    }

    const { preview, history: tierHist } =
      await this.cardMarketData.getBundledCardData(col, {
        tier: historyTier,
        period: historyPeriod,
        maxCalendarDays: chartHistoryDays,
        maxRequests: 5,
      });

    const catalogSpot = blendCatalogSpotUsdFromPreview(preview, historyTier);
    const grades = gradeStripFromHistoryTier(historyTier, catalogSpot);

    let externalUsd: UsdPoint[] = tierHist.points.map((p) => ({
      t: p.t,
      v: p.v,
    }));

    /**
     * Match collection detail headline (`preview.card.topPrice`) with the chart terminal:
     * the bundled history can end on a Cardhedger daily tick that differs from the published
     * last-comp / spot basis used in the preview.
     */
    if (
      preview.matched &&
      preview.card &&
      preview.card.topPrice != null &&
      Number.isFinite(preview.card.topPrice) &&
      preview.card.topPrice > 0 &&
      externalUsd.length > 0
    ) {
      const tp = preview.card.topPrice;
      const last = externalUsd[externalUsd.length - 1];
      const eps = Math.max(1e-6, Math.abs(tp) * 1e-9);
      if (Math.abs(last.v - tp) > eps) {
        externalUsd = [...externalUsd.slice(0, -1), { t: last.t, v: tp }];
      }
    }

    const { pct: marketChangePct, window: resolvedChangeWindow } =
      marketChangePctWithFallback(externalUsd, window);
    const marketChangeSource: MarketChangePriceSource | null =
      marketChangePct != null && externalUsd.length >= 2
        ? historyTier === 'NEAR_MINT'
          ? 'cardhedger_nm'
          : 'cardhedger_graded'
        : 'none';

    const categoryParts =
      preview.matched && preview.card
        ? [preview.card.setName, preview.card.name]
            .map((s) => String(s).trim())
            .filter((s) => s.length > 0)
        : [];
    const categoryLabel =
      categoryParts.length > 0 ? categoryParts.join(' · ') : null;

    const bundle: CollectionMarketBundle = {
      collectionKey: key,
      categoryLabel,
      marketChangePct,
      marketChangeWindow: resolvedChangeWindow,
      marketChangeSource,
      isMockExternalPrices: false,
      gradePrices: grades,
      externalUsd,
      platformUsd,
      cardhedgerPreview: preview,
    };

    if (preview.matched && preview.card?.id) {
      this.collectionService.mergeCardhedgerPricingSnapshot(key, {
        cardId: preview.card.id,
        headlineUsd:
          preview.card.topPrice != null &&
          Number.isFinite(preview.card.topPrice)
            ? preview.card.topPrice
            : null,
        basis: preview.card.spotPriceBasis ?? null,
      });
    }

    if (col && cacheTtlMs > 0) {
      const hint =
        typeof col.components?.cardhedgerCardId === 'string'
          ? col.components.cardhedgerCardId.trim()
          : '';
      const cachePayload: MarketBundleCacheV1 = {
        v: 1,
        window,
        historyTier,
        cardhedgerCardIdHint: hint.length > 0 ? hint : null,
        resolvedCardId:
          preview.matched && preview.card?.id ? preview.card.id.trim() : null,
        preview,
        externalUsd,
        gradePrices: grades,
        categoryLabel,
      };
      this.collectionService.mergeMarketBundleCache(key, cachePayload);
    }

    return bundle;
  }

  async batchListSnapshots(
    collectionKeys: string[],
    priceHistoryDuration: PriceHistoryDuration = '365d',
  ): Promise<{ items: CollectionListSnapshot[] }> {
    const keys = [...new Set(collectionKeys.map((k) => k.toLowerCase()))].slice(
      0,
      60,
    );
    // Process in batches of 8 to avoid overwhelming the Cardhedger API with fully parallel
    // requests (each key triggers 2–4 upstream calls; 60×4 = 240 concurrent is too many).
    const SNAPSHOT_CONCURRENCY = 8;
    const settled: CollectionListSnapshot[] = [];
    for (let i = 0; i < keys.length; i += SNAPSHOT_CONCURRENCY) {
      const chunk = keys.slice(i, i + SNAPSHOT_CONCURRENCY);
      const chunkResults = await Promise.all(
        chunk.map(async (key) => {
          try {
            const [bundle, stats] = await Promise.all([
              this.retryOnce(() =>
                this.getCollectionMarketBundle(key, priceHistoryDuration),
              ),
              this.getCollectionMarketStats(key).catch(() => null),
            ]);
            return bundleToListSnapshot(bundle, stats);
          } catch (e) {
            this.logger.warn(`batch snapshot failed for ${key}: ${String(e)}`);
            return {
              collectionKey: key,
              categoryLabel: null,
              marketChangePct: null,
              marketChangeWindow: priceHistoryDuration,
              marketChangeSource: null,
              isMockExternalPrices: false,
              gradePrices: { psa10: null, psa9: null, raw: null },
              sparklineUsd: [],
              marketStats: null,
              lastTokenableTradeUsdc: null,
              lastTokenableTradeAtSec: null,
            } satisfies CollectionListSnapshot;
          }
        }),
      );
      settled.push(...chunkResults);
    }
    return { items: settled };
  }

  /**
   * One HTTP round-trip for portfolio: per-key pool stats + chart bundle (same payloads as
   * GET …/stats and GET …/market-series). Concurrency-capped like {@link batchListSnapshots}.
   */
  async batchPortfolioMarketData(
    collectionKeys: string[],
    opts: {
      priceHistoryDuration?: PriceHistoryDuration;
      hintTokenIdByKey?: ReadonlyMap<string, number>;
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
    ].includes(windowRaw)
      ? windowRaw
      : '365d';
    const hintMap = opts.hintTokenIdByKey ?? new Map<string, number>();
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
          const hintNum = hintMap.get(key);
          const hintStr =
            hintNum != null &&
            Number.isFinite(hintNum) &&
            hintNum >= 0 &&
            Number.isInteger(hintNum)
              ? String(hintNum)
              : undefined;
          try {
            const [stats, series] = await Promise.all([
              this.getCollectionMarketStats(key).catch(() => null),
              this.retryOnce(() =>
                this.getCollectionMarketBundle(key, d, hintStr),
              ).catch(() => null),
            ]);
            return {
              collectionKey: key,
              stats,
              series,
            };
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
  marketChangeSource: MarketChangePriceSource | null;
  isMockExternalPrices: boolean;
  gradePrices: GradePriceStrip;
  /** Downsampled external series for list sparkline */
  sparklineUsd: UsdPoint[];
  /** Pool stats — same as `GET …/collections/:key/stats` when available */
  marketStats: CollectionMarketStatsResponse | null;
  /** Most recent fulfilled ask (USDC) on Tokenable for this bucket; null if no sales yet */
  lastTokenableTradeUsdc: number | null;
  /** Unix seconds for {@link lastTokenableTradeUsdc} */
  lastTokenableTradeAtSec: number | null;
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
    marketChangeSource: bundle.marketChangeSource,
    isMockExternalPrices: bundle.isMockExternalPrices,
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
