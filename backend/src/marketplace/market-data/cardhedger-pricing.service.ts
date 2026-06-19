/* eslint-disable @typescript-eslint/no-base-to-string -- Cardhedger API payloads are loosely typed; string coercion is intentional for keys and logging. */
import { HttpException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  TTL_CACHE_PROVIDER,
  type TtlCacheProvider,
} from '../../common/cache/ttl-cache.interface';
import { CardhedgerService } from '../../cardhedger/cardhedger.service';
import {
  catalogRowTrustedForMarketData,
} from '../utils/card-match.util';
import { cardhedgerGradeFromHistoryTier } from '../utils/psa-grade-policy.util';
import { marketHistoryTierFromComponents } from '../utils/market-history-tier.util';
import type { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import type {
  MarketCollectionPreview,
  MarketCompsSnapshot,
  MarketPriceHistoryResult,
} from '../utils/market-reference.types';
import type { MarketHistoryPeriod } from '../utils/price-history-period.util';
import type {
  CardhedgerCardRow,
  CardhedgerCompRawPoint,
  CardhedgerCompsCached,
  CardhedgerCompsHeadline,
  CardhedgerPsa10SpotBasis,
} from './cardhedger-market-data.types';
import {
  CardhedgerResolveService,
  type ResolvedCard,
} from './cardhedger-resolve.service';
import { inferExternalSalePlatform } from '../utils/cardhedger-sale-platform.util';

/** Card Hedge `POST /v1/cards/prices-by-card` documents rolling `days` in [1, **365**] only. */
const CARDHEDGER_PRICES_BY_CARD_MAX_DAYS = 365;

/** PSA 10 headline via `POST /v1/cards/comps` — upstream allows count in [1, 100]. */
const CARDHEDGER_COMPS_HEADLINE_COUNT = 15;

/** Wider comps pull when merging raw sales into price history (sparse parallels). */
export const CARDHEDGER_COMPS_HISTORY_RAW_COUNT = 100;

/**
 * When Cardhedger returns this many or fewer positive sale/sample points, use arithmetic mean
 * instead of a single last observation (comps raw → then PSA 10 history).
 */
const SPARSE_SALE_POINTS_MAX = 5;

@Injectable()
export class CardhedgerPricingService {
  private readonly logger = new Logger(CardhedgerPricingService.name);

  private readonly PRICES_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
  readonly MIN_RELIABLE_SALES_30D: number;
  /**
   * Minimum 30-day sales required even for `verified` confidence matches.
   * Prevents stale catalog prices (e.g. low-population rare cards) from surfacing
   * as market price when no recent trades have occurred.
   * Defaults to 1; set CARDHEDGER_MIN_VERIFIED_SALES_30D=0 to disable gate entirely.
   * Raise to 5+ for stricter liquidity requirements.
   */
  readonly MIN_VERIFIED_SALES_30D: number;
  private readonly PSA10_SPOT_BASIS: CardhedgerPsa10SpotBasis;
  /**
   * When using `last_raw_comp`: if last print / Cardhedger headline is below this fraction,
   * prefer time-weighted headline (`comp_price`). Example 0.48 → last < 48% of headline ⇒ outlier.
   */
  private readonly LAST_COMP_LOW_VS_HEADLINE_FRAC: number;
  /**
   * When liquid: if last print is below this fraction of the median of the last {@link MEDIAN_RAW_COMPS_WINDOW}
   * raw comps, use that median instead (guards one bad tick vs the recent mass).
   */
  private readonly LAST_COMP_LOW_VS_MEDIAN_FRAC: number;
  private readonly MEDIAN_RAW_COMPS_WINDOW: number;
  private static readonly NS_ALL_PRICES = 'cardhedger:allPrices';
  private static readonly NS_TIER_HISTORY = 'cardhedger:tierHistory';
  private static readonly NS_COMPS = 'cardhedger:comps';
  private static readonly NS_FMV = 'cardhedger:fmv';

  constructor(
    private readonly cardhedger: CardhedgerService,
    private readonly config: ConfigService,
    @Inject(TTL_CACHE_PROVIDER) private readonly ttlCache: TtlCacheProvider,
    private readonly resolve: CardhedgerResolveService,
  ) {
    this.MIN_RELIABLE_SALES_30D = Math.max(
      0,
      Number(
        this.config.get<string>('CARDHEDGER_MIN_RELIABLE_SALES_30D') ?? 5,
      ) || 5,
    );
    this.MIN_VERIFIED_SALES_30D = Math.max(
      0,
      Number(
        this.config.get<string>('CARDHEDGER_MIN_VERIFIED_SALES_30D') ?? 1,
      ) || 1,
    );
    {
      const raw = this.config
        .get<string>('CARDHEDGER_PSA10_SPOT_BASIS')
        ?.trim()
        .toLowerCase();
      this.PSA10_SPOT_BASIS =
        raw === 'time_weighted' ? 'time_weighted' : 'last_raw_comp';
    }
    const clampFrac = (n: number, def: number): number => {
      if (!Number.isFinite(n) || n <= 0 || n >= 1) return def;
      return n;
    };
    this.LAST_COMP_LOW_VS_HEADLINE_FRAC = clampFrac(
      Number(
        this.config.get<string>(
          'CARDHEDGER_LAST_COMP_LOW_VS_HEADLINE_FRAC',
        ) ?? '0.48',
      ),
      0.48,
    );
    this.LAST_COMP_LOW_VS_MEDIAN_FRAC = clampFrac(
      Number(
        this.config.get<string>(
          'CARDHEDGER_LAST_COMP_LOW_VS_MEDIAN_FRAC',
        ) ?? '0.55',
      ),
      0.55,
    );
    this.MEDIAN_RAW_COMPS_WINDOW = Math.max(
      5,
      Math.min(
        31,
        Math.floor(
          Number(this.config.get<string>('CARDHEDGER_MEDIAN_RAW_COMPS_WINDOW')) ||
            15,
        ) || 15,
      ),
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

  // ---------------------------------------------------------------------------
  // Price parsing utilities
  // ---------------------------------------------------------------------------

  private parsePrice(raw: unknown): number | null {
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
    if (typeof raw === 'string') {
      const n = parseFloat(raw.replace(/[^0-9.-]/g, ''));
      if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
  }

  parseCount(raw: unknown): number | null {
    if (typeof raw === 'number' && Number.isFinite(raw)) return Math.floor(raw);
    if (typeof raw === 'string' && raw.trim()) {
      const n = Number(raw.replace(/[^0-9.-]/g, ''));
      if (Number.isFinite(n)) return Math.floor(n);
    }
    return null;
  }

  readGradePrice(row: CardhedgerCardRow, grade: string): number | null {
    const prices = row.prices;
    if (!Array.isArray(prices)) return null;
    const want = grade.trim().toUpperCase();
    for (const p of prices) {
      if (typeof p !== 'object' || p == null) continue;
      const pg = String((p as { grade?: unknown }).grade ?? '')
        .trim()
        .toUpperCase();
      if (pg === want) {
        return this.parsePrice((p as { price?: unknown }).price);
      }
    }
    return null;
  }

  private readTierSpot(
    row: CardhedgerCardRow,
    tier: string,
  ): { usd: number | null; gainPct: number | null } {
    const t = tier.toUpperCase();
    const gainRaw = row.gain;
    const gainPct =
      typeof gainRaw === 'number' && Number.isFinite(gainRaw) ? gainRaw : null;
    const chGrade = cardhedgerGradeFromHistoryTier(t);
    return { usd: this.readGradePrice(row, chGrade), gainPct };
  }

  // ---------------------------------------------------------------------------
  // Prices-by-card (all grades)
  // ---------------------------------------------------------------------------

  async fetchAllPricesByCard(cardId: string): Promise<CardhedgerCardRow[]> {
    const id = String(cardId ?? '').trim();
    if (!id) return [];
    const cached = this.ttlCache.get<{ rows: CardhedgerCardRow[] }>(
      CardhedgerPricingService.NS_ALL_PRICES,
      id,
    );
    if (cached) {
      return cached.rows;
    }
    try {
      const body = await this.cardhedger.forwardJson(
        'POST',
        '/v1/cards/all-prices-by-card',
        {
          body: { card_id: id },
        },
      );
      const prices =
        typeof body === 'object' &&
        body != null &&
        Array.isArray((body as { prices?: unknown }).prices)
          ? (body as { prices: unknown[] }).prices
          : [];
      const out = prices.filter(
        (x): x is CardhedgerCardRow => typeof x === 'object' && x != null,
      );
      this.ttlCache.set(
        CardhedgerPricingService.NS_ALL_PRICES,
        id,
        { rows: out },
        this.PRICES_CACHE_TTL_MS,
      );
      return out;
    } catch {
      // Do not cache upstream failures — return empty and allow the next
      // request to retry the live API.
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // FMV (POST /v1/cards/card-fmv) — smoothed Fair Market Value with confidence
  // ---------------------------------------------------------------------------

  /**
   * Fetch CardHedger's Winsorized-median FMV for a card+grade.
   * Falls back to movement-index projection for stale/sparse data.
   * Returns null on network error or when the API returns no usable price.
   */
  private async fetchFmvByCard(
    cardId: string,
    grade: string,
  ): Promise<{
    price: number | null;
    price_low: number | null;
    price_high: number | null;
    confidence: number | null;
    confidence_grade: 'A' | 'B' | 'C' | 'D' | null;
    method: string | null;
    freshness_days: number | null;
  } | null> {
    const id = String(cardId ?? '').trim();
    const gradeKey = String(grade ?? '').trim();
    if (!id || !gradeKey) return null;

    const cacheKey = `${id}:${gradeKey.toLowerCase()}:fmv`;
    const hit = this.ttlCache.get<{
      value: ReturnType<typeof this.fetchFmvByCard> extends Promise<infer T> ? T : never;
    }>(CardhedgerPricingService.NS_FMV, cacheKey);
    if (hit) return hit.value as Awaited<ReturnType<typeof this.fetchFmvByCard>>;

    try {
      const body = await this.cardhedger.forwardJson('POST', '/v1/cards/card-fmv', {
        body: { card_id: id, grade: gradeKey },
      });
      if (typeof body !== 'object' || body == null) {
        this.ttlCache.set(CardhedgerPricingService.NS_FMV, cacheKey, { value: null }, this.PRICES_CACHE_TTL_MS);
        return null;
      }
      const b = body as Record<string, unknown>;
      const parse = (v: unknown): number | null => {
        const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
        return Number.isFinite(n) && n > 0 ? n : null;
      };
      const parseAny = (v: unknown): number | null => {
        const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
        return Number.isFinite(n) ? n : null;
      };
      const cg = String(b.confidence_grade ?? '').trim().toUpperCase();
      const result = {
        price: parse(b.price),
        price_low: parse(b.price_low),
        price_high: parse(b.price_high),
        confidence: parseAny(b.confidence),
        confidence_grade: (['A', 'B', 'C', 'D'].includes(cg) ? cg : null) as 'A' | 'B' | 'C' | 'D' | null,
        method: typeof b.method === 'string' && b.method.trim() ? b.method.trim() : null,
        freshness_days: typeof b.freshness_days === 'number' && Number.isFinite(b.freshness_days) ? Math.floor(b.freshness_days) : null,
      };
      this.ttlCache.set(CardhedgerPricingService.NS_FMV, cacheKey, { value: result }, this.PRICES_CACHE_TTL_MS);
      return result;
    } catch {
      // Do not cache failures — allow retry on next request.
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Tier price history
  // ---------------------------------------------------------------------------

  private parseHistoricalPoints(
    body: unknown,
  ): Array<{ t: number; v: number }> {
    if (typeof body !== 'object' || body == null) return [];
    const rows = Array.isArray((body as { prices?: unknown[] }).prices)
      ? ((body as { prices: unknown[] }).prices ?? [])
      : [];
    const out: Array<{ t: number; v: number }> = [];
    for (const raw of rows) {
      if (typeof raw !== 'object' || raw == null) continue;
      const row = raw as Record<string, unknown>;
      const dateRaw =
        (typeof row.closing_date === 'string' && row.closing_date) ||
        (typeof row.update_timestamp === 'string' && row.update_timestamp) ||
        (typeof row.date === 'string' && row.date) ||
        null;
      const tMs = dateRaw ? Date.parse(dateRaw) : NaN;
      const v = this.parsePrice(row.price);
      if (!Number.isFinite(tMs) || v == null || v <= 0) continue;
      out.push({ t: Math.floor(tMs / 1000), v });
    }
    out.sort((a, b) => a.t - b.t);
    const dedup = new Map<number, number>();
    for (const p of out) dedup.set(p.t, p.v);
    return [...dedup.entries()].map(([t, v]) => ({ t, v }));
  }

  /** Single upstream fetch (no backoff). Prefer {@link fetchTierHistoryByCardAdaptive} for charts. */
  private async fetchTierHistoryByCardOnce(
    cardId: string,
    tier: string,
    days: number,
  ): Promise<Array<{ t: number; v: number }>> {
    const tierUpper = String(tier ?? '')
      .trim()
      .toUpperCase();
    const grade = cardhedgerGradeFromHistoryTier(tierUpper);
    return this.fetchPricesByCardGradeOnce(cardId, grade, days);
  }

  /**
   * Cardhedger `prices-by-card` for an explicit grade label (PSA 10, BGS 9.5, Ungraded, …).
   */
  async fetchPricesByCardGradeOnce(
    cardId: string,
    gradeLabel: string,
    days: number,
  ): Promise<Array<{ t: number; v: number }>> {
    const id = String(cardId ?? '').trim();
    const grade = String(gradeLabel ?? '').trim();
    if (!id || !grade) return [];
    const d = Math.min(
      CARDHEDGER_PRICES_BY_CARD_MAX_DAYS,
      Math.max(1, Math.floor(days)),
    );
    const cacheKey = `${id}:${grade.toLowerCase()}:grade:${d}`;
    const cached = this.ttlCache.get<{ pts: Array<{ t: number; v: number }> }>(
      CardhedgerPricingService.NS_TIER_HISTORY,
      cacheKey,
    );
    if (cached) {
      return cached.pts;
    }
    try {
      const body = await this.cardhedger.forwardJson(
        'POST',
        '/v1/cards/prices-by-card',
        {
          body: { card_id: id, grade, days: d },
        },
      );
      const pts = this.parseHistoricalPoints(body);
      this.ttlCache.set(
        CardhedgerPricingService.NS_TIER_HISTORY,
        cacheKey,
        { pts },
        this.PRICES_CACHE_TTL_MS,
      );
      return pts;
    } catch {
      return [];
    }
  }

  /** Adaptive window backoff for any Cardhedger grade label (multi-grader charts). */
  async fetchGradeLabelHistoryAdaptive(
    cardId: string,
    gradeLabel: string,
    desiredDays: number,
  ): Promise<{
    pts: Array<{ t: number; v: number }>;
    upstreamRequests: number;
  }> {
    const capRequested = Math.min(4000, Math.max(1, Math.floor(desiredDays)));
    const widest = Math.min(CARDHEDGER_PRICES_BY_CARD_MAX_DAYS, capRequested);
    const tiersDesc = [
      ...new Set([widest, 180, 90, 30, 14, 7].filter((x) => x <= widest)),
    ].sort((a, b) => b - a);
    let upstreamRequests = 0;
    for (const d of tiersDesc) {
      upstreamRequests += 1;
      const pts = await this.fetchPricesByCardGradeOnce(cardId, gradeLabel, d);
      if (pts.length >= 2) return { pts, upstreamRequests };
    }
    return { pts: [], upstreamRequests };
  }

  /** Rightmost point after upstream sorts by time (latest observation in the series). */
  private latestHistoryPoint(
    pts: Array<{ t: number; v: number }>,
  ): { t: number; v: number } | null {
    if (!Array.isArray(pts) || pts.length === 0) return null;
    const last = pts[pts.length - 1];
    if (
      last.v == null ||
      typeof last.v !== 'number' ||
      !Number.isFinite(last.v) ||
      last.v <= 0 ||
      last.t == null ||
      !Number.isFinite(last.t)
    ) {
      return null;
    }
    return last;
  }

  /**
   * Mean of 1..`maxN` positive USD points (comps raw sales or sparse `prices-by-card` samples).
   * Returns null when empty or when count exceeds `maxN` (caller keeps last-point / headline path).
   */
  private sparseSalePriceAverage(
    points: Array<{ t: number; v: number }>,
    maxN: number,
  ): { avg: number; latestT: number; n: number } | null {
    const valid = points.filter(
      (p) =>
        Number.isFinite(p.t) &&
        typeof p.v === 'number' &&
        Number.isFinite(p.v) &&
        p.v > 0,
    );
    const n = valid.length;
    if (n === 0 || n > maxN) return null;
    const sum = valid.reduce((s, p) => s + p.v, 0);
    const latestT = Math.max(...valid.map((p) => p.t));
    return { avg: sum / n, latestT, n };
  }

  /**
   * Median USD of the chronologically last `k` raw comp points (PSA 10 comps sale rows).
   */
  private medianLastRawCompsWindow(
    rawPts: Array<{ t: number; v: number }>,
    k: number,
  ): { median: number; latestT: number } | null {
    if (!rawPts.length || k < 1) return null;
    const slice = rawPts.slice(-Math.min(k, rawPts.length));
    const vals = slice.map((p) => p.v).filter((v) => Number.isFinite(v) && v > 0);
    if (vals.length === 0) return null;
    const sorted = [...vals].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 1
        ? sorted[mid]!
        : (sorted[mid - 1]! + sorted[mid]!) / 2;
    const latestT = Math.max(...slice.map((p) => p.t));
    return { median, latestT };
  }

  /**
   * Choose published PSA 10 USD from comps payload. When {@link PSA10_SPOT_BASIS} is
   * `last_raw_comp`, prefer the last `raw_prices` row — unless it is a clear low outlier vs
   * the Cardhedger headline or vs the median of recent raw prints on a liquid card.
   */
  private pickPublishedUsdFromComps(
    headline: CardhedgerCompsHeadline | null,
    rawPts: Array<{ t: number; v: number }>,
    liquidMarket: boolean,
  ): {
    usd: number;
    spotPriceBasis: 'comps' | 'latest_sale' | 'comps_median';
    latestSaleAt: number | null;
    headlineCompCount: number | null;
  } | null {
    const lastRaw =
      rawPts.length > 0 ? rawPts[rawPts.length - 1] : null;
    const headlineOk =
      headline != null &&
      Number.isFinite(headline.usd) &&
      headline.usd > 0;

    if (
      this.PSA10_SPOT_BASIS === 'last_raw_comp' &&
      lastRaw &&
      liquidMarket
    ) {
      if (
        headlineOk &&
        lastRaw.v < headline.usd * this.LAST_COMP_LOW_VS_HEADLINE_FRAC
      ) {
        return {
          usd: headline.usd,
          spotPriceBasis: 'comps',
          latestSaleAt: headline.latestSaleAtSec,
          headlineCompCount: headline.countUsed,
        };
      }
      const win = this.medianLastRawCompsWindow(
        rawPts,
        this.MEDIAN_RAW_COMPS_WINDOW,
      );
      if (
        win != null &&
        lastRaw.v < win.median * this.LAST_COMP_LOW_VS_MEDIAN_FRAC
      ) {
        return {
          usd: win.median,
          spotPriceBasis: 'comps_median',
          latestSaleAt: win.latestT,
          headlineCompCount: headlineOk ? headline.countUsed : null,
        };
      }
    }

    if (this.PSA10_SPOT_BASIS === 'last_raw_comp' && lastRaw) {
      return {
        usd: lastRaw.v,
        spotPriceBasis: 'latest_sale',
        latestSaleAt: lastRaw.t,
        headlineCompCount: headlineOk ? headline.countUsed : null,
      };
    }
    if (headlineOk) {
      return {
        usd: headline.usd,
        spotPriceBasis: 'comps',
        latestSaleAt: headline.latestSaleAtSec,
        headlineCompCount: headline.countUsed,
      };
    }
    if (lastRaw) {
      return {
        usd: lastRaw.v,
        spotPriceBasis: 'latest_sale',
        latestSaleAt: lastRaw.t,
        headlineCompCount: null,
      };
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Comps (POST /v1/cards/comps)
  // ---------------------------------------------------------------------------

  private parseCompsPsa10CachedBody(
    body: unknown,
  ): CardhedgerCompsCached | null {
    if (typeof body !== 'object' || body == null) return null;
    const o = body as Record<string, unknown>;
    const rawPoints: CardhedgerCompRawPoint[] = [];
    const raw = o.raw_prices;
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (typeof item !== 'object' || item == null) continue;
        const sd = (item as { sale_date?: unknown }).sale_date;
        if (typeof sd !== 'string' || !sd.trim()) continue;
        const ms = Date.parse(sd.trim());
        if (!Number.isFinite(ms)) continue;
        const price = this.parsePrice((item as { price?: unknown }).price);
        if (price == null || price <= 0) continue;
        const saleTypeRaw = (item as { sale_type?: unknown }).sale_type;
        const saleType =
          typeof saleTypeRaw === 'string' && saleTypeRaw.trim()
            ? saleTypeRaw.trim()
            : null;
        const priceSourceRaw = (item as { price_source?: unknown }).price_source;
        const priceSource =
          typeof priceSourceRaw === 'string' && priceSourceRaw.trim()
            ? priceSourceRaw.trim()
            : null;
        const saleUrlRaw = (item as { sale_url?: unknown }).sale_url;
        const saleUrl =
          typeof saleUrlRaw === 'string' && saleUrlRaw.trim()
            ? saleUrlRaw.trim()
            : null;
        const platform = inferExternalSalePlatform({ saleUrl, priceSource });
        rawPoints.push({
          t: Math.floor(ms / 1000),
          v: price,
          saleType,
          priceSource,
          saleUrl,
          platform,
        });
      }
    }
    rawPoints.sort((a, b) => a.t - b.t);

    const usd = this.parsePrice(o.comp_price);
    const cnt = this.parseCount(o.count_used);
    let headline: CardhedgerCompsHeadline | null = null;
    if (usd != null && cnt != null && cnt >= 1) {
      let latestSaleAtSec: number | null = null;
      for (const p of rawPoints) {
        if (latestSaleAtSec == null || p.t > latestSaleAtSec)
          latestSaleAtSec = p.t;
      }
      headline = { usd, latestSaleAtSec, countUsed: cnt };
    }

    if (rawPoints.length === 0 && headline == null) return null;
    return { headline, rawPoints };
  }

  fetchCompsCached(
    cardId: string,
    grade: string,
    count = CARDHEDGER_COMPS_HEADLINE_COUNT,
  ): Promise<CardhedgerCompsCached | null> {
    const id = String(cardId ?? '').trim();
    const gradeKey = String(grade ?? '').trim();
    if (!id || !gradeKey) return Promise.resolve(null);
    const compsCount = Math.min(
      100,
      Math.max(1, Math.floor(count)),
    );
    const cacheKey = `${id}:${gradeKey.toLowerCase()}:comps:${compsCount}`;
    const hit = this.ttlCache.get<{ value: CardhedgerCompsCached | null }>(
      CardhedgerPricingService.NS_COMPS,
      cacheKey,
    );
    if (hit) {
      return Promise.resolve(hit.value);
    }
    return this.cardhedger
      .forwardJson('POST', '/v1/cards/comps', {
        body: {
          card_id: id,
          count: compsCount,
          grade: gradeKey,
          time_weighted: true,
          include_raw_prices: true,
        },
      })
      .then((body) => {
        const parsed = this.parseCompsPsa10CachedBody(body);
        this.ttlCache.set(
          CardhedgerPricingService.NS_COMPS,
          cacheKey,
          { value: parsed },
          this.PRICES_CACHE_TTL_MS,
        );
        return parsed;
      })
      .catch((e: unknown) => {
        const noSales = e instanceof HttpException && e.getStatus() === 404;
        if (noSales) {
          // 404 is a real business state ("no sales recorded for this grade").
          // Cache it so we don't hammer the API on every request.
          const value: CardhedgerCompsCached = {
            headline: null,
            rawPoints: [],
            noSalesForGrade: true,
          };
          this.ttlCache.set(
            CardhedgerPricingService.NS_COMPS,
            cacheKey,
            { value },
            this.PRICES_CACHE_TTL_MS,
          );
          return value;
        }
        // For all other errors (5xx, network, timeout) do not cache — allow the
        // next request to retry the live API once it recovers.
        return null;
      });
  }

  private fetchCompsPsa10Cached(
    cardId: string,
  ): Promise<CardhedgerCompsCached | null> {
    return this.fetchCompsCached(cardId, 'PSA 10');
  }

  emptyMarketCompsSnapshot(
    partial: Pick<
      MarketCompsSnapshot,
      'enabled' | 'searchQuery' | 'matched' | 'message' | 'matchConfidence'
    >,
  ): MarketCompsSnapshot {
    return {
      ...partial,
      cardId: null,
      grade: null,
      requestCount: 0,
      timeWeighted: true,
      headline: null,
      rawSales: [],
      earliestSaleAtSec: null,
      latestSaleAtSec: null,
      upstreamSource: 'cardhedger:comps',
    };
  }

  marketCompsSnapshotFromCached(
    resolved: ResolvedCard,
    cached: CardhedgerCompsCached | null,
    grade: string,
    requestCount: number,
  ): MarketCompsSnapshot {
    const rawSales = [...(cached?.rawPoints ?? [])]
      .sort((a, b) => a.t - b.t)
      .map((p) => ({
        t: p.t,
        v: p.v,
        saleType: p.saleType ?? null,
        platform: p.platform ?? null,
        saleUrl: p.saleUrl ?? null,
      }));
    const earliestSaleAtSec =
      rawSales.length > 0 ? rawSales[0]!.t : null;
    const latestSaleAtSec =
      rawSales.length > 0 ? rawSales[rawSales.length - 1]!.t : null;
    const h = cached?.headline;
    const headline =
      h != null && Number.isFinite(h.usd) && h.usd > 0
        ? {
            compPriceUsd: h.usd,
            countUsed: h.countUsed,
            latestSaleAtSec: h.latestSaleAtSec,
          }
        : null;

    const cardId =
      String((resolved.row as { card_id?: unknown })?.card_id ?? '').trim() ||
      null;

    if (
      !cached ||
      (rawSales.length === 0 && headline == null && !cached.noSalesForGrade)
    ) {
      return {
        ...this.emptyMarketCompsSnapshot({
          enabled: true,
          searchQuery: resolved.query,
          matched: Boolean(resolved.row && resolved.confidence),
          matchConfidence: resolved.confidence,
          message: 'No comps payload from Cardhedger',
        }),
        cardId,
        grade,
        requestCount,
      };
    }

    if (cached.noSalesForGrade) {
      return {
        enabled: true,
        searchQuery: resolved.query,
        matched: true,
        matchConfidence: resolved.confidence,
        cardId,
        grade,
        requestCount,
        timeWeighted: true,
        headline: null,
        rawSales: [],
        earliestSaleAtSec: null,
        latestSaleAtSec: null,
        upstreamSource: 'cardhedger:comps',
        noSalesForGrade: true,
        message:
          `Cardhedger has no indexed ${grade} sales for this catalog card_id (comps 404). ` +
          'Match is correct; price requires upstream sales data.',
      };
    }

    return {
      enabled: true,
      searchQuery: resolved.query,
      matched: true,
      matchConfidence: resolved.confidence,
      cardId,
      grade,
      requestCount,
      timeWeighted: true,
      headline,
      rawSales,
      earliestSaleAtSec,
      latestSaleAtSec,
      upstreamSource: 'cardhedger:comps',
    };
  }

  /**
   * Fetch comps by known `card_id` — skips resolve/verification (trades tape, mint cert batch).
   */
  async getCompsSnapshotByCardIdDirect(
    cardId: string,
    options?: {
      gradeLabel?: string;
      tier?: string;
      rawCount?: number;
      searchQuery?: string;
      catalogRow?: CardhedgerCardRow | null;
    },
  ): Promise<MarketCompsSnapshot> {
    const id = String(cardId ?? '').trim();
    const requestCount = Math.min(
      100,
      Math.max(
        1,
        Math.floor(options?.rawCount ?? CARDHEDGER_COMPS_HISTORY_RAW_COUNT),
      ),
    );
    const gradeLabel = String(options?.gradeLabel ?? '').trim();
    const tier =
      String(options?.tier ?? 'PSA_10').trim().toUpperCase() || 'PSA_10';
    const grade = gradeLabel || cardhedgerGradeFromHistoryTier(tier);

    if (!id) {
      return this.emptyMarketCompsSnapshot({
        enabled: this.isConfigured(),
        searchQuery: options?.searchQuery ?? '',
        matched: false,
        message: 'Missing card_id',
      });
    }
    if (!this.isConfigured()) {
      return this.emptyMarketCompsSnapshot({
        enabled: false,
        searchQuery: options?.searchQuery ?? '',
        matched: false,
        message: 'Cardhedger is not configured (CARDHEDGER_API_KEY)',
      });
    }

    const row =
      options?.catalogRow ??
      ({ card_id: id } as CardhedgerCardRow);
    const resolved: ResolvedCard = {
      query: options?.searchQuery ?? '',
      row,
      confidence: 'verified',
    };
    const cached = await this.fetchCompsCached(id, grade, requestCount);
    return this.marketCompsSnapshotFromCached(
      resolved,
      cached,
      grade,
      requestCount,
    );
  }

  /** Cardhedger `POST /v1/cards/comps` for a collection row (resolve + up to 100 raw sales). */
  async getCompsSnapshotForCollection(
    col: MarketplaceCollection | null,
    options?: { tier?: string; gradeLabel?: string; rawCount?: number },
  ): Promise<MarketCompsSnapshot> {
    const requestCount = Math.min(
      100,
      Math.max(
        1,
        Math.floor(options?.rawCount ?? CARDHEDGER_COMPS_HISTORY_RAW_COUNT),
      ),
    );
    const gradeLabel = String(options?.gradeLabel ?? '').trim();
    const tier =
      String(options?.tier ?? 'PSA_10').trim().toUpperCase() || 'PSA_10';
    const grade = gradeLabel || cardhedgerGradeFromHistoryTier(tier);

    if (!col) {
      return this.emptyMarketCompsSnapshot({
        enabled: this.isConfigured(),
        searchQuery: '',
        matched: false,
        message: 'Collection not found',
      });
    }
    const query = this.resolve.buildCollectionQuery(col).query;
    if (!this.isConfigured()) {
      return this.emptyMarketCompsSnapshot({
        enabled: false,
        searchQuery: query,
        matched: false,
        message: 'Cardhedger is not configured (CARDHEDGER_API_KEY)',
      });
    }

    const resolved = await this.resolve.resolveCardForCollection(col);
    if (!resolved.row || !resolved.confidence) {
      return this.emptyMarketCompsSnapshot({
        enabled: true,
        searchQuery: resolved.query,
        matched: false,
        message: 'No matching Cardhedger card found',
      });
    }

    const q = this.resolve.buildCollectionQuery(col);
    const trust = catalogRowTrustedForMarketData(
      {
        cardName: q.cardName,
        cardNumber: q.cardNumber,
        cardSet: q.cardSet,
        psaSubject: q.psaSubject ?? undefined,
        psaBrand: q.psaBrand ?? undefined,
        psaYear: q.psaYear ?? undefined,
        cardhedgerSearchQuery: q.cardhedgerSearchQuery ?? undefined,
        listingDisplayTitle: q.listingDisplayTitle ?? undefined,
      },
      resolved.row as Record<string, unknown>,
    );
    if (!trust.ok) {
      this.logger.warn(
        JSON.stringify({
          msg: 'comps_catalog_verification_failed',
          collectionKey: col.collectionKey,
          failCodes: trust.failCodes,
          cardId:
            (resolved.row as { card_id?: unknown }).card_id != null
              ? String((resolved.row as { card_id?: unknown }).card_id)
              : null,
        }),
      );
      return this.emptyMarketCompsSnapshot({
        enabled: true,
        searchQuery: resolved.query,
        matched: false,
        message: 'Cardhedger catalog match failed verification',
      });
    }

    const cardId = String(
      (resolved.row as { card_id?: unknown }).card_id ?? '',
    ).trim();
    if (!cardId) {
      return this.emptyMarketCompsSnapshot({
        enabled: true,
        searchQuery: resolved.query,
        matched: true,
        matchConfidence: resolved.confidence,
        message: 'Resolved card missing card_id',
      });
    }

    const cached = await this.fetchCompsCached(cardId, grade, requestCount);
    return this.marketCompsSnapshotFromCached(
      resolved,
      cached,
      grade,
      requestCount,
    );
  }

  // ---------------------------------------------------------------------------
  // History merge helpers
  // ---------------------------------------------------------------------------

  private mergeTierHistoryWithCompPoints(
    base: Array<{ t: number; v: number }>,
    extra: Array<{ t: number; v: number }>,
  ): Array<{ t: number; v: number }> {
    const m = new Map<number, number>();
    const put = (t: number, v: number) => {
      if (
        !Number.isFinite(t) ||
        typeof v !== 'number' ||
        !Number.isFinite(v) ||
        !(v > 0)
      )
        return;
      m.set(Math.floor(t), v);
    };
    for (const p of base) put(p.t, p.v);
    for (const p of extra) put(p.t, p.v);
    return [...m.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([t, v]) => ({ t, v }));
  }

  /** Merge Cardhedger daily history with comps raw sales + weighted headline point. */
  private async augmentPsa10HistoryWithComps(
    cardId: string,
    tier: string,
    points: Array<{ t: number; v: number }>,
  ): Promise<Array<{ t: number; v: number }>> {
    const id = String(cardId ?? '').trim();
    const tierU = String(tier ?? '')
      .trim()
      .toUpperCase();
    if (!id || !tierU) {
      return points;
    }
    const cached = await this.fetchCompsCached(
      id,
      cardhedgerGradeFromHistoryTier(tierU),
      CARDHEDGER_COMPS_HISTORY_RAW_COUNT,
    );
    if (!cached) return points;

    const rawPts = cached.rawPoints;
    const extra: Array<{ t: number; v: number }> = [...rawPts];

    const h = cached.headline;
    const useTimeWeightedInjection =
      this.PSA10_SPOT_BASIS === 'time_weighted' &&
      h != null &&
      Number.isFinite(h.usd) &&
      h.usd > 0;

    if (useTimeWeightedInjection) {
      let tHead = h.latestSaleAtSec;
      if (tHead == null || !Number.isFinite(tHead)) {
        if (rawPts.length > 0) {
          tHead = rawPts[rawPts.length - 1].t;
        } else if (points.length > 0) {
          tHead = Math.max(...points.map((p) => p.t)) + 60;
        } else {
          tHead = Math.floor(Date.now() / 1000);
        }
      }
      extra.push({ t: Math.floor(tHead), v: h.usd });
    } else if (
      h != null &&
      Number.isFinite(h.usd) &&
      h.usd > 0 &&
      rawPts.length === 0
    ) {
      let tHead = h.latestSaleAtSec;
      if (tHead == null || !Number.isFinite(tHead)) {
        if (points.length > 0) {
          tHead = Math.max(...points.map((p) => p.t)) + 60;
        } else {
          tHead = Math.floor(Date.now() / 1000);
        }
      }
      extra.push({ t: Math.floor(tHead), v: h.usd });
    }

    if (extra.length === 0) return points;
    let merged = this.mergeTierHistoryWithCompPoints(points, extra);
    if (
      useTimeWeightedInjection &&
      h != null &&
      merged.length > 0
    ) {
      const last = merged[merged.length - 1];
      const eps = Math.max(1e-6, Math.abs(h.usd) * 1e-9);
      if (Math.abs(last.v - h.usd) > eps) {
        merged = [...merged.slice(0, -1), { t: last.t, v: h.usd }];
      }
    }
    return merged;
  }

  /**
   * Request the widest upstream-legal window first (`days` capped at 365), then backoff when sparse.
   */
  private async fetchTierHistoryByCardAdaptive(
    cardId: string,
    tier: string,
    desiredDays: number,
  ): Promise<{
    pts: Array<{ t: number; v: number }>;
    upstreamRequests: number;
  }> {
    const capRequested = Math.min(4000, Math.max(1, Math.floor(desiredDays)));
    const widest = Math.min(CARDHEDGER_PRICES_BY_CARD_MAX_DAYS, capRequested);

    const tiersDesc = [
      ...new Set([widest, 180, 90, 30, 14, 7].filter((x) => x <= widest)),
    ].sort((a, b) => b - a);

    let upstreamRequests = 0;
    for (const d of tiersDesc) {
      upstreamRequests += 1;
      const pts = await this.fetchTierHistoryByCardOnce(cardId, tier, d);
      if (pts.length >= 2) return { pts, upstreamRequests };
    }

    return { pts: [], upstreamRequests };
  }

  async fetchTierHistoryByCard(
    cardId: string,
    tier: string,
    days: number,
  ): Promise<Array<{ t: number; v: number }>> {
    return this.fetchTierHistoryByCardOnce(cardId, tier, days);
  }

  // ---------------------------------------------------------------------------
  // Public pricing math utilities (also used by CardhedgerMarketDataService AI layer)
  // ---------------------------------------------------------------------------

  pctFromPoints(points: Array<{ t: number; v: number }>): number | null {
    if (!Array.isArray(points) || points.length < 2) return null;
    const sorted = [...points].sort((a, b) => a.t - b.t);
    const first = sorted[0]?.v;
    const last = sorted[sorted.length - 1]?.v;
    if (
      first == null ||
      last == null ||
      !Number.isFinite(first) ||
      !Number.isFinite(last) ||
      first <= 0
    ) {
      return null;
    }
    return ((last - first) / first) * 100;
  }

  premiumPct(psa10: number | null, raw: number | null): number | null {
    if (
      psa10 == null ||
      raw == null ||
      !Number.isFinite(psa10) ||
      !Number.isFinite(raw) ||
      raw <= 0
    ) {
      return null;
    }
    return ((psa10 - raw) / raw) * 100;
  }

  allowsPublishedCatalogPsa10(
    merged: CardhedgerCardRow,
    confidence: 'verified' | 'approximate',
  ): boolean {
    const sales30d = this.parseCount(merged['30 Day Sales']);
    const hasReliableSales30 =
      sales30d != null && sales30d >= this.MIN_RELIABLE_SALES_30D;
    const hasMinVerifiedSales =
      this.MIN_VERIFIED_SALES_30D === 0 ||
      (sales30d != null && sales30d >= this.MIN_VERIFIED_SALES_30D);
    return (
      (confidence === 'verified' && hasMinVerifiedSales) || hasReliableSales30
    );
  }

  // ---------------------------------------------------------------------------
  // Preview (market price card) — row → MarketCollectionPreview
  // ---------------------------------------------------------------------------

  /** Region / print language from Cardhedger row (avoid hardcoding `US` for every card). */
  private pickCardhedgerMarketField(row: CardhedgerCardRow): string | null {
    for (const key of [
      'market',
      'language',
      'print_language',
      'country',
      'region',
      'locale',
    ] as const) {
      const v = row[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return null;
  }

  private historyTierForCollection(
    col: MarketplaceCollection | null | undefined,
  ): string {
    return marketHistoryTierFromComponents(
      (col?.components ?? null) as Record<string, unknown> | null,
    );
  }

  private async rowToPreview(
    row: CardhedgerCardRow,
    query: string,
    confidence: 'verified' | 'approximate',
    pricingTier = 'PSA_10',
  ): Promise<MarketCollectionPreview> {
    const tierU = String(pricingTier ?? 'PSA_10')
      .trim()
      .toUpperCase();
    const chGrade = cardhedgerGradeFromHistoryTier(tierU);
    const isQualifierTier = tierU === 'PSA_AUTH';
    const cardId = String(row.card_id ?? '').trim();
    const [allPrices, tierHistory, compsCached, fmvResult] = await Promise.all([
      cardId ? this.fetchAllPricesByCard(cardId) : Promise.resolve([]),
      cardId
        ? this.fetchTierHistoryByCardOnce(
            cardId,
            tierU,
            CARDHEDGER_PRICES_BY_CARD_MAX_DAYS,
          )
        : Promise.resolve([]),
      cardId ? this.fetchCompsCached(cardId, chGrade) : Promise.resolve(null),
      cardId ? this.fetchFmvByCard(cardId, chGrade).catch(() => null) : Promise.resolve(null),
    ]);
    const compsHeadline = compsCached?.headline ?? null;
    const merged = allPrices.length > 0 ? { ...row, prices: allPrices } : row;
    const tierCatalogRaw = this.readGradePrice(merged, chGrade);
    const latestPt = this.latestHistoryPoint(tierHistory);
    const sales7d = this.parseCount(merged['7 Day Sales']);
    const sales30d = this.parseCount(merged['30 Day Sales']);
    const hasReliableSales30 =
      sales30d != null && sales30d >= this.MIN_RELIABLE_SALES_30D;
    const hasMinVerifiedSales =
      this.MIN_VERIFIED_SALES_30D === 0 ||
      (sales30d != null && sales30d >= this.MIN_VERIFIED_SALES_30D);
    const hasCompsEvidence =
      (compsCached?.rawPoints?.length ?? 0) > 0 ||
      (compsHeadline != null &&
        Number.isFinite(compsHeadline.usd) &&
        compsHeadline.usd > 0);
    const allowTierPricing = isQualifierTier
      ? tierCatalogRaw != null ||
        latestPt != null ||
        compsCached != null ||
        confidence === 'verified'
      : (confidence === 'verified' && hasMinVerifiedSales) ||
        hasReliableSales30 ||
        hasCompsEvidence;
    const anyTierSignal =
      tierCatalogRaw != null || latestPt != null || compsCached != null;
    let spotUsd: number | null = null;
    let spotPriceBasis:
      | 'comps'
      | 'latest_sale'
      | 'sparse_sale_avg'
      | 'catalog'
      | 'comps_median'
      | 'fmv'
      | null = null;
    let latestSaleAt: number | null = null;
    let headlineCompCount: number | null = null;
    let fmvConfidenceGrade: 'A' | 'B' | 'C' | 'D' | null = null;
    let fmvFreshnessDays: number | null = null;
    let fmvMethod: string | null = null;
    let fmvPriceLow: number | null = null;
    let fmvPriceHigh: number | null = null;

    const pickBestTierReference = (): void => {
      const rawPts = compsCached?.rawPoints;
      const skipSparseMeans = hasReliableSales30 && !isQualifierTier;

      if (!skipSparseMeans) {
        const rawSparse = rawPts?.length
          ? this.sparseSalePriceAverage(rawPts, SPARSE_SALE_POINTS_MAX)
          : null;
        if (rawSparse) {
          spotUsd = rawSparse.avg;
          spotPriceBasis = 'sparse_sale_avg';
          latestSaleAt = rawSparse.latestT;
          headlineCompCount = rawSparse.n;
          return;
        }
      }
      const rawPtsForComps = compsCached?.rawPoints ?? [];
      const fromComps = this.pickPublishedUsdFromComps(
        compsHeadline,
        rawPtsForComps,
        hasReliableSales30,
      );
      if (fromComps) {
        spotUsd = fromComps.usd;
        spotPriceBasis = fromComps.spotPriceBasis;
        latestSaleAt = fromComps.latestSaleAt;
        headlineCompCount = fromComps.headlineCompCount;
        return;
      }
      if (!skipSparseMeans) {
        const histSparse = tierHistory.length
          ? this.sparseSalePriceAverage(tierHistory, SPARSE_SALE_POINTS_MAX)
          : null;
        if (histSparse) {
          spotUsd = histSparse.avg;
          spotPriceBasis = 'sparse_sale_avg';
          latestSaleAt = histSparse.latestT;
          headlineCompCount = histSparse.n;
          return;
        }
      }
      if (latestPt) {
        spotUsd = latestPt.v;
        spotPriceBasis = 'latest_sale';
        latestSaleAt = latestPt.t;
        return;
      }
      if (rawPts && rawPts.length > 0) {
        const last = rawPts[rawPts.length - 1];
        if (
          typeof last.v === 'number' &&
          Number.isFinite(last.v) &&
          last.v > 0
        ) {
          spotUsd = last.v;
          spotPriceBasis = 'latest_sale';
          latestSaleAt = last.t;
          return;
        }
      }
      if (tierCatalogRaw != null) {
        spotUsd = tierCatalogRaw;
        spotPriceBasis = 'catalog';
      }
    };

    if (anyTierSignal) {
      pickBestTierReference();
    }

    /** Cardhedger grade-slot catalog can sit far above recent comps TW — prefer comps when divergent. */
    const CATALOG_COMPS_STALE_RATIO = 2;
    if (
      spotUsd != null &&
      spotPriceBasis === 'catalog' &&
      compsHeadline != null &&
      Number.isFinite(compsHeadline.usd) &&
      compsHeadline.usd > 0 &&
      spotUsd / compsHeadline.usd >= CATALOG_COMPS_STALE_RATIO
    ) {
      const rawPtsForComps = compsCached?.rawPoints ?? [];
      const fromComps = this.pickPublishedUsdFromComps(
        compsHeadline,
        rawPtsForComps,
        hasReliableSales30,
      );
      if (fromComps != null && fromComps.usd > 0) {
        spotUsd = fromComps.usd;
        spotPriceBasis = fromComps.spotPriceBasis;
        latestSaleAt = fromComps.latestSaleAt;
        headlineCompCount = fromComps.headlineCompCount;
      }
    }

    // FMV fallback: when comps/history produced no spot price, use CardHedger's
    // Winsorized-median FMV with movement-index projection for stale cards.
    // Segment-level fallbacks (too broad) and no_data are excluded.
    if (spotUsd == null && fmvResult != null) {
      const fmvPriceRaw = fmvResult.price;
      const fmvGrade_ = fmvResult.confidence_grade;
      const fmvMethod_ = fmvResult.method;
      const isUsableMethod =
        fmvMethod_ != null &&
        fmvMethod_ !== 'no_data' &&
        !fmvMethod_.startsWith('segment_fallback');
      const isUsableGrade = fmvGrade_ === 'A' || fmvGrade_ === 'B' || fmvGrade_ === 'C';
      if (
        fmvPriceRaw != null &&
        Number.isFinite(fmvPriceRaw) &&
        fmvPriceRaw > 0 &&
        isUsableMethod &&
        isUsableGrade
      ) {
        spotUsd = fmvPriceRaw;
        spotPriceBasis = 'fmv';
        fmvConfidenceGrade = fmvGrade_;
        fmvFreshnessDays = fmvResult.freshness_days;
        fmvMethod = fmvMethod_;
        fmvPriceLow =
          fmvResult.price_low != null && fmvResult.price_low > 0
            ? fmvResult.price_low
            : null;
        fmvPriceHigh =
          fmvResult.price_high != null && fmvResult.price_high > 0
            ? fmvResult.price_high
            : null;
        if (fmvFreshnessDays != null) {
          latestSaleAt = Math.floor(Date.now() / 1000) - fmvFreshnessDays * 86400;
        }
        this.logger.debug(
          `cardhedger_fmv_fallback card_id=${cardId} grade=${chGrade} price=${fmvPriceRaw} grade=${fmvGrade_} method=${fmvMethod_} freshness=${fmvFreshnessDays ?? 'n/a'}d`,
        );
      }
    }

    const compsNoSales = compsCached?.noSalesForGrade === true;
    // Only suppress when FMV didn't recover a price (spotUsd still null after fallback).
    const pricingSuppressedReason =
      compsNoSales && spotUsd == null
        ? 'cardhedger_no_sales_for_grade'
        : !anyTierSignal && spotUsd == null
          ? 'no_tier_price_in_source'
          : spotUsd == null
            ? 'no_publishable_tier_slot'
            : null;
    const headlineIso =
      latestSaleAt != null ? new Date(latestSaleAt * 1000).toISOString() : null;
    this.logger.debug(
      `cardhedger_preview card_id=${cardId || 'n/a'} tier=${tierU} confidence=${confidence} comps_tw=${compsHeadline?.usd ?? 'n/a'} comp_n=${compsHeadline?.countUsed ?? 'n/a'} spot_basis_mode=${this.PSA10_SPOT_BASIS} tierRaw=${tierCatalogRaw ?? 'null'} latestHist=${latestPt?.v ?? 'null'}@${latestPt?.t ?? 'n/a'} sales30d=${sales30d ?? 'null'} published=${spotUsd ?? 'null'} basis=${spotPriceBasis ?? 'n/a'} salesGate=${allowTierPricing ? 'high' : 'low'} reason=${pricingSuppressedReason ?? 'ok'}`,
    );
    const pricesByGrade: Record<string, number> = {};
    const upsertGrade = (gradeRaw: unknown, priceRaw: unknown) => {
      const grade = String(gradeRaw ?? '').trim();
      const price = this.parsePrice(priceRaw);
      if (!grade || price == null) return;
      pricesByGrade[grade] = price;
    };
    if (Array.isArray(merged.prices)) {
      for (const p of merged.prices) {
        if (typeof p !== 'object' || p == null) continue;
        const pp = p as { grade?: unknown; Grade?: unknown; price?: unknown };
        upsertGrade(pp.grade ?? pp.Grade, pp.price);
      }
    }
    if (Array.isArray(allPrices)) {
      for (const p of allPrices) {
        if (typeof p !== 'object' || p == null) continue;
        const pp = p as { grade?: unknown; Grade?: unknown; price?: unknown };
        upsertGrade(pp.grade ?? pp.Grade, pp.price);
      }
    }
    const basisForPricesByGrade =
      spotPriceBasis != null &&
      ['comps', 'latest_sale', 'sparse_sale_avg', 'catalog', 'comps_median', 'fmv'].includes(
        spotPriceBasis,
      );
    if (spotUsd != null && basisForPricesByGrade) {
      pricesByGrade[chGrade] = spotUsd;
    }
    // Pre-compute band metadata outside closures; TypeScript's CFA aggressively
    // narrows spotPriceBasis inside closures and removes valid union members
    // ('sparse_sale_avg', 'catalog') through control-flow analysis of the
    // assignments above, so we capture the data here at the call site instead.
    const _basisStr = String(spotPriceBasis ?? ''); // string comparison escapes CFA narrowing
    const _bandSaleCount: number | null =
      headlineCompCount != null &&
      (_basisStr === 'comps' || _basisStr === 'sparse_sale_avg' || _basisStr === 'comps_median')
        ? headlineCompCount
        : null;
    const _bandApproxSaleCount: boolean | null =
      _basisStr === 'comps' ? false : _basisStr === 'sparse_sale_avg' || _basisStr === 'comps_median' ? true : null;
    const mkBand = (v: number | null) =>
      v != null
        ? ({
            avg: v,
            low: v,
            high: v,
            lastUpdated: headlineIso,
            saleCount: _bandSaleCount,
            approxSaleCount: _bandApproxSaleCount,
            avg1d: null,
            avg7d: null,
            avg30d: null,
            median3d: null,
            median7d: null,
            median30d: null,
          } as const)
        : null;
    const previewMessage =
      compsNoSales && spotUsd == null
        ? `Catalog matched (card_id=${cardId}) but Cardhedger has no ${chGrade} sales indexed yet`
        : undefined;

    return {
      enabled: true,
      searchQuery: query,
      matched: true,
      matchConfidence: confidence,
      message: previewMessage,
      card: {
        id: cardId,
        name: String(row.description ?? row.name ?? ''),
        cardNumber: String(row.number ?? ''),
        setName: String(row.set ?? ''),
        variant:
          typeof row.variant === 'string' && row.variant.trim()
            ? row.variant.trim()
            : null,
        setType:
          typeof row.set_type === 'string' && row.set_type.trim()
            ? row.set_type.trim()
            : null,
        category:
          typeof row.category === 'string' && row.category.trim()
            ? row.category.trim()
            : null,
        categoryGroup:
          typeof row.category_group === 'string' && row.category_group.trim()
            ? row.category_group.trim()
            : null,
        setSlug: null,
        image:
          typeof row.image === 'string' && row.image.trim()
            ? row.image.trim()
            : null,
        tcgplayerId: null,
        currency: 'USD',
        market: this.pickCardhedgerMarketField(merged),
        lastUpdated: headlineIso,
        topPrice: (() => {
          if (spotUsd == null) return null;
          if (allowTierPricing || hasCompsEvidence) return spotUsd;
          // Use _basisStr (pre-computed string) to avoid TypeScript CFA
          // narrowing that removes 'sparse_sale_avg' / 'catalog' inside IIFEs.
          if (
            _basisStr === 'comps' ||
            _basisStr === 'comps_median' ||
            _basisStr === 'latest_sale' ||
            _basisStr === 'sparse_sale_avg'
          )
            return spotUsd;
          if (_basisStr === 'catalog') return confidence === 'verified' ? spotUsd : null;
          if (_basisStr === 'fmv')
            return fmvConfidenceGrade === 'A' ||
              fmvConfidenceGrade === 'B' ||
              fmvConfidenceGrade === 'C'
              ? spotUsd
              : null;
          return null;
        })(),
        totalSaleCount:
          typeof merged['30 Day Sales'] === 'number'
            ? Number(merged['30 Day Sales'])
            : sales30d,
        hasGraded: anyTierSignal,
        gradedTiersAvailable: Object.keys(pricesByGrade).filter(Boolean),
        pricesByGrade,
        sales7d,
        sales30d,
        gainPct7d: typeof merged.gain === 'number' ? Number(merged.gain) : null,
        gainPct30d:
          typeof merged.gain_30day === 'number'
            ? Number(merged.gain_30day)
            : null,
        priceReliability: allowTierPricing ? 'high' : 'low',
        pricingSuppressedReason,
        spotPriceBasis,
        latestSaleAt,
        fmvConfidenceGrade,
        fmvFreshnessDays,
        fmvMethod,
        fmvPriceLow,
        fmvPriceHigh,
        ebayNearMint: null,
        tcgplayerNearMint: null,
        ebayPsa10: tierU === 'PSA_10' ? mkBand(spotUsd) : null,
        ebayPsa9: null,
        ebayPsaTiers: {
          [tierU]: mkBand(allowTierPricing ? spotUsd : null),
        },
      },
    };
  }

  async getPreviewForCollection(
    col: MarketplaceCollection | null,
  ): Promise<MarketCollectionPreview> {
    if (!col) {
      return {
        enabled: this.isConfigured(),
        searchQuery: '',
        matched: false,
        message: 'Collection not found',
        card: null,
      };
    }
    if (!this.isConfigured()) {
      const q = this.resolve.buildCollectionQuery(col);
      return {
        enabled: false,
        searchQuery: q.query,
        matched: false,
        message: 'Cardhedger is not configured (CARDHEDGER_API_KEY)',
        card: null,
      };
    }

    try {
      const r = await this.resolve.resolveCardForCollection(col);
      return this.buildPreviewFromResolved(r, col);
    } catch (e) {
      return {
        enabled: true,
        searchQuery: this.resolve.buildCollectionQuery(col).query,
        matched: false,
        message: e instanceof Error ? e.message : String(e),
        card: null,
      };
    }
  }

  async buildPreviewFromResolved(
    r: ResolvedCard,
    col?: MarketplaceCollection | null,
  ): Promise<MarketCollectionPreview> {
    if (!r.row || !r.confidence) {
      return {
        enabled: true,
        searchQuery: r.query,
        matched: false,
        message: 'No matching Cardhedger card found',
        card: null,
      };
    }
    const tier = this.historyTierForCollection(col ?? null);
    return this.rowToPreview(r.row, r.query, r.confidence, tier);
  }

  // ---------------------------------------------------------------------------
  // Tier price history (collection-level)
  // ---------------------------------------------------------------------------

  async getTierPriceHistoryForCollection(
    col: MarketplaceCollection | null,
    options: {
      tier: string;
      period: MarketHistoryPeriod;
      maxCalendarDays: number;
      maxRequests?: number;
    },
  ): Promise<MarketPriceHistoryResult> {
    const days = Math.min(
      4000,
      Math.max(1, Math.floor(options.maxCalendarDays)),
    );
    const tier = String(options.tier ?? 'PSA_10').trim() || 'PSA_10';
    if (!col) {
      return {
        enabled: this.isConfigured(),
        searchQuery: '',
        matched: false,
        message: 'Collection not found',
        days,
        tier,
        period: options.period,
        points: [],
        source: `cardhedger:${tier}`,
        upstreamRequests: 0,
      };
    }
    if (!this.isConfigured()) {
      return {
        enabled: false,
        searchQuery: this.resolve.buildCollectionQuery(col).query,
        matched: false,
        message: 'Cardhedger is not configured (CARDHEDGER_API_KEY)',
        days,
        tier,
        period: options.period,
        points: [],
        source: `cardhedger:${tier}`,
        upstreamRequests: 0,
      };
    }

    const resolved = await this.resolve.resolveCardForCollection(col);
    return this.buildHistoryFromResolved(resolved, options);
  }

  async buildHistoryFromResolved(
    resolved: ResolvedCard,
    options: {
      tier: string;
      period: MarketHistoryPeriod;
      maxCalendarDays: number;
      maxRequests?: number;
    },
  ): Promise<MarketPriceHistoryResult> {
    const days = Math.min(
      4000,
      Math.max(1, Math.floor(options.maxCalendarDays)),
    );
    const tier = String(options.tier ?? 'PSA_10').trim() || 'PSA_10';

    if (!resolved.row || !resolved.confidence) {
      return {
        enabled: true,
        searchQuery: resolved.query,
        matched: false,
        message: 'No matching Cardhedger card found',
        matchConfidence: resolved.confidence,
        days,
        tier,
        period: options.period,
        points: [],
        source: `cardhedger:${tier}`,
        upstreamRequests: 1,
      };
    }

    const resolvedCardId = String(resolved.row.card_id ?? '').trim();

    let history: Array<{ t: number; v: number }> = [];
    let historyUpstreamHits = 0;

    if (resolvedCardId) {
      /**
       * Match rowToPreview: headline PSA 10 uses `prices-by-card` up to
       * {@link CARDHEDGER_PRICES_BY_CARD_MAX_DAYS}. If we only fetch the UI window (e.g. 90d),
       * sparse/recent series can end on an older daily close while the preview shows the true
       * latest observation from a full-year fetch — chart vs market price diverge.
       */
      const historyFetchDays = Math.max(
        days,
        CARDHEDGER_PRICES_BY_CARD_MAX_DAYS,
      );
      const adaptive = await this.fetchTierHistoryByCardAdaptive(
        resolvedCardId,
        tier,
        historyFetchDays,
      );
      history = adaptive.pts;
      historyUpstreamHits = adaptive.upstreamRequests;
    }

    const historyMerged = await this.augmentPsa10HistoryWithComps(
      resolvedCardId,
      tier,
      history,
    );

    if (historyMerged.length >= 2) {
      const tierU = tier.trim().toUpperCase();
      const compsAugmented =
        tierU !== '' &&
        (historyMerged.length !== history.length ||
          JSON.stringify(historyMerged) !== JSON.stringify(history));
      return {
        enabled: true,
        searchQuery: resolved.query,
        matched: true,
        matchConfidence: resolved.confidence,
        days,
        tier,
        period: options.period,
        points: historyMerged,
        source: compsAugmented
          ? `cardhedger:${tier}:history:comps_sales`
          : `cardhedger:${tier}:history`,
        upstreamRequests: historyUpstreamHits,
      };
    }

    const resolvedCardIdForFallback = resolvedCardId;

    const allPrices = resolvedCardIdForFallback
      ? await this.fetchAllPricesByCard(resolvedCardIdForFallback)
      : [];
    const mergedRow =
      allPrices.length > 0
        ? ({ ...resolved.row, prices: allPrices } as CardhedgerCardRow)
        : resolved.row;
    const spot = this.readTierSpot(mergedRow, tier);
    if (spot.usd == null) {
      return {
        enabled: true,
        searchQuery: resolved.query,
        matched: true,
        matchConfidence: resolved.confidence,
        message: `No ${tier} spot price from Cardhedger (empty prices-by-card / comps for card_id=${resolvedCardIdForFallback})`,
        days,
        tier,
        period: options.period,
        points: [],
        source: `cardhedger:${tier}`,
        upstreamRequests: 1,
      };
    }
    const catalogSpotPoint = {
      t: Math.floor(Date.now() / 1000),
      v: spot.usd,
    };
    return {
      enabled: true,
      searchQuery: resolved.query,
      matched: true,
      matchConfidence: resolved.confidence,
      days,
      tier,
      period: options.period,
      points: [catalogSpotPoint],
      source: `cardhedger:${tier}:catalog_spot`,
      upstreamRequests: 1,
    };
  }

  async getNearMintHistoryForCollection(
    col: MarketplaceCollection | null,
    options?: { days?: number; maxRequests?: number },
  ): Promise<MarketPriceHistoryResult> {
    const days = Math.min(365, Math.max(1, Math.floor(options?.days ?? 90)));
    return this.getTierPriceHistoryForCollection(col, {
      tier: 'PSA_10',
      period: days <= 7 ? '7d' : days <= 30 ? '30d' : days <= 90 ? '90d' : '1y',
      maxCalendarDays: days,
      maxRequests: options?.maxRequests ?? 1,
    });
  }
}
