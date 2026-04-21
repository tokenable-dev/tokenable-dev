import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { GetCardsDto } from '../price/dto/get-cards.dto';
import { PriceService } from '../price/price.service';
import { CollectionService } from './collection.service';
import {
  candidateJustTcgGamesForCollection,
  hasUsefulJustTcgMarketData,
  parseJustTcgCardsResponseBest,
  scoreMarketPriceParsed,
  type GradePriceStrip,
  type ParsedJustTcgMarket,
  type UsdPoint,
} from './collection-market.util';
import { Order, OrderSide, OrderStatus } from './entities/order.entity';
import { computeRobustMarketStatsFromUsdPrices } from './collection-market-stats.util';

export type PriceHistoryDuration = '7d' | '30d' | '90d' | '180d';

/**
 * Collection “market price” in the product is **external** (PokéTrace primary, JustTCG fallback).
 * `GET …/collections/:key/stats` is **listing-pool liquidity only**, not catalog price.
 */
export type MarketChangePriceSource =
  | 'poketrace_nm_ebay'
  | 'justtcg_card_history'
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
  reference?: { poketraceCardId: string | null };
}

export interface CollectionMarketBundle {
  collectionKey: string;
  justtcgCardId: string | null;
  categoryLabel: string | null;
  /**
   * Deprecated for collection “market price”: kept null with `marketChangeSource: 'none'`.
   * Use `GET …/collections/:key/stats` (listing pool) instead.
   */
  marketChangePct: number | null;
  /** Window label only (grade strip / JustTCG metadata still keyed by this window). */
  marketChangeWindow: PriceHistoryDuration;
  /** No external card time-series in bundle; pool stats live on `/stats`. */
  marketChangeSource: MarketChangePriceSource | null;
  /** Always false when external series is empty (legacy field). */
  isMockExternalPrices: boolean;
  gradePrices: GradePriceStrip;
  /** Deprecated: empty — collection external chart must not use JustTCG/PokéTrace blend here. */
  externalUsd: UsdPoint[];
  platformUsd: UsdPoint[];
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

function tapeAggressorFromOrderParameters(parameters: Record<string, unknown>): 'buy' | 'sell' {
  const s = parameters['_tapeFillSide'];
  if (s === 'sell') return 'sell';
  return 'buy';
}

@Injectable()
export class CollectionMarketService {
  private readonly logger = new Logger(CollectionMarketService.name);

