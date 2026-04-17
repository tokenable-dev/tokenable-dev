import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GetCardsDto } from '../price/dto/get-cards.dto';
import { PriceService } from '../price/price.service';
import { CollectionService } from './collection.service';
import {
  candidateJustTcgGamesForCollection,
  hasUsefulJustTcgMarketData,
  parseJustTcgCardsResponseBest,
  percentChangeFromPoints,
  scoreMarketPriceParsed,
  type GradePriceStrip,
  type ParsedJustTcgMarket,
  type UsdPoint,
} from './collection-market.util';
import { Order, OrderSide, OrderStatus } from './entities/order.entity';
import { PoketraceService } from '../poketrace/poketrace.service';

export type PriceHistoryDuration = '7d' | '30d' | '90d' | '180d';

function priceHistoryDurationToDays(d: PriceHistoryDuration): number {
  switch (d) {
    case '7d':
      return 7;
    case '30d':
      return 30;
    case '90d':
      return 90;
    case '180d':
      return 180;
    default:
      return 30;
  }
}

/** Where list-row % change + sparkline external series came from */
export type MarketChangePriceSource =
  | 'poketrace_nm_ebay'
  | 'justtcg_card_history';

export interface CollectionMarketBundle {
  collectionKey: string;
  justtcgCardId: string | null;
  categoryLabel: string | null;
  /**
   * Percent change from first to last point of the chosen external series
   * (sorted by time): ((last - first) / first) * 100.
   */
  marketChangePct: number | null;
  /** Requested JustTCG priceHistory window; also used as PokeTrace NM `days` cap */
  marketChangeWindow: PriceHistoryDuration;
  /** Series used for `marketChangePct` + sparkline (PokeTrace preferred when available) */
  marketChangeSource: MarketChangePriceSource | null;
  /** True when %/sparkline use JustTCG while `TCG_USE_MOCK` is on (fixture data) */
  isMockExternalPrices: boolean;
  gradePrices: GradePriceStrip;
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
    private readonly poketraceService: PoketraceService,
    private readonly config: ConfigService,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  private isTcgMock(): boolean {
    const v = this.config.get<string>('TCG_USE_MOCK');
    return v === 'true' || v === '1' || v === 'yes';
  }

  private usdcNumber(amount: string): number | null {
    try {
      const v = Number(BigInt(amount)) / 1_000_000;
      return Number.isFinite(v) ? v : null;
    } catch {
      return null;
    }
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
      const v = this.usdcNumber(o.considerationAmount);
      if (v == null) continue;
      valid.push(o);
    }
    const platformUsd: UsdPoint[] = valid.map((o) => ({
      t: Math.floor(o.updatedAt.getTime() / 1000),
      v: this.usdcNumber(o.considerationAmount)!,
    }));
    const recent = valid.slice(-80);
    const trades: PlatformTapeFillRow[] = [...recent]
      .reverse()
      .map((o) => ({
        t: Math.floor(o.updatedAt.getTime() / 1000),
        priceUsdc: this.usdcNumber(o.considerationAmount)!,
        tokenId: String(o.tokenId),
        orderHash: o.orderHash,
        tapeAggressor: tapeAggressorFromOrderParameters(o.parameters),
      }));
    return { platformUsd, trades };
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
        include_price_history: true,
        priceHistoryDuration,
        limit: 1,
      });
    }
    if (ids.variantId) {
      directQueries.push({
        variantId: ids.variantId,
        include_price_history: true,
        priceHistoryDuration,
        limit: 1,
      });
    }
    if (ids.tcgplayerId) {
      directQueries.push({
        tcgplayerId: ids.tcgplayerId,
        include_price_history: true,
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
            include_price_history: true,
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

    /** Default: JustTCG representative card price history */
    const tcgMock = this.isTcgMock();
    let externalUsd: UsdPoint[] = parsed.history;
    let marketChangePct = percentChangeFromPoints(parsed.history);
    let marketChangeSource: MarketChangePriceSource | null =
      parsed.history.length >= 2 ? 'justtcg_card_history' : null;

    /** Prefer PokeTrace eBay NEAR_MINT sale timeline when catalog resolves + history returns */
    if (col) {
      try {
        const nm = await this.poketraceService.getNearMintHistoryForCollection(
          col,
          {
            days: priceHistoryDurationToDays(priceHistoryDuration),
            maxRequests: 3,
          },
        );
        if (nm.matched && nm.points.length >= 2) {
          externalUsd = nm.points;
          marketChangePct = percentChangeFromPoints(nm.points);
          marketChangeSource = 'poketrace_nm_ebay';
        }
      } catch (e) {
        this.logger.warn(
          `PokeTrace NM history for exchange snapshot ${key}: ${String(e)}`,
        );
      }
    }

    const isMockExternalPrices =
      marketChangeSource === 'justtcg_card_history' && tcgMock;

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
    const items: CollectionListSnapshot[] = [];
    for (const key of keys) {
      try {
        const bundle = await this.getCollectionMarketBundle(key, priceHistoryDuration);
        items.push(bundleToListSnapshot(bundle));
      } catch (e) {
        this.logger.warn(`batch snapshot failed for ${key}: ${String(e)}`);
        items.push({
          collectionKey: key,
          justtcgCardId: null,
          categoryLabel: null,
          marketChangePct: null,
          marketChangeWindow: priceHistoryDuration,
          marketChangeSource: null,
          isMockExternalPrices: false,
          gradePrices: { psa10: null, psa9: null, raw: null },
          sparklineUsd: [],
        });
      }
    }
    return { items };
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
}

function bundleToListSnapshot(bundle: CollectionMarketBundle): CollectionListSnapshot {
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
