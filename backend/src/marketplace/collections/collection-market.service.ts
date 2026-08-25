import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CollectionService } from './collection.service';
import {
  ChainConfigService,
  type SupportedChainId,
} from '../../blockchain/chain-config.service';
import { CollectionMarketSnapshotReadService } from '../snapshots/collection-market-snapshot-read.service';
import { CollectionMarketSnapshotSchedulerService } from '../snapshots/collection-market-snapshot-scheduler.service';
import { CollectionMarketSnapshotService } from '../snapshots/collection-market-snapshot.service';
import {
  type GradePriceStrip,
  type UsdPoint,
  referenceChangeWithBestWindow,
} from '../utils/collection-market.util';
import { Order, OrderSide, OrderStatus } from '../entities/order.entity';
import { CollectionMarketSnapshot } from '../entities/collection-market-snapshot.entity';
import { computeRobustMarketStatsFromUsdPrices } from '../utils/collection-market-stats.util';
import type { MarketCollectionPreview } from '../utils/market-reference.types';
import {
  cardhedgerRawSalesToTapeRows,
  computeCollectionTradesVolumeStats,
  mergePlatformAndCardhedgerTape,
  type CollectionTradesVolumeStats,
  type PlatformTapeFillRow,
} from '../utils/collection-tape-merge.util';
import { CARDHEDGER_COMPS_HISTORY_RAW_COUNT } from '../market-data/cardhedger-pricing.service';
import {
  resolveFulfilledAskTokenId,
  resolvePlatformTapeFill,
} from '../utils/platform-tape.util';
import { CardhedgerMarketDataService } from '../market-data/cardhedger-market-data.service';
import type {
  CollectionGradeCatalogEntry,
} from '../utils/cardhedger-grade-catalog.util';
import {
  catalogFromAllPricesRows,
  catalogFromPricesByGradeMap,
  catalogPriceForSlabGrade,
  collectionGradeLabelFromHistoryTier,
} from '../utils/cardhedger-grade-catalog.util';
import { marketHistoryTierFromComponents } from '../utils/market-history-tier.util';
import { CARDHEDGER_CARD_ID_SOURCE_PSA_CERT } from '../utils/card-match.util';
import {
  buildMaterializedSnapshotPayload,
  filterExternalUsdForChartWindow,
} from '../utils/market-snapshot-normalize.util';
import { nmHistoryDaysForBundleWindow } from '../utils/market-grade-strip.util';
import type { MarketplaceCollection } from '../entities/marketplace-collection.entity';

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
  /** comps | latest_sale | catalog | psa_estimate — materialized snapshot spot basis. */
  spotPriceBasis?: string | null;
  /** All Cardhedger grade slots (PSA, BGS, SGC, …) for chart grade picker. */
  allGradePrices: CollectionGradeCatalogEntry[];
  /** This collection slab's Cardhedger grade label (e.g. `PSA 8`). */
  collectionGrade: string | null;
  /** Internal tier key stored on snapshot (`PSA_8`, `PSA_AUTH`, …). */
  historyTier: string | null;
  externalUsd: UsdPoint[];
  platformUsd: UsdPoint[];
  cardhedgerPreview: MarketCollectionPreview;
  snapshotStale?: boolean;
  syncedAt?: string;
  reliabilityScore?: number;
}

export interface CollectionGradePriceSeries {
  collectionKey: string;
  grade: string;
  cardhedgerCardId: string | null;
  points: UsdPoint[];
  days: number;
}

export interface CollectionGradeCatalogResponse {
  collectionKey: string;
  cardhedgerCardId: string | null;
  collectionGrade: string | null;
  historyTier: string | null;
  grades: CollectionGradeCatalogEntry[];
  source: 'snapshot' | 'live';
}

export type { CollectionTradesVolumeStats, PlatformTapeFillRow } from '../utils/collection-tape-merge.util';

function tapeAggressorFromOrderParameters(
  parameters: Record<string, unknown>,
): 'buy' | 'sell' {
  const s = parameters['_tapeFillSide'];
  if (s === 'sell') return 'sell';
  return 'buy';
}