  constructor(
    private readonly collectionService: CollectionService,
    private readonly priceService: PriceService,
    private readonly config: ConfigService,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

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
    return String(token).trim().toLowerCase() === this.usdcContractAddressLower();
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
    const trades: PlatformTapeFillRow[] = [...recent]
      .reverse()
      .map((o) => ({
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
   * `poketraceCardId` is returned under `reference` only — never used in floor/median/band/vol.
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
    const comp = (col?.components ?? {}) as Record<string, unknown>;
    const pid =
      typeof comp.poketraceCardId === 'string' && comp.poketraceCardId.trim()
        ? comp.poketraceCardId.trim()
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
        where: { side: OrderSide.ASK, status: OrderStatus.ACTIVE, collectionKey: IsNull() },
      });
      globalActiveAskTotal = await this.orderRepo.count({
        where: { side: OrderSide.ASK, status: OrderStatus.ACTIVE },
      });
    }

    this.logger.log(
      JSON.stringify({
        msg: 'collection_market_stats',
        collectionKey: key,
        marketplaceCollectionRow: Boolean(col),
        referencePoketraceCardIdPresent: Boolean(pid),
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
              globalActiveAskRowsWithNullCollectionKey: globalActiveAskNullKeyCount,
              pipelineHint:
                'If globalActiveAskRowsWithNullCollectionKey > 0 but activeAskRowsDb is 0, orders likely have NULL collection_key while UI stats use a meta-derived 64-char key.',
            }
          : {}),
        note:
          'Active listing query: orders.collection_key = key AND status = active AND side = ask. Stats path lowercases key; sha256 digest is lowercase hex.',
      }),
    );

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
      reference: { poketraceCardId: pid },
    };
  }

  async getCollectionMarketBundle(
    collectionKey: string,
    priceHistoryDuration: PriceHistoryDuration = '30d',
  ): Promise<CollectionMarketBundle> {
    const key = collectionKey.toLowerCase();
    const col = await this.collectionService.findOne(key);
    const ids = await this.collectionService.resolveJustTcgProductIdentifiersForCollection(key);
    const { platformUsd } = await this.platformTradesForApi(key);

    const empty: ParsedJustTcgMarket = {
      history: [],
      grades: { psa10: null, psa9: null, raw: null },
      gameLabel: null,
    };
    let parsed: ParsedJustTcgMarket = { ...empty };

    const mergeRaw = (raw: unknown) => {
      const next = parseJustTcgCardsResponseBest(raw);
      if (scoreMarketPriceParsed(next) > scoreMarketPriceParsed(parsed)) {
        parsed = next;
      }
    };

    const directQueries: GetCardsDto[] = [];
    if (ids.cardId) {
      directQueries.push({
        cardId: ids.cardId,
        include_price_history: false,
        priceHistoryDuration,
        limit: 1,
      });
    }
    if (ids.variantId) {
      directQueries.push({
        variantId: ids.variantId,
        include_price_history: false,
        priceHistoryDuration,
        limit: 1,
      });
    }
    if (ids.tcgplayerId) {
      directQueries.push({
        tcgplayerId: ids.tcgplayerId,
        include_price_history: false,
        priceHistoryDuration,
        limit: 1,
      });
    }

    for (const opts of directQueries) {
      if (hasUsefulJustTcgMarketData(parsed)) break;
      try {
        const raw = await this.priceService.getCards(opts);
        mergeRaw(raw);
      } catch (e) {
        this.logger.warn(
          `JustTCG direct lookup failed for collection ${key} opts=${JSON.stringify(opts)}: ${String(e)}`,
        );
      }
    }

    const q = col?.queryUsed?.trim();
    if (q && q.length >= 2 && col && !hasUsefulJustTcgMarketData(parsed)) {
      const games = candidateJustTcgGamesForCollection({
        queryUsed: col.queryUsed,
        displayLabel: col.displayLabel,
        components: col.components as Record<string, unknown>,
      });
      for (const game of games) {
        try {
          const raw = await this.priceService.getCards({
            q,
            game,
            include_price_history: false,
            priceHistoryDuration,
            limit: 12,
          });
          mergeRaw(raw);
          if (hasUsefulJustTcgMarketData(parsed)) break;
        } catch (e) {
          this.logger.warn(
            `JustTCG search failed for collection ${key} game=${game}: ${String(e)}`,
          );
        }
      }
    }

    /** Collection “market price” = `GET …/stats` (listings). Bundle keeps grade strip from JustTCG only. */
    const externalUsd: UsdPoint[] = [];
    const marketChangePct: number | null = null;
    const marketChangeSource: MarketChangePriceSource | null = 'none';
    const isMockExternalPrices = false;

    return {
      collectionKey: key,
      justtcgCardId: ids.cardId,
      categoryLabel: parsed.gameLabel,
      marketChangePct,
      marketChangeWindow: priceHistoryDuration,
      marketChangeSource,
      isMockExternalPrices,
      gradePrices: parsed.grades,
      externalUsd,
      platformUsd,
    };
  }

  async batchListSnapshots(
    collectionKeys: string[],
    priceHistoryDuration: PriceHistoryDuration = '30d',
  ): Promise<{ items: CollectionListSnapshot[] }> {
    const keys = [...new Set(collectionKeys.map((k) => k.toLowerCase()))].slice(0, 40);
    const settled = await Promise.all(
      keys.map(async (key) => {
        try {
          const [bundle, stats] = await Promise.all([
            this.getCollectionMarketBundle(key, priceHistoryDuration),
            this.getCollectionMarketStats(key).catch(() => null),
          ]);
          return bundleToListSnapshot(bundle, stats);
        } catch (e) {
          this.logger.warn(`batch snapshot failed for ${key}: ${String(e)}`);
          return {
            collectionKey: key,
            justtcgCardId: null,
            categoryLabel: null,
            marketChangePct: null,
            marketChangeWindow: priceHistoryDuration,
            marketChangeSource: null,
            isMockExternalPrices: false,
            gradePrices: { psa10: null, psa9: null, raw: null },
            sparklineUsd: [],
            marketStats: null,
          } satisfies CollectionListSnapshot;
        }
      }),
    );
    return { items: settled };
  }
}

export interface CollectionListSnapshot {
  collectionKey: string;
  justtcgCardId: string | null;
  categoryLabel: string | null;
  marketChangePct: number | null;
  marketChangeWindow: PriceHistoryDuration;
  marketChangeSource: MarketChangePriceSource | null;
  isMockExternalPrices: boolean;
  gradePrices: GradePriceStrip;
  /** Downsampled external series for list sparkline */
  sparklineUsd: UsdPoint[];
  /** Pool stats — same as `GET …/collections/:key/stats` when available */
  marketStats: CollectionMarketStatsResponse | null;
}

function bundleToListSnapshot(
  bundle: CollectionMarketBundle,
  marketStats: CollectionMarketStatsResponse | null,
): CollectionListSnapshot {
  const spark = downsampleSpark(bundle.externalUsd, 24);
  return {
    collectionKey: bundle.collectionKey,
    justtcgCardId: bundle.justtcgCardId,
    categoryLabel: bundle.categoryLabel,
    marketChangePct: bundle.marketChangePct,
    marketChangeWindow: bundle.marketChangeWindow,
    marketChangeSource: bundle.marketChangeSource,
    isMockExternalPrices: bundle.isMockExternalPrices,
    gradePrices: bundle.gradePrices,
    sparklineUsd: spark,
    marketStats,
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
