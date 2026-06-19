/* eslint-disable @typescript-eslint/no-base-to-string -- Cardhedger API payloads are loosely typed; string coercion is intentional for keys and logging. */
import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CardhedgerService } from '../../cardhedger/cardhedger.service';
import { cardhedgerGradeFromHistoryTier } from '../utils/psa-grade-policy.util';
import type { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import type {
  MarketCollectionPreview,
  MarketCompsSnapshot,
  MarketPriceHistoryResult,
} from '../utils/market-reference.types';
import type { MarketHistoryPeriod } from '../utils/price-history-period.util';
import type {
  AiInsightPsa10PriceConfidence,
  CardhedgerCardRow,
  CollectionAiInsightPricingStats,
} from './cardhedger-market-data.types';
import {
  CardhedgerResolveService,
  type ResolvedCard,
} from './cardhedger-resolve.service';
import { CardhedgerPricingService } from './cardhedger-pricing.service';
import { CardhedgerMintService } from './cardhedger-mint.service';
import {
  catalogRowTrustedForMarketData,
  catalogTrustHintsFromComponents,
} from '../utils/card-match.util';
import { catalogFromAllPricesRows } from '../utils/cardhedger-grade-catalog.util';

export type {
  AiInsightPsa10PriceConfidence,
  CollectionAiInsightPricingStats,
} from './cardhedger-market-data.types';

/** Catalog PSA 10 vs PSA_10 tier rolling history — beyond this ratio we distrust catalog. */
const DEFAULT_AI_INSIGHT_HIST_ANOMALY_RATIO = 5;
const AI_INSIGHT_MEDIAN_MIN_POINTS = 3;
const AI_INSIGHT_MEDIAN_FALLBACK_MIN_POINTS = 5;

@Injectable()
export class CardhedgerMarketDataService {
  private readonly logger = new Logger(CardhedgerMarketDataService.name);

  /** Max ratio between catalog PSA 10 slot and PSA_10 history median before anomaly handling. */
  private readonly AI_INSIGHT_HIST_ANOMALY_RATIO: number;

  constructor(
    private readonly cardhedger: CardhedgerService,
    private readonly config: ConfigService,
    private readonly resolve: CardhedgerResolveService,
    private readonly pricing: CardhedgerPricingService,
    private readonly mint: CardhedgerMintService,
  ) {
    this.AI_INSIGHT_HIST_ANOMALY_RATIO = Math.max(
      2,
      Number(
        this.config.get<string>('CARDHEDGER_AI_PSA_HISTORY_ANOMALY_RATIO'),
      ) || DEFAULT_AI_INSIGHT_HIST_ANOMALY_RATIO,
    );
  }

  isConfigured(): boolean {
    try {
      this.cardhedger.assertConfigured();
      return true;
    } catch {
      return false;
    }
  }

  /** Facade: delegates to CardhedgerResolveService (all callers continue using this unchanged). */
  buildCollectionQuery(col: MarketplaceCollection | null): ReturnType<CardhedgerResolveService['buildCollectionQuery']> {
    return this.resolve.buildCollectionQuery(col);
  }

  /** Facade: delegates to CardhedgerMintService (all callers continue using this unchanged). */
  async getBatchMintPreviewsFromTokenIds(
    tokenIds: number[],
  ): Promise<Record<number, MarketCollectionPreview>> {
    return this.mint.getBatchMintPreviewsFromTokenIds(tokenIds);
  }

  /**
   * Resolve a PSA cert number to a Cardhedger `card_id` via
   * `POST /v1/cards/details-by-certs`.
   *
   * - When `card` is present → returns `{ cardId, query }` immediately (authoritative).
   * - When `card: null` but `cert_info.description` is available → returns
   *   `{ cardId: null, certDescription }` so callers can use the CardHedger-formatted
   *   description as a high-priority text search query.
   * - Returns null when the cert is fully unknown to Cardhedger.
   */
  async tryResolveCardIdByCert(
    cert: string,
    opts?: { collection?: MarketplaceCollection | null },
  ): Promise<{
    cardId: string | null;
    query: string;
    certDescription: string | null;
  } | null> {
    const { row, certDescription } = await this.mint.getCardRowByCert(cert);
    if (!row && !certDescription) return null;
    if (row) {
      const cardId =
        typeof row.card_id === 'string' && row.card_id.trim()
          ? row.card_id.trim()
          : null;
      if (cardId) {
        if (opts?.collection) {
          const trust = catalogRowTrustedForMarketData(
            catalogTrustHintsFromComponents(opts.collection.components),
            row as Record<string, unknown>,
          );
          if (!trust.ok) {
            this.logger.warn(
              JSON.stringify({
                msg: 'cert_card_id_rejected',
                cert,
                collectionKey: opts.collection.collectionKey,
                cardId,
                failCodes: trust.failCodes,
              }),
            );
            if (certDescription) {
              return { cardId: null, query: certDescription, certDescription };
            }
            return null;
          }
        }
        const query =
          (typeof row.description === 'string' && row.description.trim()
            ? row.description.trim()
            : typeof row.name === 'string' && row.name.trim()
              ? row.name.trim()
              : null) ??
          certDescription ??
          cert;
        return { cardId, query, certDescription };
      }
    }
    // card: null but certDescription available — signal to use description as search query
    if (certDescription) {
      return { cardId: null, query: certDescription, certDescription };
    }
    return null;
  }

  private emptyInsightStats(): CollectionAiInsightPricingStats {
    return {
      psa10SpotUsd: null,
      rawSpotUsd: null,
      premiumVsRawPct: null,
      sales7d: null,
      sales30d: null,
      change7dPct: null,
      change30dPct: null,
      change90dPct: null,
      change365dPct: null,
      points90d: 0,
      points365d: 0,
      psa10PriceConfidence: null,
      psa10PricingNote: null,
      psa10SpotLowUsd: null,
      psa10SpotHighUsd: null,
      psa10CatalogUsd: null,
      psaTotalPopulation: null,
    };
  }

  private trimmedMedianUsdFromHistory(
    pts: Array<{ t: number; v: number }>,
  ): number | null {
    const raw = pts
      .map((p) => p.v)
      .filter((v) => typeof v === 'number' && Number.isFinite(v) && v > 0)
      .sort((a, b) => a - b);
    if (raw.length === 0) return null;
    if (raw.length === 1) return raw[0];
    if (raw.length === 2) return (raw[0] + raw[1]) / 2;
    let vals = raw;
    if (raw.length >= 8) {
      const qi = Math.floor((raw.length - 1) * 0.25);
      const qj = Math.floor((raw.length - 1) * 0.75);
      const q1 = raw[qi];
      const q3 = raw[qj];
      const iqr = Math.max(q3 - q1, 1e-6);
      const lo = q1 - 1.5 * iqr;
      const hi = q3 + 1.5 * iqr;
      const t = raw.filter((x) => x >= lo && x <= hi);
      if (t.length >= AI_INSIGHT_MEDIAN_MIN_POINTS) vals = t;
    }
    const m = Math.floor(vals.length / 2);
    return vals.length % 2 === 1 ? vals[m] : (vals[m - 1] + vals[m]) / 2;
  }

  private catalogHistoryMedianAnomaly(
    catalogUsd: number,
    histMedian: number | null | undefined,
  ): boolean {
    if (histMedian == null || !(histMedian > 0) || !(catalogUsd > 0))
      return false;
    const r = this.AI_INSIGHT_HIST_ANOMALY_RATIO;
    return catalogUsd / histMedian > r || histMedian / catalogUsd > r;
  }

  private computeInsightStatsFromMerged(
    merged: CardhedgerCardRow,
    matchConfidence: 'verified' | 'approximate',
    h90: Array<{ t: number; v: number }>,
    h365: Array<{ t: number; v: number }>,
    cardId: string,
  ): CollectionAiInsightPricingStats {
    const psa10Catalog = this.pricing.readGradePrice(merged, 'PSA 10');
    const rawSpot = this.pricing.readGradePrice(merged, 'Raw');
    const sales7d = this.pricing.parseCount(merged['7 Day Sales']);
    const sales30d = this.pricing.parseCount(merged['30 Day Sales']);
    const change7 =
      typeof merged.gain === 'number' && Number.isFinite(merged.gain)
        ? Number(merged.gain)
        : null;
    const change30 =
      typeof merged.gain_30day === 'number' &&
      Number.isFinite(merged.gain_30day)
        ? Number(merged.gain_30day)
        : null;
    const change90 = this.pricing.pctFromPoints(h90);
    const change365 = this.pricing.pctFromPoints(h365);

    const histMed = this.trimmedMedianUsdFromHistory(h90);
    const allowCatalog = this.pricing.allowsPublishedCatalogPsa10(
      merged,
      matchConfidence,
    );
    const catalogCandidate =
      allowCatalog && psa10Catalog != null && psa10Catalog > 0
        ? psa10Catalog
        : null;

    const histVals = h90
      .map((p) => p.v)
      .filter((v) => typeof v === 'number' && Number.isFinite(v) && v > 0);
    const psa10SpotLowUsd = histVals.length > 0 ? Math.min(...histVals) : null;
    const psa10SpotHighUsd = histVals.length > 0 ? Math.max(...histVals) : null;

    let psa10SpotUsd: number | null = null;
    let psa10PriceConfidence: AiInsightPsa10PriceConfidence | null = null;
    let psa10PricingNote: string | null = null;

    const ratioBad =
      catalogCandidate != null &&
      histMed != null &&
      this.catalogHistoryMedianAnomaly(catalogCandidate, histMed);

    if (
      ratioBad &&
      histMed != null &&
      h90.length >= AI_INSIGHT_MEDIAN_MIN_POINTS
    ) {
      psa10SpotUsd = histMed;
      psa10PriceConfidence = 'medium';
      psa10PricingNote = 'history_median_replaces_catalog_anomaly';
      this.logger.warn(
        `[ai-insight-psa] anomaly_substitution card_id=${cardId} catalog=${catalogCandidate} histMedian90d=${histMed} points90=${h90.length} sales30d=${sales30d ?? 'n/a'}`,
      );
    } else if (
      ratioBad &&
      (histMed == null || h90.length < AI_INSIGHT_MEDIAN_MIN_POINTS)
    ) {
      psa10SpotUsd = null;
      psa10PriceConfidence = 'low';
      psa10PricingNote = 'suppressed_catalog_history_conflict';
      this.logger.warn(
        `[ai-insight-psa] suppressed_conflict card_id=${cardId} catalog=${catalogCandidate} histMedian90d=${histMed ?? 'n/a'} points90=${h90.length}`,
      );
    } else if (catalogCandidate != null) {
      psa10SpotUsd = catalogCandidate;
      psa10PricingNote = 'catalog_psa10_grade_slot';
      const highSales =
        sales30d != null && sales30d >= this.pricing.MIN_RELIABLE_SALES_30D;
      psa10PriceConfidence =
        matchConfidence === 'verified' && allowCatalog && highSales
          ? 'high'
          : 'medium';
    } else if (
      histMed != null &&
      h90.length >= AI_INSIGHT_MEDIAN_FALLBACK_MIN_POINTS
    ) {
      psa10SpotUsd = histMed;
      psa10PriceConfidence = 'low';
      psa10PricingNote = 'history_median_thin_catalog_confidence';
    } else {
      psa10SpotUsd = null;
      psa10PriceConfidence = 'low';
      psa10PricingNote =
        psa10Catalog != null && !allowCatalog
          ? 'suppressed_low_sales_or_match'
          : 'insufficient_psa10_series';
    }

    return {
      psa10SpotUsd,
      rawSpotUsd: rawSpot,
      premiumVsRawPct: this.pricing.premiumPct(psa10SpotUsd, rawSpot),
      sales7d,
      sales30d,
      change7dPct: change7,
      change30dPct: change30,
      change90dPct: change90,
      change365dPct: change365,
      points90d: h90.length,
      points365d: h365.length,
      psa10PriceConfidence,
      psa10PricingNote,
      psa10SpotLowUsd,
      psa10SpotHighUsd,
      psa10CatalogUsd: psa10Catalog,
      psaTotalPopulation: null,
    };
  }

  private parsePsaTotalPopulationInsight(components: unknown): number | null {
    if (!components || typeof components !== 'object') return null;
    const c = components as Record<string, unknown>;
    const raw = c.psaTotalPopulation;
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0)
      return Math.floor(raw);
    if (typeof raw === 'string' && raw.trim()) {
      const n = Number(raw.trim());
      if (Number.isFinite(n) && n > 0) return Math.floor(n);
    }
    return null;
  }

  async getAiInsightPricingBundle(col: MarketplaceCollection | null): Promise<{
    matched: boolean;
    matchConfidence: 'verified' | 'approximate' | null;
    catalogLabel: string;
    uiConfidence: number | null;
    stats: CollectionAiInsightPricingStats;
  }> {
    if (!col) {
      return {
        matched: false,
        matchConfidence: null,
        catalogLabel: '',
        uiConfidence: null,
        stats: this.emptyInsightStats(),
      };
    }
    if (!this.isConfigured()) {
      return {
        matched: false,
        matchConfidence: null,
        catalogLabel: String(col.displayLabel ?? ''),
        uiConfidence: null,
        stats: this.emptyInsightStats(),
      };
    }
    const resolved = await this.resolve.resolveCardForCollection(col);
    if (!resolved.row || !resolved.confidence) {
      return {
        matched: false,
        matchConfidence: null,
        catalogLabel: String(col.displayLabel ?? ''),
        uiConfidence: null,
        stats: this.emptyInsightStats(),
      };
    }
    const cardId = String(resolved.row.card_id ?? '').trim();
    const allPrices = cardId ? await this.pricing.fetchAllPricesByCard(cardId) : [];
    const merged =
      allPrices.length > 0
        ? ({ ...resolved.row, prices: allPrices } as CardhedgerCardRow)
        : resolved.row;
    const [h90, h365] = await Promise.all([
      cardId
        ? this.pricing.fetchTierHistoryByCard(cardId, 'PSA_10', 90)
        : Promise.resolve([]),
      cardId
        ? this.pricing.fetchTierHistoryByCard(cardId, 'PSA_10', 365)
        : Promise.resolve([]),
    ]);
    const statsBase = this.computeInsightStatsFromMerged(
      merged,
      resolved.confidence,
      h90,
      h365,
      cardId,
    );
    const psaPop = this.parsePsaTotalPopulationInsight(col.components);
    const stats: CollectionAiInsightPricingStats = {
      ...statsBase,
      psaTotalPopulation: psaPop,
    };
    const catalogLabel = String(
      merged.description ?? merged.name ?? col.displayLabel ?? '',
    ).trim();
    const uiConfidence = resolved.confidence === 'verified' ? 0.93 : 0.78;
    return {
      matched: true,
      matchConfidence: resolved.confidence,
      catalogLabel,
      uiConfidence,
      stats,
    };
  }


  /**
   * Resolves the Cardhedger card once and returns both the price preview and tier price history
   * in parallel, avoiding the duplicate resolveCardForCollection call that was happening when
   * getPreviewForCollection and getTierPriceHistoryForCollection were called together.
   */
  async getBundledCardData(
    col: MarketplaceCollection | null,
    options: {
      tier: string;
      period: MarketHistoryPeriod;
      maxCalendarDays: number;
      maxRequests?: number;
      /** Include `POST /v1/cards/comps` headline + raw sales (default true). */
      includeComps?: boolean;
      compsRawCount?: number;
    },
  ): Promise<{
    preview: MarketCollectionPreview;
    history: MarketPriceHistoryResult;
    comps: MarketCompsSnapshot;
  }> {
    const includeComps = options.includeComps !== false;
    const compsRawCount =
      options.compsRawCount ?? 100;

    if (!col) {
      const [preview, history] = await Promise.all([
        this.pricing.getPreviewForCollection(null),
        this.pricing.getTierPriceHistoryForCollection(null, options),
      ]);
      const comps = includeComps
        ? await this.pricing.getCompsSnapshotForCollection(null, {
            tier: options.tier,
            rawCount: compsRawCount,
          })
        : this.pricing.emptyMarketCompsSnapshot({
            enabled: this.isConfigured(),
            searchQuery: '',
            matched: false,
            message: 'Collection not found',
          });
      return { preview, history, comps };
    }
    if (!this.isConfigured()) {
      const q = this.buildCollectionQuery(col);
      const notConfigured: MarketCollectionPreview = {
        enabled: false,
        searchQuery: q.query,
        matched: false,
        message: 'Cardhedger is not configured (CARDHEDGER_API_KEY)',
        card: null,
      };
      const days = Math.min(
        4000,
        Math.max(1, Math.floor(options.maxCalendarDays)),
      );
      const tier = 'PSA_10';
      const notConfiguredHist: MarketPriceHistoryResult = {
        enabled: false,
        searchQuery: q.query,
        matched: false,
        message: 'Cardhedger is not configured (CARDHEDGER_API_KEY)',
        days,
        tier,
        period: options.period,
        points: [],
        source: `cardhedger:${tier}`,
        upstreamRequests: 0,
      };
      const comps = this.pricing.emptyMarketCompsSnapshot({
        enabled: false,
        searchQuery: q.query,
        matched: false,
        message: 'Cardhedger is not configured (CARDHEDGER_API_KEY)',
      });
      return { preview: notConfigured, history: notConfiguredHist, comps };
    }

    // Resolve once; preview, history, and comps share the same card_id.
    const resolved = await this.resolve.resolveCardForCollection(col);
    const tierU = String(options.tier ?? 'PSA_10').trim().toUpperCase() || 'PSA_10';
    const grade = cardhedgerGradeFromHistoryTier(tierU);
    const cardId = String(
      (resolved.row as { card_id?: unknown } | null)?.card_id ?? '',
    ).trim();

    const compsPromise: Promise<MarketCompsSnapshot> =
      !includeComps
        ? Promise.resolve(
            this.pricing.emptyMarketCompsSnapshot({
              enabled: true,
              searchQuery: resolved.query,
              matched: Boolean(resolved.row && resolved.confidence),
              message: 'Comps omitted (includeComps=false)',
            }),
          )
        : !resolved.row || !resolved.confidence || !cardId
          ? Promise.resolve(
              this.pricing.emptyMarketCompsSnapshot({
                enabled: true,
                searchQuery: resolved.query,
                matched: false,
                message: resolved.row
                  ? 'Resolved card missing card_id'
                  : 'No matching Cardhedger card found',
                matchConfidence: resolved.confidence,
              }),
            )
          : this.pricing.fetchCompsCached(
              cardId,
              grade,
              Math.min(100, Math.max(1, Math.floor(compsRawCount))),
            ).then((cached) =>
              this.pricing.marketCompsSnapshotFromCached(
                resolved,
                cached,
                grade,
                Math.min(100, Math.max(1, Math.floor(compsRawCount))),
              ),
            );

    const [preview, history, comps] = await Promise.all([
      this.pricing.buildPreviewFromResolved(resolved, col).catch(
        (e) =>
          ({
            enabled: true,
            searchQuery: resolved.query,
            matched: false,
            message: e instanceof Error ? e.message : String(e),
            card: null,
          }) satisfies MarketCollectionPreview,
      ),
      this.pricing.buildHistoryFromResolved(resolved, options),
      compsPromise,
    ]);
    return { preview, history, comps };
  }

  /** `POST /v1/cards/comps` raw sales for collection trades tape (cached upstream). */
  getCompsSnapshotForCollection(
    col: MarketplaceCollection | null,
    options?: { tier?: string; gradeLabel?: string; rawCount?: number },
  ): Promise<MarketCompsSnapshot> {
    return this.pricing.getCompsSnapshotForCollection(col, options);
  }

  /**
   * Comps for trades tape — uses stored `cardhedgerCardId` or cert batch row directly
   * (mint preview parity). Full resolve/verification is fallback only.
   */
  async getCompsSnapshotForTradesTape(
    col: MarketplaceCollection | null,
    options?: {
      tier?: string;
      gradeLabel?: string;
      rawCount?: number;
      catalogRow?: CardhedgerCardRow | null;
      certNumber?: string;
    },
  ): Promise<MarketCompsSnapshot> {
    const gradeLabel = String(options?.gradeLabel ?? '').trim();
    const tier =
      String(options?.tier ?? 'PSA_10').trim().toUpperCase() || 'PSA_10';
    const rawCount = options?.rawCount;
    const searchQuery = col
      ? this.resolve.buildCollectionQuery(col).query
      : '';

    let catalogRow = options?.catalogRow ?? null;
    let cardId = String(
      (catalogRow as { card_id?: unknown } | null)?.card_id ?? '',
    ).trim();
    if (!cardId) {
      cardId = String(col?.components?.cardhedgerCardId ?? '').trim();
    }

    const cert = String(
      options?.certNumber ?? col?.psaCertNumber ?? '',
    ).trim();
    if (!cardId && cert) {
      const { row } = await this.mint.getCardRowByCert(cert);
      if (row) {
        catalogRow = row;
        cardId = String(row.card_id ?? '').trim();
      }
    }

    if (cardId) {
      return this.pricing.getCompsSnapshotByCardIdDirect(cardId, {
        gradeLabel,
        tier,
        rawCount,
        searchQuery,
        catalogRow,
      });
    }

    return this.pricing.getCompsSnapshotForCollection(col, {
      gradeLabel,
      tier,
      rawCount,
    });
  }

  /** Comps from mint metadata when collection row is missing or not yet enriched. */
  getCompsSnapshotForTokenId(
    tokenId: number,
    options?: { tier?: string; gradeLabel?: string; rawCount?: number },
  ): Promise<MarketCompsSnapshot> {
    return this.mint.getCompsSnapshotForTokenId(tokenId, options);
  }

  fetchTierHistoryByCard(
    cardId: string,
    tier: string,
    days: number,
  ): Promise<Array<{ t: number; v: number }>> {
    return this.pricing.fetchTierHistoryByCard(cardId, tier, days);
  }

  async getGradeCatalogForCardId(
    cardId: string,
  ) {
    const id = String(cardId ?? '').trim();
    if (!id) return [];
    const rows = await this.pricing.fetchAllPricesByCard(id);
    return catalogFromAllPricesRows(
      rows as unknown as Array<Record<string, unknown>>,
    );
  }

  async getGradePriceSeriesByCardId(
    cardId: string,
    gradeLabel: string,
    days: number,
  ): Promise<Array<{ t: number; v: number }>> {
    const id = String(cardId ?? '').trim();
    if (!id) return [];
    const { pts } = await this.pricing.fetchGradeLabelHistoryAdaptive(
      id,
      gradeLabel,
      days,
    );
    return pts;
  }
}