/** Row can serve list/detail bundle reads (preview and/or materialized grade strip). */
function rowHasMaterializedListPrices(
  row: CollectionMarketSnapshot,
): boolean {
  if (row.previewJson) return true;
  const headline = row.headlineUsd;
  if (typeof headline === 'number' && Number.isFinite(headline) && headline > 0) {
    return true;
  }
  const gp = row.gradePricesJson as GradePriceStrip | null | undefined;
  if (gp?.psa10 != null && Number.isFinite(gp.psa10) && gp.psa10 > 0) {
    return true;
  }
  if (gp?.psa9 != null && Number.isFinite(gp.psa9) && gp.psa9 > 0) {
    return true;
  }
  if (gp?.raw != null && Number.isFinite(gp.raw) && gp.raw > 0) {
    return true;
  }
  if (
    typeof row.psa10Usd === 'number' &&
    Number.isFinite(row.psa10Usd) &&
    row.psa10Usd > 0
  ) {
    return true;
  }
  return false;
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
    allGradePrices: [],
    collectionGrade: null,
    historyTier: null,
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
    private readonly chainConfig: ChainConfigService,
    private readonly snapshotService: CollectionMarketSnapshotService,
    private readonly snapshotRead: CollectionMarketSnapshotReadService,
    private readonly snapshotScheduler: CollectionMarketSnapshotSchedulerService,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly cardhedgerMarket: CardhedgerMarketDataService,
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
    chainId?: SupportedChainId,
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

    const { platformUsd } = await this.platformTradesForApi(key, undefined, chainId);
    let row = await this.snapshotService.findByKey(key);

    if (!(await this.snapshotService.isUsableForRead(row, key))) {
      row =
        (await this.snapshotService.resolveSnapshotForRead(
          key,
          'cold_start',
        )) ?? row;
    }

    let bundle: CollectionMarketBundle;
    if (!row || !rowHasMaterializedListPrices(row)) {
      bundle = emptyMarketBundle(key, platformUsd, window);
    } else {
      const stale = this.snapshotService.isRowStale(row);
      const preview = row.previewJson;
      const needsHistoryRefresh =
        preview != null &&
        preview.matched !== true &&
        (row.externalUsdJson?.length ?? 0) < 2;
      this.touchAndMaybeRefreshStale(key, stale || needsHistoryRefresh);
      bundle = this.snapshotRead.buildBundleFromRow(
        row,
        window,
        platformUsd,
      ).bundle;
    }

    return this.overlayLiveCardhedgerWhenThin(bundle, key, window);
  }

  /**
   * Collection row for market reads — back-fill `cardhedgerCardId` from active listing
   * metadata when missing (same side effect as visiting collection detail once).
   */
  private async collectionForMarketRead(
    key: string,
  ): Promise<MarketplaceCollection | null> {
    let col = await this.collectionService.findOne(key);
    if (!col) return null;

    let storedId = String(col.components?.cardhedgerCardId ?? '').trim();
    if (!storedId) {
      const updated =
        await this.collectionService.ensureCardhedgerCardIdFromListings(key);
      if (updated) {
        this.snapshotScheduler.enqueue(key, 'stale_swr');
        col = (await this.collectionService.findOne(key)) ?? col;
        storedId = String(col.components?.cardhedgerCardId ?? '').trim();
      }
    }

    if (!storedId && col.psaCertNumber?.trim()) {
      try {
        const resolved = await this.cardhedgerMarket.tryResolveCardIdByCert(
          col.psaCertNumber.trim(),
          { collection: col },
        );
        if (resolved?.cardId) {
          await this.collectionService.mergeComponentsForMintBootstrap(key, {
            cardhedgerCardId: resolved.cardId,
            cardhedgerCardIdSource: CARDHEDGER_CARD_ID_SOURCE_PSA_CERT,
            ...(resolved.query
              ? { cardhedgerSearchQuery: resolved.query }
              : {}),
          });
          this.snapshotScheduler.enqueue(key, 'stale_swr');
          col = (await this.collectionService.findOne(key)) ?? col;
        }
      } catch (e) {
        this.logger.debug(
          `cert cardhedger resolve skipped key=${key}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    return col;
  }

  /**
   * Materialized snapshots can lag behind collection detail (PSA estimate only) while
   * live Cardhedger + listing metadata already have comps. Overlay matches detail UX.
   */
  private async overlayLiveCardhedgerWhenThin(
    bundle: CollectionMarketBundle,
    key: string,
    window: PriceHistoryDuration,
  ): Promise<CollectionMarketBundle> {
    const thin =
      bundle.spotPriceBasis === 'psa_estimate' ||
      bundle.cardhedgerPreview?.matched !== true ||
      (bundle.marketChangePct == null &&
        (bundle.externalUsd?.length ?? 0) < 2);
    if (!thin) return bundle;

    const col = await this.collectionForMarketRead(key);
    if (!col) return bundle;

    if (!this.cardhedgerMarket.isConfigured()) {
      return enrichListBundleFromCollection(bundle, col);
    }

    const fromStoredId = await this.overlayFromStoredCatalogId(
      bundle,
      col,
      window,
    ).catch((e) => {
      this.logger.debug(
        `stored catalog overlay failed key=${key}: ${e instanceof Error ? e.message : String(e)}`,
      );
      return null;
    });
    if (fromStoredId) return fromStoredId;

    try {
      const historyTier = marketHistoryTierFromComponents(col.components);
      const maxCalendarDays = nmHistoryDaysForBundleWindow(window);
      const { preview, history } = await this.cardhedgerMarket.getBundledCardData(
        col,
        {
          tier: historyTier,
          period: '1y',
          maxCalendarDays,
          maxRequests: 4,
          includeComps: false,
        },
      );

      const payload = buildMaterializedSnapshotPayload({
        collectionKey: key,
        historyTier,
        preview,
        historyPoints: history.points,
        psaEstimateUsd: psaEstimateUsdFromComponents(col.components),
      });

      const liveWorthUsing =
        preview.matched === true ||
        (history.points?.length ?? 0) >= 2 ||
        (payload.spotPriceBasis != null &&
          payload.spotPriceBasis !== 'psa_estimate');
      if (!liveWorthUsing) {
        return enrichListBundleFromCollection(bundle, col);
      }

      return mergeLiveCardhedgerOverlay(bundle, window, historyTier, {
        gradePrices: payload.gradePricesJson ?? bundle.gradePrices,
        spotPriceBasis: payload.spotPriceBasis,
        cardhedgerPreview: preview,
        externalUsdFull: payload.externalUsdJson ?? [],
        categoryLabel: payload.categoryLabel,
        snapshotStale: bundle.snapshotStale ?? true,
      });
    } catch (e) {
      this.logger.debug(
        `live cardhedger overlay failed key=${key}: ${e instanceof Error ? e.message : String(e)}`,
      );
      return enrichListBundleFromCollection(bundle, col);
    }
  }

  /**
   * Direct Cardhedger reads by mint/catalog `cardhedgerCardId` — same path as detail grade
   * chart, without re-running strict PSA Variety resolve on search picks.
   */
  private async overlayFromStoredCatalogId(
    bundle: CollectionMarketBundle,
    col: MarketplaceCollection,
    window: PriceHistoryDuration,
  ): Promise<CollectionMarketBundle | null> {
    const cardId = String(col.components?.cardhedgerCardId ?? '').trim();
    if (!cardId) return null;

    const historyTier = marketHistoryTierFromComponents(col.components);
    const slabGrade =
      collectionGradeLabelFromHistoryTier(historyTier) || 'PSA 10';
    const maxDays = nmHistoryDaysForBundleWindow(window);

    const [catalogGrades, points] = await Promise.all([
      this.cardhedgerMarket.getGradeCatalogForCardId(cardId),
      this.cardhedgerMarket.getGradePriceSeriesByCardId(
        cardId,
        slabGrade,
        maxDays,
      ),
    ]);

    const catalogPrice = catalogPriceForSlabGrade(catalogGrades, slabGrade);
    const hasHistory = points.length >= 2;
    if (
      (catalogPrice == null || !(catalogPrice > 0)) &&
      !hasHistory
    ) {
      return null;
    }

    const gradePrices: GradePriceStrip = { ...bundle.gradePrices };
    if (catalogPrice != null && catalogPrice > 0) {
      if (historyTier === 'PSA_9') gradePrices.psa9 = catalogPrice;
      else gradePrices.psa10 = catalogPrice;
    }

    const spotPrice =
      catalogPrice != null && catalogPrice > 0
        ? catalogPrice
        : points.length > 0
          ? points[points.length - 1]!.v
          : null;

    const preview = previewFromStoredCatalogOverlay({
      col,
      cardId,
      catalogGrades,
      historyTier,
      spotPrice,
    });

    return mergeLiveCardhedgerOverlay(bundle, window, historyTier, {
      gradePrices,
      spotPriceBasis: 'latest_sale',
      cardhedgerPreview: preview,
      externalUsdFull: points,
      categoryLabel: preview.card?.setName ?? null,
      snapshotStale: bundle.snapshotStale ?? true,
      allGradePrices: catalogGrades,
    });
  }

  /**
   * Live Cardhedger catalog — all graders / grades for the matched card.
   */
  async getCollectionGradeCatalog(
    collectionKey: string,
    opts?: { preferLive?: boolean },
  ): Promise<CollectionGradeCatalogResponse> {
    const key = collectionKey.toLowerCase();
    const col = await this.collectionService.findOne(key);
    if (!col) {
      throw new NotFoundException(`Collection not found: ${key}`);
    }
    const historyTier = marketHistoryTierFromComponents(col.components);
    const collectionGrade = collectionGradeLabelFromHistoryTier(historyTier);
    const cardId = String(col.components?.cardhedgerCardId ?? '').trim();

    if (opts?.preferLive && cardId) {
      const grades = await this.cardhedgerMarket.getGradeCatalogForCardId(cardId);
      if (grades.length > 0) {
        return {
          collectionKey: key,
          cardhedgerCardId: cardId,
          collectionGrade,
          historyTier,
          grades,
          source: 'live',
        };
      }
    }

    const row = await this.snapshotService.findByKey(key);
    const preview = row?.previewJson;
    if (preview?.card?.pricesByGrade) {
      return {
        collectionKey: key,
        cardhedgerCardId:
          preview.card.id?.trim() || cardId || null,
        collectionGrade,
        historyTier,
        grades: catalogFromPricesByGradeMap(preview.card.pricesByGrade),
        source: 'snapshot',
      };
    }

    if (cardId) {
      const grades = await this.cardhedgerMarket.getGradeCatalogForCardId(cardId);
      return {
        collectionKey: key,
        cardhedgerCardId: cardId,
        collectionGrade,
        historyTier,
        grades,
        source: 'live',
      };
    }

    return {
      collectionKey: key,
      cardhedgerCardId: null,
      collectionGrade,
      historyTier,
      grades: [],
      source: 'snapshot',
    };
  }

  /**
   * Price history for any Cardhedger grade label (PSA 10, BGS 9.5, Ungraded, …).
   */
  async getCollectionGradePriceSeries(
    collectionKey: string,
    gradeLabel: string,
    daysRaw?: number,
  ): Promise<CollectionGradePriceSeries> {
    const key = collectionKey.toLowerCase();
    const grade = String(gradeLabel ?? '').trim();
    if (!grade) {
      throw new BadRequestException('grade query parameter is required');
    }
    const days = Math.min(
      365,
      Math.max(1, Math.floor(Number(daysRaw ?? 365) || 365)),
    );

    const col = await this.collectionService.findOne(key);
    if (!col) {
      throw new NotFoundException(`Collection not found: ${key}`);
    }

    let cardId = String(col.components?.cardhedgerCardId ?? '').trim();
    if (!cardId) {
      const row = await this.snapshotService.findByKey(key);
      cardId = String(row?.previewJson?.card?.id ?? '').trim();
    }
    if (!cardId) {
      const resolved = await this.cardhedgerMarket.tryResolveCardIdByCert(
        col.psaCertNumber?.trim() ?? '',
        { collection: col },
      );
      cardId = String(resolved?.cardId ?? '').trim();
    }

    const points = cardId
      ? await this.cardhedgerMarket.getGradePriceSeriesByCardId(
          cardId,
          grade,
          days,
        )
      : [];

    return {
      collectionKey: key,
      grade,
      cardhedgerCardId: cardId || null,
      points,
      days,
    };
  }

  private usdcContractAddressLower(chainId?: SupportedChainId): string {
    const resolved = chainId ?? this.chainConfig.getDefaultChainId();
    return this.chainConfig.getUsdcAddress(resolved).toLowerCase();
  }

  private isUsdcConsiderationToken(
    token: string | null | undefined,
    chainId?: SupportedChainId,
  ): boolean {
    if (!token || !String(token).trim()) return false;
    return (
      String(token).trim().toLowerCase() ===
      this.usdcContractAddressLower(chainId)
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

  private classifyUsdcConsideration(
    o: Order,
    chainId?: SupportedChainId,
  ): {
    usd: number | null;
    skip: 'none' | 'non_usdc' | 'invalid_amount';
  } {
    if (!this.isUsdcConsiderationToken(o.considerationToken, chainId)) {
      return { usd: null, skip: 'non_usdc' };
    }
    const v = this.usdcMicrosToNumber(o.considerationAmount);
    if (v == null || v <= 0) return { usd: null, skip: 'invalid_amount' };
    return { usd: v, skip: 'none' };
  }

  private usdcPriceFromOrder(
    o: Order,
    label: string,
    chainId?: SupportedChainId,
  ): number | null {
    const { usd, skip } = this.classifyUsdcConsideration(o, chainId);
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

  private platformTradesScanMax(): number {
    return (
      this.config.get<number>('marketplace.platformTradesFulfilledScanMax') ??
      500
    );
  }

  private marketStatsFulfilledScanMax(): number {
    return (
      this.config.get<number>('marketplace.marketStatsFulfilledScanMax') ?? 400
    );
  }

  async platformTradesForApi(
    collectionKey: string,
    opts?: { bootstrapTokenId?: number; cardhedgerGrade?: string },
    chainId?: SupportedChainId,
  ): Promise<{
    platformUsd: UsdPoint[];
    trades: PlatformTapeFillRow[];
    volume: CollectionTradesVolumeStats;
  }> {
    const k = collectionKey.toLowerCase();
    const { platformUsd, platformTrades } =
      await this.buildPlatformTradesForKey(k, chainId);

    let cardhedgerTrades: PlatformTapeFillRow[] = [];
    try {
      let col = await this.collectionService.findOne(k);
      const bootstrapTokenId = opts?.bootstrapTokenId;
      if (
        !col &&
        bootstrapTokenId != null &&
        Number.isFinite(bootstrapTokenId) &&
        bootstrapTokenId >= 0
      ) {
        const ensured = await this.collectionService.ensureCollectionForListing(
          String(Math.floor(bootstrapTokenId)),
          chainId,
        );
        if (ensured?.trim().toLowerCase() === k) {
          col = await this.collectionService.findOne(k);
        }
      }

      // ── Lazy cardId enrichment ─────────────────────────────────────────────
      // Persist cert → cardId when missing so later pricing paths can reuse it.
      if (col && !col.components?.cardhedgerCardId && col.psaCertNumber?.trim()) {
        try {
          const resolved = await this.cardhedgerMarket.tryResolveCardIdByCert(
            col.psaCertNumber.trim(),
            { collection: col },
          );
          if (resolved?.cardId) {
            await this.collectionService.mergeComponentsForMintBootstrap(k, {
              cardhedgerCardId: resolved.cardId,
              cardhedgerCardIdSource: CARDHEDGER_CARD_ID_SOURCE_PSA_CERT,
              ...(resolved.query ? { cardhedgerSearchQuery: resolved.query } : {}),
            });
            col = await this.collectionService.findOne(k);
            this.logger.log(
              `platform-trades: lazy cardId enrichment for ${k} → ${resolved.cardId}`,
            );
          } else if (resolved?.certDescription) {
            await this.collectionService.mergeComponentsForMintBootstrap(k, {
              cardhedgerSearchQuery: resolved.certDescription,
            });
            col = await this.collectionService.findOne(k);
          }
        } catch (e) {
          this.logger.debug(
            `platform-trades: cert-lookup skipped for ${k}: ${String(e)}`,
          );
        }
      }

      const cardhedgerGrade = String(opts?.cardhedgerGrade ?? '').trim();
      const tier = marketHistoryTierFromComponents(col?.components);
      const compsOpts = cardhedgerGrade
        ? {
            gradeLabel: cardhedgerGrade,
            rawCount: CARDHEDGER_COMPS_HISTORY_RAW_COUNT,
          }
        : { tier, rawCount: CARDHEDGER_COMPS_HISTORY_RAW_COUNT };
      const comps = await this.cardhedgerMarket.getCompsSnapshotForTradesTape(
        col,
        compsOpts,
      );
      cardhedgerTrades = cardhedgerRawSalesToTapeRows(
        comps.rawSales,
        comps.cardId,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `platform-trades: Cardhedger comps skipped for ${k}: ${msg}`,
      );
    }

    const merged = mergePlatformAndCardhedgerTape(
      platformTrades,
      cardhedgerTrades,
    );
    const volume = computeCollectionTradesVolumeStats(merged);

    return { platformUsd, trades: merged, volume };
  }

  /**
   * Trades tape for a single RWA token — no marketplace_collections row required.
   * Platform fills for this tokenId + Cardhedger comps from mint metadata (cert → cardId).
   */
  async rwaTradesForApi(
    tokenId: number,
    opts?: { cardhedgerGrade?: string },
    chainId?: SupportedChainId,
  ): Promise<{
    platformUsd: UsdPoint[];
    trades: PlatformTapeFillRow[];
    volume: CollectionTradesVolumeStats;
  }> {
    const id = Math.floor(Number(tokenId));
    if (!Number.isFinite(id) || id < 0) {
      throw new BadRequestException('Invalid token id');
    }

    const { platformUsd, platformTrades } =
      await this.buildPlatformTradesForTokenId(id, chainId);

    let cardhedgerTrades: PlatformTapeFillRow[] = [];
    try {
      const cardhedgerGrade = String(opts?.cardhedgerGrade ?? '').trim();
      const compsOpts = cardhedgerGrade
        ? {
            gradeLabel: cardhedgerGrade,
            rawCount: CARDHEDGER_COMPS_HISTORY_RAW_COUNT,
            chainId,
          }
        : { rawCount: CARDHEDGER_COMPS_HISTORY_RAW_COUNT, chainId };
      const comps = await this.cardhedgerMarket.getCompsSnapshotForTokenId(
        id,
        compsOpts,
      );
      cardhedgerTrades = cardhedgerRawSalesToTapeRows(
        comps.rawSales,
        comps.cardId,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`rwa-trades: Cardhedger comps skipped for #${id}: ${msg}`);
    }

    const merged = mergePlatformAndCardhedgerTape(
      platformTrades,
      cardhedgerTrades,
    );
    const volume = computeCollectionTradesVolumeStats(merged);

    return { platformUsd, trades: merged, volume };
  }

  /** Platform-only fulfilled orders (chart platform series + tape platform rows). */
  private async buildPlatformTradesForKey(
    collectionKey: string,
    chainId?: SupportedChainId,
  ): Promise<{
    platformUsd: UsdPoint[];
    platformTrades: PlatformTapeFillRow[];
  }> {
    const resolved = chainId ?? this.chainConfig.getDefaultChainId();
    const rwa = this.chainConfig.getRwaAddress(resolved).toLowerCase();
    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.collection_key = :key', { key: collectionKey })
      .andWhere('o.status = :status', { status: OrderStatus.FULFILLED })
      .andWhere('LOWER(o.token_contract) = :rwa', { rwa })
      .orderBy('o.updated_at', 'DESC')
      .take(this.platformTradesScanMax())
      .getMany();
    const validNewestFirst: {
      order: Order;
      tokenId: string;
      priceUsdc: number;
    }[] = [];
    for (const o of rows) {
      const priceUsdc = this.usdcPriceFromOrder(o, 'platform-trades', resolved);
      const fill = resolvePlatformTapeFill(o, priceUsdc);
      if (!fill) continue;
      validNewestFirst.push({
        order: o,
        tokenId: fill.tokenId,
        priceUsdc: fill.priceUsdc,
      });
    }
    const chronological = [...validNewestFirst].reverse();
    const platformUsd: UsdPoint[] = chronological.map(({ order: o, priceUsdc }) => ({
      t: Math.floor(o.updatedAt.getTime() / 1000),
      v: priceUsdc,
    }));
    const platformTrades: PlatformTapeFillRow[] = [...chronological]
      .reverse()
      .map(({ order: o, tokenId, priceUsdc }) => ({
        t: Math.floor(o.updatedAt.getTime() / 1000),
        priceUsdc,
        tokenId,
        orderHash: o.orderHash,
        tapeAggressor: tapeAggressorFromOrderParameters(o.parameters),
        source: 'platform' as const,
      }));
    return { platformUsd, platformTrades };
  }

  /** Fulfilled on-platform sales for one RWA token (collection row optional). */
  private async buildPlatformTradesForTokenId(
    tokenId: number,
    chainId?: SupportedChainId,
  ): Promise<{
    platformUsd: UsdPoint[];
    platformTrades: PlatformTapeFillRow[];
  }> {
    const tid = String(Math.floor(tokenId));
    const resolved = chainId ?? this.chainConfig.getDefaultChainId();
    const rwa = this.chainConfig.getRwaAddress(resolved).toLowerCase();
    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.token_id = :tid', { tid })
      .andWhere('o.status = :status', { status: OrderStatus.FULFILLED })
      .andWhere('LOWER(o.token_contract) = :rwa', { rwa })
      .orderBy('o.updated_at', 'DESC')
      .take(this.platformTradesScanMax())
      .getMany();
    const validNewestFirst: {
      order: Order;
      tokenId: string;
      priceUsdc: number;
    }[] = [];
    for (const o of rows) {
      const priceUsdc = this.usdcPriceFromOrder(o, 'rwa-trades', resolved);
      const fill = resolvePlatformTapeFill(o, priceUsdc);
      if (!fill) continue;
      if (fill.tokenId !== tid) continue;
      validNewestFirst.push({
        order: o,
        tokenId: fill.tokenId,
        priceUsdc: fill.priceUsdc,
      });
    }
    const chronological = [...validNewestFirst].reverse();
    const platformUsd: UsdPoint[] = chronological.map(({ order: o, priceUsdc }) => ({
      t: Math.floor(o.updatedAt.getTime() / 1000),
      v: priceUsdc,
    }));
    const platformTrades: PlatformTapeFillRow[] = [...chronological]
      .reverse()
      .map(({ order: o, tokenId: rowTokenId, priceUsdc }) => ({
        t: Math.floor(o.updatedAt.getTime() / 1000),
        priceUsdc,
        tokenId: rowTokenId,
        orderHash: o.orderHash,
        tapeAggressor: tapeAggressorFromOrderParameters(o.parameters),
        source: 'platform' as const,
      }));
    return { platformUsd, platformTrades };
  }

  async getActiveListingUsdcPrices(
    collectionKey: string,
    chainId?: SupportedChainId,
  ): Promise<number[]> {
    const key = collectionKey.toLowerCase();
    const resolved = chainId ?? this.chainConfig.getDefaultChainId();
    const asks =
      await this.collectionService.activeListingsForCollection(key, resolved);
    const prices: number[] = [];
    for (const o of asks) {
      const { usd, skip } = this.classifyUsdcConsideration(o, resolved);
      if (skip === 'none' && usd != null && usd > 0) prices.push(usd);
    }
    return prices;
  }

  async getCollectionMarketStats(
    collectionKey: string,
    chainId?: SupportedChainId,
  ): Promise<CollectionMarketStatsResponse> {
    const key = collectionKey.toLowerCase();
    const resolved = chainId ?? this.chainConfig.getDefaultChainId();
    const col = await this.collectionService.findOne(key);
    const expectedUsdc = this.usdcContractAddressLower(resolved);

    const prices: number[] = [];
    const asks = await this.collectionService.activeListingsForCollection(
      key,
      resolved,
    );
    let askNonUsdc = 0;
    let askInvalidAmount = 0;
    let poolFromActiveAsks = 0;
    for (const o of asks) {
      const { usd, skip } = this.classifyUsdcConsideration(o, resolved);
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
    const rwa = this.chainConfig.getRwaAddress(resolved).toLowerCase();
    const fulfilled = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.collection_key = :key', { key })
      .andWhere('o.status = :status', { status: OrderStatus.FULFILLED })
      .andWhere('o.side = :side', { side: OrderSide.ASK })
      .andWhere('LOWER(o.token_contract) = :rwa', { rwa })
      .orderBy('o.updated_at', 'DESC')
      .take(this.marketStatsFulfilledScanMax())
      .getMany();
    let fulfilledSkippedToken = 0;
    let fulfilledNonUsdc = 0;
    let fulfilledInvalidAmount = 0;
    for (const o of fulfilled) {
      const { usd, skip } = this.classifyUsdcConsideration(o, resolved);
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

    // Hot path: skip per-collection stats noise unless MARKETPLACE_PIPELINE_DIAG=1.
    if (diagOn) {
      this.logger.log(
        JSON.stringify({
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
          ...(rawPoolN === 0
            ? {
                globalActiveAskTotal,
                globalActiveAskRowsWithNullCollectionKey:
                  globalActiveAskNullKeyCount,
              }
            : {}),
        }),
      );
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
    chainId?: SupportedChainId,
  ): Promise<{ items: CollectionListSnapshot[] }> {
    const keys = [...new Set(collectionKeys.map((k) => k.toLowerCase()))].slice(
      0,
      60,
    );
    const window = priceHistoryDuration;

    /** Same bundle path as `GET …/market-series` (collection detail chart). */
    const LIST_SNAPSHOT_BATCH_CONCURRENCY = 8;
    const items: CollectionListSnapshot[] = [];

    for (let i = 0; i < keys.length; i += LIST_SNAPSHOT_BATCH_CONCURRENCY) {
      const chunk = keys.slice(i, i + LIST_SNAPSHOT_BATCH_CONCURRENCY);
      const chunkResults = await Promise.all(
        chunk.map(async (key) => {
          try {
            const [stats, bundle] = await Promise.all([
              this.getCollectionMarketStats(key, chainId).catch(() => null),
              this.getCollectionMarketBundle(key, window, chainId),
            ]);
            return bundleToListSnapshot(bundle, stats);
          } catch (e) {
            this.logger.warn(`batch snapshot failed for ${key}: ${String(e)}`);
            return emptyListSnapshot(key, window);
          }
        }),
      );
      items.push(...chunkResults);
    }
    return { items };
  }

  async batchPortfolioMarketData(
    collectionKeys: string[],
    opts: {
      priceHistoryDuration?: PriceHistoryDuration;
      chainId?: SupportedChainId;
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
    const chainId = opts.chainId;

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
              this.getCollectionMarketStats(key, chainId).catch(() => null),
              this.getCollectionMarketBundle(key, d, chainId).catch(() => null),
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
  marketChangeRefUsd?: number | null;
  marketChangeRefAtSec?: number | null;
  marketChangeSource: MarketChangePriceSource | null;
  gradePrices: GradePriceStrip;
  spotPriceBasis?: string | null;
  /** Same Cardhedger preview as collection detail `market-series`. */
  cardhedgerPreview?: MarketCollectionPreview;
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

function psaEstimateUsdFromComponents(
  components: Record<string, unknown> | null | undefined,
): number | null {
  const raw = components?.psaEstimateUsd;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }
  if (typeof raw === 'string') {
    const n = Number(
      raw
        .replace(/,/g, '')
        .replace(/\$/g, '')
        .match(/(\d+(?:\.\d+)?)/)?.[1] ?? NaN,
    );
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

function gradeStripHasPositiveUsd(gp: GradePriceStrip): boolean {
  return (
    (gp.psa10 != null && gp.psa10 > 0) ||
    (gp.psa9 != null && gp.psa9 > 0) ||
    (gp.raw != null && gp.raw > 0)
  );
}

/** Apply live Cardhedger catalog + history onto a materialized bundle (list/detail parity). */
function mergeLiveCardhedgerOverlay(
  bundle: CollectionMarketBundle,
  window: PriceHistoryDuration,
  historyTier: string,
  input: {
    gradePrices: GradePriceStrip;
    spotPriceBasis: string | null | undefined;
    cardhedgerPreview: MarketCollectionPreview;
    externalUsdFull: UsdPoint[];
    categoryLabel?: string | null;
    snapshotStale?: boolean;
    allGradePrices?: CollectionGradeCatalogEntry[];
  },
): CollectionMarketBundle {
  const change = referenceChangeWithBestWindow(input.externalUsdFull);
  return {
    ...bundle,
    categoryLabel: input.categoryLabel ?? bundle.categoryLabel,
    marketChangePct: change.pct,
    marketChangeWindow: change.window,
    marketChangeIsFullYear: change.isFullYear,
    marketChangeSpanSec: change.spanSec,
    marketChangeRefUsd: change.refUsd ?? undefined,
    marketChangeRefAtSec: change.refAtSec ?? undefined,
    marketChangeSource:
      change.pct != null
        ? historyTier === 'NEAR_MINT'
          ? 'cardhedger_nm'
          : 'cardhedger_graded'
        : bundle.marketChangeSource,
    gradePrices: input.gradePrices,
    spotPriceBasis: input.spotPriceBasis ?? bundle.spotPriceBasis,
    cardhedgerPreview: input.cardhedgerPreview,
    externalUsd: filterExternalUsdForChartWindow(input.externalUsdFull, window),
    allGradePrices:
      input.allGradePrices != null && input.allGradePrices.length > 0
        ? input.allGradePrices
        : bundle.allGradePrices,
    snapshotStale: input.snapshotStale ?? bundle.snapshotStale ?? true,
  };
}

function previewFromStoredCatalogOverlay(params: {
  col: MarketplaceCollection;
  cardId: string;
  catalogGrades: CollectionGradeCatalogEntry[];
  historyTier: string;
  spotPrice: number | null;
}): MarketCollectionPreview {
  const { col, cardId, catalogGrades, historyTier, spotPrice } = params;
  const comp = col.components ?? {};
  const tierU = String(historyTier ?? '').trim().toUpperCase();
  const pricesByGrade: Record<string, number> = {};
  for (const e of catalogGrades) {
    if (e.priceUsd != null && e.priceUsd > 0) {
      pricesByGrade[e.grade] = e.priceUsd;
    }
  }
  const mkBand = (v: number | null) =>
    v != null && v > 0
      ? {
          avg: v,
          low: v,
          high: v,
          lastUpdated: null,
          saleCount: null,
          approxSaleCount: null,
          avg1d: null,
          avg7d: null,
          avg30d: null,
          median3d: null,
          median7d: null,
          median30d: null,
        }
      : null;

  return {
    enabled: true,
    searchQuery: col.displayLabel ?? '',
    matched: true,
    matchConfidence: 'verified',
    card: {
      id: cardId,
      name: String(comp.cardName ?? col.displayLabel ?? ''),
      cardNumber: String(comp.cardNumber ?? ''),
      setName: String(comp.cardSet ?? ''),
      setSlug: null,
      image: null,
      tcgplayerId: null,
      currency: 'USD',
      market: null,
      lastUpdated: null,
      topPrice: spotPrice,
      totalSaleCount: null,
      hasGraded: true,
      gradedTiersAvailable: Object.keys(pricesByGrade),
      pricesByGrade,
      spotPriceBasis: 'catalog',
      ebayNearMint: null,
      tcgplayerNearMint: null,
      ebayPsa10: tierU === 'PSA_10' ? mkBand(spotPrice) : null,
      ebayPsa9: tierU === 'PSA_9' ? mkBand(spotPrice) : null,
    },
  };
}

/**
 * When the materialized snapshot row is missing or thin, mirror collection detail by
 * surfacing slab `psaEstimateUsd` on the list bundle grade strip.
 */
function enrichListBundleFromCollection(
  bundle: CollectionMarketBundle,
  col: { components: Record<string, unknown> } | null,
): CollectionMarketBundle {
  if (!col || gradeStripHasPositiveUsd(bundle.gradePrices)) return bundle;
  const psaEst = psaEstimateUsdFromComponents(col.components);
  if (psaEst == null) return bundle;

  const tier = String(
    marketHistoryTierFromComponents(col.components),
  ).toUpperCase();
  const gradePrices: GradePriceStrip =
    tier === 'PSA_9'
      ? { ...bundle.gradePrices, psa9: psaEst }
      : { ...bundle.gradePrices, psa10: psaEst };

  return {
    ...bundle,
    gradePrices,
    spotPriceBasis: bundle.spotPriceBasis ?? 'psa_estimate',
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
    marketChangeRefUsd: bundle.marketChangeRefUsd ?? null,
    marketChangeRefAtSec: bundle.marketChangeRefAtSec ?? null,
    marketChangeSource: bundle.marketChangeSource,
    gradePrices: bundle.gradePrices,
    spotPriceBasis: bundle.spotPriceBasis ?? null,
    cardhedgerPreview: bundle.cardhedgerPreview,
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
