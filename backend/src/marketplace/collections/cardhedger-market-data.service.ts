import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { CardhedgerService } from '../../cardhedger/cardhedger.service';
import type { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import {
  normalizeForExactCardNumberKey,
  normalizeForExactCatalogMatch,
  primaryCardNumber,
} from '../utils/card-match.util';
import type {
  MarketCollectionPreview,
  MarketPriceHistoryResult,
} from '../utils/market-reference.types';
import type { MarketHistoryPeriod } from '../utils/price-history-period.util';

type CardhedgerCardRow = Record<string, unknown>;

/** Return type of resolveCardForCollection — used for the shared resolve cache and getBundledCardData. */
type ResolvedCard = {
  query: string;
  row: CardhedgerCardRow | null;
  confidence?: 'verified' | 'approximate';
};

@Injectable()
export class CardhedgerMarketDataService {
  private readonly logger = new Logger(CardhedgerMarketDataService.name);
  private readonly psaSpecIdMap = new Map<string, string>();

  // TTL-based caches to avoid unbounded memory growth and serve stale data during Cardhedger outages.
  private readonly PRICES_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
  private readonly RESOLVE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
  private readonly MIN_RELIABLE_SALES_30D: number;
  private readonly allPricesByCardCache = new Map<string, { rows: CardhedgerCardRow[]; ts: number }>();
  private readonly resolveCardCache = new Map<string, { result: ResolvedCard; ts: number }>();

  constructor(
    private readonly cardhedger: CardhedgerService,
    private readonly blockchain: BlockchainService,
    private readonly config: ConfigService,
  ) {
    this.psaSpecIdMap = this.readPsaSpecIdMapFromEnv();
    this.MIN_RELIABLE_SALES_30D = Math.max(
      0,
      Number(this.config.get<string>('CARDHEDGER_MIN_RELIABLE_SALES_30D') ?? 2) || 2,
    );
  }

  private readPsaSpecIdMapFromEnv(): Map<string, string> {
    const out = new Map<string, string>();
    const raw = this.config.get<string>('CARDHEDGER_PSA_SPECID_MAP');
    if (!raw?.trim()) return out;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const [k, v] of Object.entries(parsed)) {
        const kk = String(k).trim();
        const vv = typeof v === 'string' ? v.trim() : '';
        if (!kk || !vv) continue;
        out.set(kk, vv);
      }
    } catch {
      // ignore invalid env JSON; runtime search path still works.
    }
    return out;
  }

  isConfigured(): boolean {
    try {
      this.cardhedger.assertConfigured();
      return true;
    } catch {
      return false;
    }
  }

  buildCollectionQuery(col: MarketplaceCollection | null): {
    query: string;
    cardName: string;
    cardSet: string;
    cardNumber: string;
    cardhedgerCardId: string | null;
    cardhedgerSearchQuery: string | null;
    psaSpecId: string | null;
  } {
    const comp = (col?.components ?? {}) as Record<string, unknown>;
    const cardName = String(comp.cardName ?? '').trim();
    const cardSet = String(comp.cardSet ?? '').trim();
    const cardNumber = String(comp.cardNumber ?? '').trim();
    const query = [cardName, cardNumber, cardSet].filter(Boolean).join(' ').trim();
    const cardhedgerCardId =
      typeof comp.cardhedgerCardId === 'string' && comp.cardhedgerCardId.trim()
        ? comp.cardhedgerCardId.trim()
        : null;
    const cardhedgerSearchQuery =
      typeof comp.cardhedgerSearchQuery === 'string' && comp.cardhedgerSearchQuery.trim()
        ? comp.cardhedgerSearchQuery.trim()
        : null;
    const psaSpecId =
      typeof comp.psaSpecId === 'string' && comp.psaSpecId.trim()
        ? comp.psaSpecId.trim()
        : typeof comp.psaSpecId === 'number' && Number.isFinite(comp.psaSpecId)
          ? String(Math.floor(comp.psaSpecId))
          : null;
    return {
      query,
      cardName,
      cardSet,
      cardNumber,
      cardhedgerCardId,
      cardhedgerSearchQuery,
      psaSpecId,
    };
  }

  private parseCardRows(body: unknown): CardhedgerCardRow[] {
    if (typeof body !== 'object' || body == null) return [];
    const cards = (body as { cards?: unknown[] }).cards;
    if (!Array.isArray(cards)) return [];
    return cards.filter((x): x is CardhedgerCardRow => typeof x === 'object' && x != null);
  }

  /**
   * Split a string into lowercase alphanumeric tokens (length >= 2).
   * Used for fuzzy name/set matching that tolerates inserted words
   * (e.g. "pikachu/grey felt hat" vs "Pikachu with Grey Felt Hat Van Gogh").
   */
  private tokenizeForMatch(s: string): Set<string> {
    return new Set(
      String(s ?? '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 2),
    );
  }

  /**
   * How much of `got` (the Cardhedger side) is covered by the `wantPool`
   * (our stored cardName / cardSet / cardhedgerSearchQuery tokens).
   * Returns 0..1. 0 when got is empty.
   */
  private coverageRatio(wantPool: string, got: string): number {
    const want = this.tokenizeForMatch(wantPool);
    const gotTokens = this.tokenizeForMatch(got);
    if (gotTokens.size === 0) return 0;
    let common = 0;
    for (const t of gotTokens) if (want.has(t)) common += 1;
    return common / gotTokens.size;
  }

  private scoreCard(
    row: CardhedgerCardRow,
    hints: {
      cardName: string;
      cardSet: string;
      cardNumber: string;
      cardhedgerSearchQuery?: string | null;
    },
  ): { score: number; verified: boolean; numberMatched: boolean } {
    const sameNumber = (a: string, b: string): boolean => {
      if (!a || !b) return false;
      if (a === b) return true;
      const aTrim = a.replace(/^0+/, '');
      const bTrim = b.replace(/^0+/, '');
      return Boolean(aTrim) && Boolean(bTrim) && aTrim === bTrim;
    };

    const rowName = String(row.description ?? row.name ?? '');
    const rowSet = String(row.set ?? '');
    const rowNum = String(row.number ?? '');

    // Normalized strings for the legacy substring compare.
    const wantName = normalizeForExactCatalogMatch(hints.cardName);
    const wantSet = normalizeForExactCatalogMatch(hints.cardSet);
    const wantNum = normalizeForExactCardNumberKey(
      primaryCardNumber(hints.cardNumber),
    );
    const gotName = normalizeForExactCatalogMatch(rowName);
    const gotSet = normalizeForExactCatalogMatch(rowSet);
    const gotNum = normalizeForExactCardNumberKey(primaryCardNumber(rowNum));

    const numberMatched = sameNumber(wantNum, gotNum);

    // Substring path (tight, keeps legacy exact-match wins)
    const nameSubstring = Boolean(
      wantName && gotName && (gotName.includes(wantName) || wantName.includes(gotName)),
    );
    const setSubstring = Boolean(
      wantSet && gotSet && (gotSet.includes(wantSet) || wantSet.includes(gotSet)),
    );

    // Token coverage path — used to tolerate inserted words and abbreviated set codes.
    // We pool cardName/cardSet with cardhedgerSearchQuery (curated long-form) when present,
    // because Cardhedger's row.description often matches the curated query verbatim.
    const wantNamePool = [hints.cardName, hints.cardhedgerSearchQuery ?? '']
      .filter(Boolean)
      .join(' ');
    const wantSetPool = [hints.cardSet, hints.cardhedgerSearchQuery ?? '']
      .filter(Boolean)
      .join(' ');
    const nameCoverage = this.coverageRatio(wantNamePool, rowName);
    const setCoverage = this.coverageRatio(wantSetPool, rowSet);
    const nameTokenMatch = nameCoverage >= 0.6;
    const setTokenMatch = setCoverage >= 0.5;

    const nameMatched = nameSubstring || nameTokenMatch;
    const setMatched = setSubstring || setTokenMatch;

    let score = 0;
    if (numberMatched) score += 100;
    if (setMatched) score += 60;
    if (nameMatched) score += 50;

    const verified = numberMatched && setMatched && nameMatched;
    return { score, verified, numberMatched };
  }

  private parsePrice(raw: unknown): number | null {
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
    if (typeof raw === 'string') {
      const n = parseFloat(raw.replace(/[^0-9.-]/g, ''));
      if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
  }

  private parseCount(raw: unknown): number | null {
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
    if (t !== 'PSA_10') {
      return { usd: null, gainPct };
    }
    return { usd: this.readGradePrice(row, 'PSA 10'), gainPct };
  }

  async fetchAllPricesByCard(cardId: string): Promise<CardhedgerCardRow[]> {
    const id = String(cardId ?? '').trim();
    if (!id) return [];
    const cached = this.allPricesByCardCache.get(id);
    if (cached && Date.now() - cached.ts < this.PRICES_CACHE_TTL_MS) {
      return cached.rows;
    }
    try {
      const body = await this.cardhedger.forwardJson('POST', '/v1/cards/all-prices-by-card', {
        body: { card_id: id },
      });
      const prices =
        typeof body === 'object' && body != null && Array.isArray((body as { prices?: unknown }).prices)
          ? ((body as { prices: unknown[] }).prices as unknown[])
          : [];
      const out = prices.filter((x): x is CardhedgerCardRow => typeof x === 'object' && x != null);
      this.allPricesByCardCache.set(id, { rows: out, ts: Date.now() });
      return out;
    } catch {
      this.allPricesByCardCache.set(id, { rows: [], ts: Date.now() });
      return [];
    }
  }

  private parseHistoricalPoints(body: unknown): Array<{ t: number; v: number }> {
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

  async fetchTierHistoryByCard(
    cardId: string,
    tier: string,
    days: number,
  ): Promise<Array<{ t: number; v: number }>> {
    const id = String(cardId ?? '').trim();
    if (!id) return [];
    const tierUpper = String(tier ?? '').trim().toUpperCase();
    const grade = tierUpper === 'PSA_10' ? 'PSA 10' : tierUpper;
    try {
      const body = await this.cardhedger.forwardJson('POST', '/v1/cards/prices-by-card', {
        body: { card_id: id, grade, days },
      });
      return this.parseHistoricalPoints(body);
    } catch {
      return [];
    }
  }

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

  private fmtSignedPct(v: number | null | undefined, digits = 1): string {
    if (v == null || !Number.isFinite(v)) return 'trend data is sparse';
    return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`;
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

  private async rowToPreview(
    row: CardhedgerCardRow,
    query: string,
    confidence: 'verified' | 'approximate',
  ): Promise<MarketCollectionPreview> {
    const cardId = String(row.card_id ?? '').trim();
    const allPrices = cardId ? await this.fetchAllPricesByCard(cardId) : [];
    const merged = allPrices.length > 0 ? { ...row, prices: allPrices } : row;
    const psa10Raw = this.readGradePrice(merged, 'PSA 10');
    const sales7d = this.parseCount(merged['7 Day Sales']);
    const sales30d = this.parseCount(merged['30 Day Sales']);
    const hasReliableSales30 = sales30d != null && sales30d >= this.MIN_RELIABLE_SALES_30D;
    // Pricing guardrail policy:
    //   - `verified` (including curated cardhedgerCardId) ⇒ always publish the source price.
    //     Curators have explicitly bound the collection to a specific Cardhedger card, so
    //     suppressing here would hide legitimate prices for thinly-traded-but-real cards.
    //   - `approximate` (fuzzy search hit) ⇒ require recent sales so a single stale listing
    //     doesn't drive a misleading headline price.
    const allowPsa10Pricing = confidence === 'verified' || hasReliableSales30;
    const psa10 = allowPsa10Pricing ? psa10Raw : null;
    const pricingSuppressedReason =
      psa10Raw == null
        ? 'no_psa10_price_in_source'
        : allowPsa10Pricing
          ? null
          : `approximate_match_low_sales(30d<${this.MIN_RELIABLE_SALES_30D})`;
    this.logger.debug(
      `cardhedger_preview card_id=${cardId || 'n/a'} confidence=${confidence} psa10Raw=${psa10Raw ?? 'null'} sales30d=${sales30d ?? 'null'} published=${psa10 ?? 'null'} reason=${pricingSuppressedReason ?? 'ok'}`,
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
    const mkBand = (v: number | null) =>
      v != null
        ? ({
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
          } as const)
        : null;
    return {
      enabled: true,
      searchQuery: query,
      matched: true,
      matchConfidence: confidence,
      card: {
        id: cardId,
        name: String(row.description ?? row.name ?? ''),
        cardNumber: String(row.number ?? ''),
        setName: String(row.set ?? ''),
        variant:
          typeof row.variant === 'string' && row.variant.trim() ? row.variant.trim() : null,
        setType:
          typeof row.set_type === 'string' && row.set_type.trim() ? row.set_type.trim() : null,
        category:
          typeof row.category === 'string' && row.category.trim() ? row.category.trim() : null,
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
        market: 'US',
        lastUpdated: null,
        topPrice: psa10,
        totalSaleCount:
          typeof merged['30 Day Sales'] === 'number' ? Number(merged['30 Day Sales']) : sales30d,
        hasGraded: psa10Raw != null,
        gradedTiersAvailable: [psa10 != null ? 'PSA_10' : null].filter(
          (x): x is string => Boolean(x),
        ),
        pricesByGrade,
        sales7d,
        sales30d,
        gainPct7d: typeof merged.gain === 'number' ? Number(merged.gain) : null,
        gainPct30d:
          typeof merged.gain_30day === 'number' ? Number(merged.gain_30day) : null,
        priceReliability: allowPsa10Pricing ? 'high' : 'low',
        pricingSuppressedReason,
        ebayNearMint: null,
        tcgplayerNearMint: null,
        ebayPsa10: mkBand(psa10),
        ebayPsa9: null,
      },
    };
  }

  private async resolveCardForCollection(
    col: MarketplaceCollection | null,
  ): Promise<ResolvedCard> {
    const cacheKey = col?.collectionKey ?? '';
    if (cacheKey) {
      const cached = this.resolveCardCache.get(cacheKey);
      if (cached && Date.now() - cached.ts < this.RESOLVE_CACHE_TTL_MS) {
        return cached.result;
      }
    }

    const result = await this.resolveCardForCollectionUncached(col);

    if (cacheKey) {
      this.resolveCardCache.set(cacheKey, { result, ts: Date.now() });
    }
    return result;
  }

  private async resolveCardForCollectionUncached(
    col: MarketplaceCollection | null,
  ): Promise<ResolvedCard> {
    const q = this.buildCollectionQuery(col);
    const displayLabel = String(col?.displayLabel ?? '').trim();
    const query = q.cardhedgerSearchQuery || displayLabel || q.query;
    if (!query) return { query: '', row: null };

    if (q.cardhedgerCardId) {
      try {
        const body = await this.cardhedger.forwardJson('POST', '/v1/cards/card-details', {
          body: { card_id: q.cardhedgerCardId },
        });
        const rows = this.parseCardRows(body);
        if (rows[0]) {
          const strict = this.scoreCard(rows[0], q);
          // An explicitly curated card_id is an authoritative link (admin/mint pipeline
          // has already bound this collection to a specific Cardhedger card). Trust it
          // as `verified` so downstream pricing gates don't silently suppress the price.
          // Only demote to `approximate` when we actually have a cardNumber to cross-check
          // AND Cardhedger returned a different number — that signals a stale/miswired link.
          const trustCardId = !q.cardNumber || strict.numberMatched;
          return {
            query,
            row: rows[0],
            confidence: trustCardId ? 'verified' : 'approximate',
          };
        }
      } catch {
        // fall through to search
      }
    }

    const mappedFromSpec =
      q.psaSpecId && this.psaSpecIdMap.has(q.psaSpecId)
        ? this.psaSpecIdMap.get(q.psaSpecId) ?? null
        : null;
    if (mappedFromSpec) {
      try {
        const body = await this.cardhedger.forwardJson('POST', '/v1/cards/card-details', {
          body: { card_id: mappedFromSpec },
        });
        const rows = this.parseCardRows(body);
        if (rows[0]) {
          const strict = this.scoreCard(rows[0], q);
          if (strict.verified || strict.numberMatched) {
            return {
              query,
              row: rows[0],
              confidence: strict.verified ? 'verified' : 'approximate',
            };
          }
        }
      } catch {
        // fall through
      }
    }

    const searchCandidates = [
      q.cardhedgerSearchQuery,
      displayLabel,
      q.query,
      [q.cardNumber, q.cardSet].filter(Boolean).join(' ').trim(),
      q.cardNumber,
    ]
      .map((x) => String(x ?? '').trim())
      .filter((x, i, arr) => x.length > 0 && arr.indexOf(x) === i);

    let rows: CardhedgerCardRow[] = [];
    for (const sq of searchCandidates) {
      try {
        const body = await this.cardhedger.forwardJson('POST', '/v1/cards/card-search', {
          body: { search: sq, page: 1, page_size: 25 },
        });
        const r = this.parseCardRows(body);
        if (r.length > 0) {
          rows = r;
          break;
        }
      } catch {
        // try next candidate
      }
    }
    if (rows.length === 0) return { query, row: null };

    const scored = rows
      .map((r) => ({ r, ...this.scoreCard(r, q) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    if (scored[0]?.verified) {
      return {
        query,
        row: scored[0].r,
        confidence: 'verified',
      };
    }

    // Precision-first fallback:
    // when exact triple is unavailable, still require card-number match + high text similarity.
    const preciseFallback = scored.find((x) => x.numberMatched && x.score >= 150);
    if (preciseFallback) {
      return {
        query,
        row: preciseFallback.r,
        confidence: 'approximate',
      };
    }

    // If exactly one candidate matches card number, accept it as approximate.
    // This handles abbreviated names/sets (e.g. SM promo aliases) without per-card rules.
    const numberOnly = scored.filter((x) => x.numberMatched);
    if (numberOnly.length === 1) {
      return {
        query,
        row: numberOnly[0]!.r,
        confidence: 'approximate',
      };
    }
    return { query, row: null };
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
      const q = this.buildCollectionQuery(col);
      return {
        enabled: false,
        searchQuery: q.query,
        matched: false,
        message: 'Cardhedger is not configured (CARDHEDGER_API_KEY)',
        card: null,
      };
    }

    try {
      const r = await this.resolveCardForCollection(col);
      return this.buildPreviewFromResolved(r);
    } catch (e) {
      return {
        enabled: true,
        searchQuery: this.buildCollectionQuery(col).query,
        matched: false,
        message: e instanceof Error ? e.message : String(e),
        card: null,
      };
    }
  }

  private async buildPreviewFromResolved(r: ResolvedCard): Promise<MarketCollectionPreview> {
    if (!r.row || !r.confidence) {
      return {
        enabled: true,
        searchQuery: r.query,
        matched: false,
        message: 'No matching Cardhedger card found',
        card: null,
      };
    }
    return this.rowToPreview(r.row, r.query, r.confidence);
  }

  async getTierPriceHistoryForCollection(
    col: MarketplaceCollection | null,
    options: {
      tier: string;
      period: MarketHistoryPeriod;
      maxCalendarDays: number;
      maxRequests?: number;
    },
  ): Promise<MarketPriceHistoryResult> {
    const days = Math.min(4000, Math.max(1, Math.floor(options.maxCalendarDays)));
    const tier = 'PSA_10';
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
        searchQuery: this.buildCollectionQuery(col).query,
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

    const resolved = await this.resolveCardForCollection(col);
    return this.buildHistoryFromResolved(resolved, options);
  }

  private async buildHistoryFromResolved(
    resolved: ResolvedCard,
    options: {
      tier: string;
      period: MarketHistoryPeriod;
      maxCalendarDays: number;
      maxRequests?: number;
    },
  ): Promise<MarketPriceHistoryResult> {
    const days = Math.min(4000, Math.max(1, Math.floor(options.maxCalendarDays)));
    const tier = 'PSA_10';

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
    const history = resolvedCardId
      ? await this.fetchTierHistoryByCard(resolvedCardId, tier, days)
      : [];
    if (history.length >= 2) {
      return {
        enabled: true,
        searchQuery: resolved.query,
        matched: true,
        matchConfidence: resolved.confidence,
        days,
        tier,
        period: options.period,
        points: history,
        source: `cardhedger:${tier}:history`,
        upstreamRequests: 2,
      };
    }
    const allPrices = resolvedCardId ? await this.fetchAllPricesByCard(resolvedCardId) : [];
    const mergedRow =
      allPrices.length > 0 ? ({ ...resolved.row, prices: allPrices } as CardhedgerCardRow) : resolved.row;
    const spot = this.readTierSpot(mergedRow, tier);
    if (spot.usd == null) {
      return {
        enabled: true,
        searchQuery: resolved.query,
        matched: true,
        matchConfidence: resolved.confidence,
        message: `No ${tier} spot price from Cardhedger`,
        days,
        tier,
        period: options.period,
        points: [],
        source: `cardhedger:${tier}`,
        upstreamRequests: 1,
      };
    }
    const now = Math.floor(Date.now() / 1000);
    const prev =
      spot.gainPct != null && Number.isFinite(spot.gainPct)
        ? spot.usd / (1 + spot.gainPct / 100)
        : spot.usd;
    return {
      enabled: true,
      searchQuery: resolved.query,
      matched: true,
      matchConfidence: resolved.confidence,
      days,
      tier,
      period: options.period,
      points: [
        { t: now - days * 86400, v: Math.max(0.01, Number(prev.toFixed(4))) },
        { t: now, v: Number(spot.usd.toFixed(4)) },
      ],
      source: `cardhedger:${tier}:synthetic`,
      upstreamRequests: 2,
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
    },
  ): Promise<{ preview: MarketCollectionPreview; history: MarketPriceHistoryResult }> {
    if (!col) {
      const [preview, history] = await Promise.all([
        this.getPreviewForCollection(null),
        this.getTierPriceHistoryForCollection(null, options),
      ]);
      return { preview, history };
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
      const days = Math.min(4000, Math.max(1, Math.floor(options.maxCalendarDays)));
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
      return { preview: notConfigured, history: notConfiguredHist };
    }

    // Resolve once; use result for both preview and history in parallel.
    const resolved = await this.resolveCardForCollection(col);
    const [preview, history] = await Promise.all([
      this.buildPreviewFromResolved(resolved).catch((e) => ({
        enabled: true,
        searchQuery: resolved.query,
        matched: false,
        message: e instanceof Error ? e.message : String(e),
        card: null,
      } satisfies MarketCollectionPreview)),
      this.buildHistoryFromResolved(resolved, options),
    ]);
    return { preview, history };
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

  async getBatchMintPreviewsFromTokenIds(
    tokenIds: number[],
  ): Promise<Record<number, MarketCollectionPreview>> {
    const out: Record<number, MarketCollectionPreview> = {};
    const ids = [...new Set((tokenIds ?? []).map((n) => Math.floor(Number(n))))].filter(
      (n) => Number.isFinite(n) && n >= 0,
    );
    if (ids.length === 0) return out;

    const pack = await this.blockchain.batchRwaMetadata(ids);
    await Promise.all(
      pack.items.map(async (item) => {
        const meta = item.metadata as Record<string, unknown> | null;
        if (!meta) {
          out[item.tokenId] = {
            enabled: this.isConfigured(),
            searchQuery: '',
            matched: false,
            message: 'Metadata unavailable',
            card: null,
          };
          return;
        }
        const graded =
          (meta.properties as Record<string, unknown> | undefined)?.graded ??
          (meta.graded as Record<string, unknown> | undefined);
        const ch = (graded as Record<string, unknown> | undefined)?.cardhedger as
          | Record<string, unknown>
          | undefined;
        const cardId =
          typeof ch?.cardId === 'string' && ch.cardId.trim() ? ch.cardId.trim() : '';
        const card = (graded as Record<string, unknown> | undefined)?.card as
          | Record<string, unknown>
          | undefined;
        const qFromCardhedger =
          typeof ch?.searchQuery === 'string' && ch.searchQuery.trim()
            ? ch.searchQuery.trim()
            : '';
        const query =
          qFromCardhedger ||
          [
            String(card?.name ?? ''),
            String(card?.number ?? ''),
            String(card?.set ?? ''),
          ]
            .join(' ')
            .trim();

        const syntheticCol = {
          collectionKey: `mint_${item.tokenId}`,
          displayLabel: String(meta.name ?? query ?? ''),
          queryUsed: query,
          components: {
            cardName: String(card?.name ?? ''),
            cardSet: String(card?.set ?? ''),
            cardNumber: String(card?.number ?? ''),
            ...(() => {
              const psaObj =
                typeof (graded as Record<string, unknown> | undefined)?.psa === 'object' &&
                (graded as Record<string, unknown> | undefined)?.psa != null
                  ? (((graded as Record<string, unknown>).psa as Record<string, unknown>) ?? null)
                  : null;
              const specRaw = psaObj?.specId;
              const spec =
                typeof specRaw === 'number' && Number.isFinite(specRaw)
                  ? String(Math.floor(specRaw))
                  : typeof specRaw === 'string' && specRaw.trim()
                    ? specRaw.trim()
                    : '';
              return spec ? { psaSpecId: spec } : {};
            })(),
            ...(cardId ? { cardhedgerCardId: cardId } : {}),
          },
          coverImageUrl: null,
          createdAt: new Date(),
        } as MarketplaceCollection;
        out[item.tokenId] = await this.getPreviewForCollection(syntheticCol);
      }),
    );
    return out;
  }

}

