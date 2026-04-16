import { Injectable, Logger } from '@nestjs/common';
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

export type PriceHistoryDuration = '7d' | '30d' | '90d' | '180d';

export interface CollectionMarketBundle {
  collectionKey: string;
  justtcgCardId: string | null;
  categoryLabel: string | null;
  /** Percent change from first to last point of external (JustTCG) series */
  marketChangePct: number | null;
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
}

@Injectable()
export class CollectionMarketService {
  private readonly logger = new Logger(CollectionMarketService.name);

  constructor(
    private readonly collectionService: CollectionService,
    private readonly priceService: PriceService,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

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

    return {
      collectionKey: key,
      justtcgCardId: ids.cardId,
      categoryLabel: parsed.gameLabel,
      marketChangePct: percentChangeFromPoints(parsed.history),
      gradePrices: parsed.grades,
      externalUsd: parsed.history,
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
