import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlockchainService } from '../blockchain/blockchain.service';
import { CardhedgerService } from '../cardhedger/cardhedger.service';
import type { MarketplaceCollection } from './entities/marketplace-collection.entity';
import {
  normalizeForExactCardNumberKey,
  normalizeForExactCatalogMatch,
  primaryCardNumber,
} from './card-match.util';
import type {
  MarketCollectionPreview,
  MarketPriceHistoryResult,
} from './market-reference.types';
import type { MarketHistoryPeriod } from './price-history-period.util';

type CardhedgerCardRow = Record<string, unknown>;

@Injectable()
export class CardhedgerMarketDataService {
  private readonly psaSpecIdMap = new Map<string, string>();
  private readonly allPricesByCardCache = new Map<string, CardhedgerCardRow[]>();

  constructor(
    private readonly cardhedger: CardhedgerService,
    private readonly blockchain: BlockchainService,
    private readonly config: ConfigService,
  ) {
    this.psaSpecIdMap = this.readPsaSpecIdMapFromEnv();
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

  private isConfigured(): boolean {
    try {
      this.cardhedger.assertConfigured();
      return true;
    } catch {
      return false;
    }
  }

  private buildCollectionQuery(col: MarketplaceCollection | null): {
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

  private scoreCard(
    row: CardhedgerCardRow,
    hints: { cardName: string; cardSet: string; cardNumber: string },
  ): { score: number; verified: boolean; numberMatched: boolean } {
    const sameNumber = (a: string, b: string): boolean => {
      if (!a || !b) return false;
      if (a === b) return true;
      const aTrim = a.replace(/^0+/, '');
      const bTrim = b.replace(/^0+/, '');
      return Boolean(aTrim) && Boolean(bTrim) && aTrim === bTrim;
    };
    const wantName = normalizeForExactCatalogMatch(hints.cardName);
    const wantSet = normalizeForExactCatalogMatch(hints.cardSet);
    const wantNum = normalizeForExactCardNumberKey(
      primaryCardNumber(hints.cardNumber),
    );
    const gotName = normalizeForExactCatalogMatch(
      String(row.description ?? row.name ?? ''),
    );
    const gotSet = normalizeForExactCatalogMatch(String(row.set ?? ''));
    const gotNum = normalizeForExactCardNumberKey(
      primaryCardNumber(String(row.number ?? '')),
    );
    let score = 0;
    if (sameNumber(wantNum, gotNum)) score += 100;
    if (wantSet && gotSet && (gotSet.includes(wantSet) || wantSet.includes(gotSet))) {
      score += 60;
    }
    if (
      wantName &&
      gotName &&
      (gotName.includes(wantName) || wantName.includes(gotName))
    ) {
      score += 50;
    }
    const numberMatched = sameNumber(wantNum, gotNum);
    const verified =
      numberMatched &&
      Boolean(wantSet && gotSet && (gotSet.includes(wantSet) || wantSet.includes(gotSet))) &&
      Boolean(wantName && gotName && (gotName.includes(wantName) || wantName.includes(gotName)));
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

  private readGradePrice(row: CardhedgerCardRow, grade: string): number | null {
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

  private async fetchAllPricesByCard(cardId: string): Promise<CardhedgerCardRow[]> {
    const id = String(cardId ?? '').trim();
    if (!id) return [];
    if (this.allPricesByCardCache.has(id)) {
      return this.allPricesByCardCache.get(id) ?? [];
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
      this.allPricesByCardCache.set(id, out);
      return out;
    } catch {
      this.allPricesByCardCache.set(id, []);
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

  private async fetchTierHistoryByCard(
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

  private pctFromPoints(points: Array<{ t: number; v: number }>): number | null {
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

  private premiumPct(psa10: number | null, raw: number | null): number | null {
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

  private clamp01to100(v: number): number {
    if (!Number.isFinite(v)) return 0;
    return Math.min(100, Math.max(0, v));
  }

  private classifyMarketTone(input: {
    change7dPct: number | null;
    change30dPct: number | null;
    change90dPct: number | null;
  }): 'Bullish' | 'Neutral' | 'Bearish' | 'Consolidation' {
    const c7 = input.change7dPct ?? 0;
    const c30 = input.change30dPct ?? 0;
    const c90 = input.change90dPct ?? 0;
    if (c30 >= 10 && c90 >= 18) return 'Bullish';
    if (c30 <= -8 && c7 <= -3) return 'Bearish';
    if (Math.abs(c30) <= 4 && Math.abs(c90) <= 8) return 'Consolidation';
    return 'Neutral';
  }

  private riskScoreFromLiquidityVolatility(input: {
    sales30d: number | null;
    change30dPct: number | null;
    change90dPct: number | null;
  }): { score: number | null; label: 'Low' | 'Medium' | 'High' | null } {
    const sales30 = input.sales30d;
    const c30 = Math.abs(input.change30dPct ?? 0);
    const c90 = Math.abs(input.change90dPct ?? 0);
    const volatilityScore = this.clamp01to100(c30 * 2.4 + c90 * 1.6);
    const liquidityScore =
      sales30 != null && Number.isFinite(sales30) && sales30 >= 0
        ? this.clamp01to100(Math.log10(sales30 + 1) * 40)
        : 35;
    const risk = this.clamp01to100(volatilityScore * 0.55 + (100 - liquidityScore) * 0.45);
    const score = Math.round(risk);
    const label = score >= 67 ? 'High' : score >= 34 ? 'Medium' : 'Low';
    return { score, label };
  }

  private miniSeriesByTone(
    tone:
      | 'Bullish'
      | 'Neutral'
      | 'Bearish'
      | 'Consolidation'
      | 'Cooling'
      | 'Consolidating'
      | 'Overextended'
      | 'Accumulating'
      | 'Volatile'
      | null,
  ): { miniSeries: number[]; pathRepresentation: string } {
    if (tone === 'Bullish') {
      return {
        miniSeries: [18, 19, 20, 21, 22, 24, 25, 26, 27, 28, 29, 30],
        pathRepresentation:
          'Low -> Accumulation -> Expansion ↑↑ -> Consolidation -> Breakout pressure ↑',
      };
    }
    if (tone === 'Bearish' || tone === 'Cooling') {
      return {
        miniSeries: [31, 30, 29, 28, 27, 26, 25, 25, 24, 23, 22, 21],
        pathRepresentation:
          'Peak -> Distribution -> Breakdown ↓ -> Lower range -> Continued weakness',
      };
    }
    if (tone === 'Consolidation' || tone === 'Consolidating') {
      return {
        miniSeries: [24, 24, 25, 24, 25, 24, 25, 25, 24, 25, 26, 26],
        pathRepresentation:
          'Range -> Compression -> Oscillation -> Range-bound structure',
      };
    }
    if (tone === 'Overextended') {
      return {
        miniSeries: [18, 19, 21, 24, 27, 29, 28, 30, 27, 28, 27, 26],
        pathRepresentation:
          'Low -> Expansion spike ↑↑ -> Volatile retest -> Re-balance zone',
      };
    }
    if (tone === 'Volatile') {
      return {
        miniSeries: [24, 27, 23, 28, 22, 27, 23, 26, 24, 27, 23, 25],
        pathRepresentation:
          'Wide range -> Expansion/Compression swings -> Directional bias pending',
      };
    }
    return {
      miniSeries: [22, 22, 23, 23, 24, 24, 24, 25, 25, 25, 26, 26],
      pathRepresentation:
        'Base -> Gradual expansion -> Mild consolidation -> Upward bias',
    };
  }

  private toneLabelForUi(input: {
    marketTone: 'Bullish' | 'Neutral' | 'Bearish' | 'Consolidation' | null;
    riskLabel: 'Low' | 'Medium' | 'High' | null;
  }): 'Bullish' | 'Cooling' | 'Consolidating' | 'Overextended' | 'Accumulating' | 'Volatile' {
    if (input.riskLabel === 'High' && input.marketTone === 'Bullish') return 'Overextended';
    if (input.riskLabel === 'High') return 'Volatile';
    if (input.marketTone === 'Bullish') return 'Bullish';
    if (input.marketTone === 'Bearish') return 'Cooling';
    if (input.marketTone === 'Consolidation') return 'Consolidating';
    return 'Accumulating';
  }

  private async rowToPreview(
    row: CardhedgerCardRow,
    query: string,
    confidence: 'verified' | 'approximate',
  ): Promise<MarketCollectionPreview> {
    const cardId = String(row.card_id ?? '').trim();
    const allPrices = cardId ? await this.fetchAllPricesByCard(cardId) : [];
    const merged = allPrices.length > 0 ? { ...row, prices: allPrices } : row;
    const psa10 = this.readGradePrice(merged, 'PSA 10');
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
          typeof merged['30 Day Sales'] === 'number' ? Number(merged['30 Day Sales']) : null,
        hasGraded: psa10 != null,
        gradedTiersAvailable: [psa10 != null ? 'PSA_10' : null].filter(
          (x): x is string => Boolean(x),
        ),
        pricesByGrade,
        sales7d:
          typeof merged['7 Day Sales'] === 'number' ? Number(merged['7 Day Sales']) : null,
        sales30d:
          typeof merged['30 Day Sales'] === 'number' ? Number(merged['30 Day Sales']) : null,
        gainPct7d: typeof merged.gain === 'number' ? Number(merged.gain) : null,
        gainPct30d:
          typeof merged.gain_30day === 'number' ? Number(merged.gain_30day) : null,
        ebayNearMint: null,
        tcgplayerNearMint: null,
        ebayPsa10: mkBand(psa10),
        ebayPsa9: null,
      },
    };
  }

  private async resolveCardForCollection(
    col: MarketplaceCollection | null,
  ): Promise<{
    query: string;
    row: CardhedgerCardRow | null;
    confidence?: 'verified' | 'approximate';
  }> {
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
          if (strict.verified) {
            return { query, row: rows[0], confidence: 'verified' };
          }
          // card_id direct hit: tolerate name/set wording drift, keep number guard.
          if (strict.numberMatched) {
            return { query, row: rows[0], confidence: 'approximate' };
          }
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
    for (const item of pack.items) {
      const meta = item.metadata as Record<string, unknown> | null;
      if (!meta) {
        out[item.tokenId] = {
          enabled: this.isConfigured(),
          searchQuery: '',
          matched: false,
          message: 'Metadata unavailable',
          card: null,
        };
        continue;
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
    }
    return out;
  }

  async getAiInsightForCollection(
    col: MarketplaceCollection | null,
  ): Promise<{
    title: string;
    summary: string;
    bullets: string[];
    dynamics?: string[];
    syntheticChart?: string;
    chartSpec?: {
      chartStyle: string;
      trendStructure: string[];
      momentumBehavior: string;
      visualInterpretation: string;
      miniSeries: number[];
      pathRepresentation: string;
    };
    outlook?: string;
    outlookScenarios?: {
      bullCase: string;
      baseCase: string;
      bearCase: string;
    };
    uiInstructions?: {
      loading: {
        style: string;
        scanningEffect: string;
        minDurationMs: number;
        maxDurationMs: number;
      };
      progressiveRenderOrder: string[];
    };
    generatedAt: string;
    confidence?: number | null;
    cardId?: string | null;
    marketTone?: 'Bullish' | 'Cooling' | 'Consolidating' | 'Overextended' | 'Accumulating' | 'Volatile' | null;
    riskScore?: number | null;
    riskLabel?: 'Low' | 'Medium' | 'High' | null;
    stats?: {
      psa10SpotUsd: number | null;
      rawSpotUsd: number | null;
      premiumVsRawPct: number | null;
      sales7d: number | null;
      sales30d: number | null;
      change7dPct: number | null;
      change30dPct: number | null;
      change90dPct: number | null;
      change365dPct: number | null;
      points90d: number;
      points365d: number;
    };
  }> {
    const now = new Date().toISOString();
    if (!col) {
      return {
        title: 'Collection AI Insight',
        summary:
          'The market profile is still in early-stage price formation, with directional cues emerging as liquidity builds.',
        bullets: [
          'Structure is forming from the first active pricing regime.',
          'Momentum signals should be read through liquidity depth.',
          'Premium behavior will sharpen as more two-sided flow develops.',
        ],
        dynamics: [],
        syntheticChart: 'early base-building with shallow swings and gradual range definition',
        outlook: 'A clearer directional trend should emerge as demand and price discovery broaden.',
        chartSpec: {
          chartStyle: 'Expanded Macro View (Wide X-Axis)',
          trendStructure: [
            'Phase 1: Accumulation / base formation',
            'Phase 2: Early expansion attempt',
            'Phase 3: Controlled consolidation pocket',
            'Phase 4: Current positioning in price discovery',
          ],
          momentumBehavior: 'Momentum is compressing, then re-expanding in short bursts.',
          visualInterpretation:
            'Price action appears as a broad base with gentle upward bias and intermittent consolidation shelves.',
          miniSeries: [20, 20, 21, 21, 22, 22, 22, 23, 23, 24, 24, 25],
          pathRepresentation:
            'Base -> Early accumulation -> Controlled expansion -> Constructive positioning',
        },
        outlookScenarios: {
          bullCase:
            'Continuation strengthens as demand absorption persists through higher consolidation levels.',
          baseCase:
            'Market remains in a constructive consolidation channel while liquidity gradually deepens.',
          bearCase:
            'A short pullback unfolds if expansion attempts fail to hold above recent support zones.',
        },
        uiInstructions: {
          loading: {
            style: 'premium-gradient-shimmer',
            scanningEffect: 'crypto-data-scan',
            minDurationMs: 800,
            maxDurationMs: 1500,
          },
          progressiveRenderOrder: [
            'AI Insight',
            'Market Structure',
            'Key Signals',
            'Synthetic Trend Chart',
            'Forward Outlook',
            'Market Tone',
          ],
        },
        generatedAt: now,
        confidence: null,
        cardId: null,
      };
    }
    if (!this.isConfigured()) {
      return {
        title: `${col.displayLabel} — AI Market Brief`,
        summary:
          'The card is trading in a developing intelligence regime where trend context is building from live market flow.',
        bullets: [
          'Momentum is driven by active price discovery.',
          'Premium structure reflects quality demand as trading depth expands.',
          'Liquidity evolution is the key confirmation variable.',
        ],
        dynamics: [],
        syntheticChart: 'forming trend channel with intermittent consolidation pockets',
        outlook: 'Continuation probability rises as liquidity sustains through the next consolidation band.',
        chartSpec: {
          chartStyle: 'Expanded Macro View (Wide X-Axis)',
          trendStructure: [
            'Phase 1: Base development',
            'Phase 2: Expansion leg',
            'Phase 3: Cooling consolidation',
            'Phase 4: Re-acceleration watch zone',
          ],
          momentumBehavior: 'Momentum is expanding off a consolidation floor.',
          visualInterpretation:
            'Chart likely prints a stair-step climb with pauses that resolve into higher zones.',
          miniSeries: [19, 20, 20, 21, 22, 23, 23, 24, 25, 25, 26, 27],
          pathRepresentation:
            'Accumulation -> Expansion ↑ -> Consolidation shelf -> Continuation bias',
        },
        outlookScenarios: {
          bullCase: 'Breakout pressure converts into continuation once consolidation supply is absorbed.',
          baseCase: 'Sideways consolidation persists before the next directional leg.',
          bearCase: 'Momentum fades into a temporary retracement if demand rotation weakens.',
        },
        uiInstructions: {
          loading: {
            style: 'premium-gradient-shimmer',
            scanningEffect: 'crypto-data-scan',
            minDurationMs: 800,
            maxDurationMs: 1500,
          },
          progressiveRenderOrder: [
            'AI Insight',
            'Market Structure',
            'Key Signals',
            'Synthetic Trend Chart',
            'Forward Outlook',
            'Market Tone',
          ],
        },
        generatedAt: now,
        confidence: null,
        cardId: null,
      };
    }

    const q = this.buildCollectionQuery(col);
    const query =
      q.cardhedgerSearchQuery || q.query || String(col.displayLabel ?? '').trim();
    if (!query) {
      return {
        title: `${col.displayLabel} — AI Market Brief`,
        summary:
          'Current action reflects a narrow price-discovery window where structure is beginning to organize.',
        bullets: [
          'Market behavior is transitionary, not random.',
          'Demand quality matters more than headline prints in this phase.',
          'Trend confirmation should come from sustained follow-through.',
        ],
        dynamics: [],
        syntheticChart: 'compressed range with emerging directional bias',
        outlook: 'The setup favors a cleaner directional move once consolidation pressure resolves.',
        chartSpec: {
          chartStyle: 'Expanded Macro View (Wide X-Axis)',
          trendStructure: [
            'Phase 1: Accumulation base',
            'Phase 2: Initial expansion probe',
            'Phase 3: Range consolidation',
            'Phase 4: Directional decision zone',
          ],
          momentumBehavior: 'Momentum is compressing and preparing for directional release.',
          visualInterpretation:
            'Visual profile resembles a rounded base with tightening swings near resistance.',
          miniSeries: [21, 21, 22, 22, 22, 23, 22, 23, 23, 24, 24, 24],
          pathRepresentation:
            'Range base -> Compression -> Directional pressure build -> Pending expansion',
        },
        outlookScenarios: {
          bullCase: 'Breakout pressure resolves upward with steady demand follow-through.',
          baseCase: 'Price oscillates in consolidation while accumulation continues.',
          bearCase: 'A failed breakout rotates into a controlled pullback before re-basing.',
        },
        uiInstructions: {
          loading: {
            style: 'premium-gradient-shimmer',
            scanningEffect: 'crypto-data-scan',
            minDurationMs: 800,
            maxDurationMs: 1500,
          },
          progressiveRenderOrder: [
            'AI Insight',
            'Market Structure',
            'Key Signals',
            'Synthetic Trend Chart',
            'Forward Outlook',
            'Market Tone',
          ],
        },
        generatedAt: now,
        confidence: null,
        cardId: null,
      };
    }

    try {
      const body = await this.cardhedger.forwardJson('POST', '/v1/cards/card-match', {
        body: { query },
      });
      const match =
        typeof body === 'object' && body != null
          ? ((body as { match?: unknown }).match as Record<string, unknown> | undefined)
          : undefined;
      if (!match) {
        return {
          title: `${col.displayLabel} — AI Market Brief`,
          summary:
            'Price behavior is still interpretable as an early market cycle with momentum developing around a thin liquidity window.',
          bullets: [
            'Directional pressure is building despite uneven flow.',
            'Premium behavior suggests quality-focused demand is the key driver.',
            'Continuation depends on whether liquidity keeps expanding after pullbacks.',
          ],
          dynamics: [],
          syntheticChart: 'rounded consolidation with periodic expansion spikes',
          outlook: 'The path of least resistance remains constructive if demand absorption continues.',
          chartSpec: {
            chartStyle: 'Expanded Macro View (Wide X-Axis)',
            trendStructure: [
              'Phase 1: Base build',
              'Phase 2: Expansion pulse',
              'Phase 3: Cooling band',
              'Phase 4: Re-accumulation bias',
            ],
            momentumBehavior: 'Momentum rotates between expansion and compression cycles.',
            visualInterpretation:
              'Chart forms a broad staircase with temporary consolidation clusters between legs.',
            miniSeries: [20, 21, 22, 23, 24, 23, 24, 25, 24, 25, 26, 27],
            pathRepresentation:
              'Accumulation -> Expansion ↑ -> Consolidation -> Re-expansion bias',
          },
          outlookScenarios: {
            bullCase: 'Fresh expansion emerges as demand continues to absorb pullbacks.',
            baseCase: 'Consolidation extends with gradual upward drift.',
            bearCase: 'Cooling pressure triggers a deeper reset before trend recovery.',
          },
          uiInstructions: {
            loading: {
              style: 'premium-gradient-shimmer',
              scanningEffect: 'crypto-data-scan',
              minDurationMs: 800,
              maxDurationMs: 1500,
            },
            progressiveRenderOrder: [
              'AI Insight',
              'Market Structure',
              'Key Signals',
              'Synthetic Trend Chart',
              'Forward Outlook',
              'Market Tone',
            ],
          },
          generatedAt: now,
          confidence: null,
          cardId: null,
        };
      }
      const confidenceRaw = match.confidence;
      const confidence =
        typeof confidenceRaw === 'number' && Number.isFinite(confidenceRaw)
          ? confidenceRaw
          : null;
      const cardId =
        typeof match.card_id === 'string' && match.card_id.trim()
          ? match.card_id.trim()
          : null;
      const desc =
        typeof match.description === 'string' && match.description.trim()
          ? match.description.trim()
          : col.displayLabel;
      const reasoning =
        typeof match.reasoning === 'string' && match.reasoning.trim()
          ? match.reasoning.trim()
          : 'Matched by Cardhedger AI based on the provided collection query.';
      let summary = reasoning;
      const prices = Array.isArray(match.prices)
        ? (match.prices as Array<Record<string, unknown>>)
        : [];
      const psa10 = prices.find((p) => String(p.grade ?? '').toUpperCase() === 'PSA 10');
      const raw = prices.find((p) => String(p.grade ?? '').toUpperCase() === 'RAW');

      const bullets = [
        `Matched card: ${desc}`,
        confidence != null
          ? `AI confidence: ${(confidence * 100).toFixed(1)}%`
          : 'AI confidence is moderate because matching context is partial.',
        typeof psa10?.price === 'string' || typeof psa10?.price === 'number'
          ? `PSA 10 spot: $${String(psa10.price)}`
          : 'PSA 10 spot is not yet fully populated in the current feed.',
        typeof raw?.price === 'string' || typeof raw?.price === 'number'
          ? `Raw spot: $${String(raw.price)}`
          : 'Raw spot is limited, so premium interpretation is provisional.',
      ];

      let stats:
        | {
            psa10SpotUsd: number | null;
            rawSpotUsd: number | null;
            premiumVsRawPct: number | null;
            sales7d: number | null;
            sales30d: number | null;
            change7dPct: number | null;
            change30dPct: number | null;
            change90dPct: number | null;
            change365dPct: number | null;
            points90d: number;
            points365d: number;
          }
        | undefined;
      let marketTone: 'Bullish' | 'Cooling' | 'Consolidating' | 'Overextended' | 'Accumulating' | 'Volatile' | null = null;
      let riskScore: number | null = null;
      let riskLabel: 'Low' | 'Medium' | 'High' | null = null;
      let dynamics: string[] = [];
      let syntheticChart: string | undefined;
      let outlook: string | undefined;
      if (cardId) {
        try {
          const allPrices = await this.fetchAllPricesByCard(cardId);
          const merged =
            allPrices.length > 0
              ? ({ ...(match as Record<string, unknown>), prices: allPrices } as CardhedgerCardRow)
              : (match as CardhedgerCardRow);
          const psa10Spot = this.readGradePrice(merged, 'PSA 10');
          const rawSpot = this.readGradePrice(merged, 'Raw');
          const h90 = await this.fetchTierHistoryByCard(cardId, 'PSA_10', 90);
          const h365 = await this.fetchTierHistoryByCard(cardId, 'PSA_10', 365);
          const change90 = this.pctFromPoints(h90);
          const change365 = this.pctFromPoints(h365);
          const change7 =
            typeof merged.gain === 'number' && Number.isFinite(merged.gain)
              ? Number(merged.gain)
              : null;
          const change30 =
            typeof merged.gain_30day === 'number' && Number.isFinite(merged.gain_30day)
              ? Number(merged.gain_30day)
              : null;
          const sales30 =
            typeof merged['30 Day Sales'] === 'number' ? Number(merged['30 Day Sales']) : null;
          stats = {
            psa10SpotUsd: psa10Spot,
            rawSpotUsd: rawSpot,
            premiumVsRawPct: this.premiumPct(psa10Spot, rawSpot),
            sales7d:
              typeof merged['7 Day Sales'] === 'number'
                ? Number(merged['7 Day Sales'])
                : null,
            sales30d: sales30,
            change7dPct: change7,
            change30dPct: change30,
            change90dPct: change90,
            change365dPct: change365,
            points90d: h90.length,
            points365d: h365.length,
          };
          const structuralTone = this.classifyMarketTone({
            change7dPct: stats.change7dPct,
            change30dPct: stats.change30dPct,
            change90dPct: stats.change90dPct,
          });
          const risk = this.riskScoreFromLiquidityVolatility({
            sales30d: stats.sales30d,
            change30dPct: stats.change30dPct,
            change90dPct: stats.change90dPct,
          });
          riskScore = risk.score;
          riskLabel = risk.label;
          marketTone = this.toneLabelForUi({
            marketTone: structuralTone,
            riskLabel,
          });
          const shortTerm =
            stats.change7dPct != null
              ? stats.change7dPct >= 6
                ? 'strong upside momentum'
                : stats.change7dPct <= -4
                  ? 'clear short-term cooling'
                  : 'range-bound short-term action'
              : 'limited short-term visibility';
          const longTerm =
            stats.change90dPct != null
              ? stats.change90dPct >= 15
                ? 'a constructive medium-term uptrend'
                : stats.change90dPct <= -10
                  ? 'a pressured medium-term structure'
                  : 'a consolidation-oriented medium-term structure'
              : 'an incomplete medium-term structure';
          const premiumContext =
            stats.premiumVsRawPct != null
              ? stats.premiumVsRawPct >= 80
                ? 'an elevated graded premium, pointing to quality-focused collector demand'
                : stats.premiumVsRawPct >= 25
                  ? 'a healthy graded premium that supports steady collector bid'
                  : 'a compressed graded premium, suggesting less urgency to pay up for grade'
              : 'a premium curve that is still forming';
          const liquidityContext =
            stats.sales30d != null
              ? stats.sales30d >= 50
                ? 'Liquidity is deep enough to validate trend continuation if demand persists.'
                : stats.sales30d >= 20
                  ? 'Liquidity is adequate, but follow-through still depends on sustained demand.'
                  : 'Liquidity is thin, which raises the probability of sharp air pockets and failed breakouts.'
              : 'Recent liquidity is fragmented, so trend reliability is lower.';
          const riskContext =
            riskScore != null
              ? riskScore >= 67
                ? 'The market is in a higher-risk regime with elevated pullback sensitivity.'
                : riskScore >= 34
                  ? 'Risk is balanced: momentum is tradable, but not yet low-volatility.'
                  : 'Risk is contained, which favors orderly continuation over disorderly swings.'
              : 'Risk regime is unresolved.';
          summary = [
            `Market is in a ${marketTone === 'Bullish' ? 'constructive expansion phase' : marketTone === 'Cooling' ? 'cooling phase after expansion' : marketTone === 'Consolidating' ? 'consolidation phase with structure intact' : marketTone === 'Overextended' ? 'high-beta expansion phase with stretched momentum' : marketTone === 'Volatile' ? 'high-volatility transition phase' : 'gradual accumulation phase'} with directional bias still leaning ${marketTone === 'Cooling' ? 'neutral-to-down' : 'neutral-to-up'}.`,
            `Current action reflects ${shortTerm} while preserving ${longTerm}, which points to structured rotation rather than random price drift.`,
            `At the same time, PSA 10 pricing versus raw points to ${premiumContext}, giving a clearer read on how committed higher-conviction buyers are.`,
            `${liquidityContext} ${riskContext} This keeps the near-term path biased toward controlled continuation or orderly consolidation unless demand absorption weakens.`,
          ].join(' ');
          dynamics = [
            `Short-term structure remains ${shortTerm}, with activity rotating between expansion bursts and consolidation resets.`,
            `Long-term structure points to ${longTerm}, so the broader move still looks like a trend process rather than isolated price spikes.`,
            `Momentum state is ${marketTone === 'Bullish' || marketTone === 'Overextended' ? 'expanding with intermittent compression' : marketTone === 'Cooling' ? 'slowing after an earlier expansion' : marketTone === 'Consolidating' ? 'compressing inside a consolidation zone' : 'transitioning between expansion and consolidation'}.`,
            stats.premiumVsRawPct != null
              ? `PSA 10 vs Raw sits at a visible premium, implying ${stats.premiumVsRawPct >= 50 ? 'strong willingness to pay for quality and scarcity.' : 'more selective demand with tighter pricing discipline on grading uplift.'}`
              : 'PSA 10 versus Raw spread is still incomplete, so premium conviction should be treated as early-stage.',
          ];
          bullets.splice(0, bullets.length);
          bullets.push('Momentum remains trend-supportive with periodic cooling rather than structural failure.');
          bullets.push(
            stats.sales30d != null
              ? `Liquidity is ${stats.sales30d >= 50 ? 'strong' : stats.sales30d >= 20 ? 'workable' : 'thin'}, shaping how durable the current move can be.`
              : 'Recent activity is limited, so liquidity support behind the move is less certain.',
          );
          bullets.push(
            stats.premiumVsRawPct != null
              ? `The graded premium is ${stats.premiumVsRawPct >= 50 ? 'elevated' : 'moderate'}, signaling ${stats.premiumVsRawPct >= 50 ? 'quality-first demand' : 'more price-sensitive demand'}.`
              : 'Premium structure is still forming because raw-side reference is sparse.',
          );
          bullets.push(
            riskScore != null && riskLabel != null
              ? `Risk profile is ${riskLabel.toLowerCase()}, with pullback sensitivity currently ${riskLabel === 'High' ? 'elevated.' : riskLabel === 'Medium' ? 'manageable but active.' : 'relatively contained.'}`
              : 'Risk profile is still evolving as liquidity and momentum settle.',
          );
          syntheticChart =
            marketTone === 'Bullish'
              ? 'gradual upward continuation with intermittent consolidation zones'
              : marketTone === 'Cooling'
                ? 'cooling downtrend with reactive rebounds into lower-volatility bands'
                : marketTone === 'Consolidating'
                  ? 'rounded consolidation after prior expansion, with breakout pressure building'
                  : marketTone === 'Overextended'
                    ? 'steep expansion followed by choppy pullback-retest behavior'
                    : marketTone === 'Volatile'
                      ? 'wide oscillation channel with momentum expansion/compression swings'
                  : 'stair-step advance with alternating compression and expansion pockets';
          outlook =
            marketTone === 'Bullish'
              ? 'Bullish continuation is favored if demand stays firm and liquidity remains supportive.'
              : marketTone === 'Cooling'
                ? 'Further downside or choppy cooling is likely unless demand re-accelerates and premium support rebuilds.'
                : marketTone === 'Consolidating'
                  ? 'A consolidation phase is the base case, with breakout odds improving only if momentum re-expands.'
                  : 'A neutral-to-constructive path is likely, but confirmation still depends on stronger momentum follow-through.';
          const mini = this.miniSeriesByTone(marketTone);
          return {
            title: `${col.displayLabel} — AI Market Brief`,
            summary,
            bullets,
            dynamics,
            syntheticChart,
            chartSpec: {
              chartStyle: 'Expanded Macro View (Wide X-Axis)',
              trendStructure: [
                'Phase 1: Accumulation / base formation',
                'Phase 2: Expansion / breakout move',
                'Phase 3: Consolidation / cooling zone',
                'Phase 4: Current positioning',
              ],
              momentumBehavior:
                marketTone === 'Bullish'
                  ? 'Momentum is expanding with brief compression between continuation legs.'
                  : marketTone === 'Cooling'
                    ? 'Momentum is contracting, with rebounds absorbed into lower-volatility bands.'
                    : marketTone === 'Consolidating'
                      ? 'Momentum is compressing inside consolidation, with breakout pressure gradually building.'
                      : marketTone === 'Overextended'
                        ? 'Momentum remains elevated but increasingly unstable, with stronger pullback sensitivity.'
                        : marketTone === 'Volatile'
                          ? 'Momentum alternates between sharp expansion and fast compression inside a wide channel.'
                      : 'Momentum alternates between expansion bursts and stabilization pockets.',
              visualInterpretation:
                marketTone === 'Bullish'
                  ? 'Price action forms a wide staircase structure with intermittent consolidation zones, indicating controlled expansion.'
                  : marketTone === 'Cooling'
                    ? 'Structure leans into cooling drift with reactive rebounds that fail to establish sustained expansion.'
                    : marketTone === 'Consolidating'
                      ? 'A rounded consolidation band is visible after expansion, with directional energy coiling near the upper range.'
                      : marketTone === 'Overextended'
                        ? 'A steep breakout leg appears followed by volatile retests, resembling an overextended channel seeking re-balance.'
                        : marketTone === 'Volatile'
                          ? 'Chart resembles a broad oscillation channel with frequent regime shifts between expansion and compression.'
                      : 'A broad trend channel is forming with alternating compression and expansion regimes.',
              miniSeries: mini.miniSeries,
              pathRepresentation: mini.pathRepresentation,
            },
            outlook,
            outlookScenarios: {
              bullCase:
                'If liquidity stays firm and pullbacks continue to be absorbed near consolidation support, breakout pressure can convert into upward continuation.',
              baseCase:
                'If momentum keeps compressing without structural breakdown, price is likely to remain range-bound in consolidation before the next directional move.',
              bearCase:
                'If demand weakens and premium support compresses through key support shelves, a cooling pullback can extend into a deeper correction phase.',
            },
            uiInstructions: {
              loading: {
                style: 'premium-gradient-shimmer',
                scanningEffect: 'crypto-data-scan',
                minDurationMs: 800,
                maxDurationMs: 1500,
              },
              progressiveRenderOrder: [
                'AI Insight',
                'Market Structure',
                'Key Signals',
                'Synthetic Trend Chart',
                'Forward Outlook',
                'Market Tone',
              ],
            },
            generatedAt: now,
            confidence,
            cardId,
            marketTone,
            riskScore,
            riskLabel,
            stats,
          };
        } catch {
          // Keep AI result available even when metric enrichment fails.
        }
      }

      return {
        title: `${col.displayLabel} — AI Market Brief`,
        summary: reasoning,
        bullets,
        dynamics,
        syntheticChart: 'early-stage trend channel with low-frequency expansion pulses',
        outlook:
          'The setup favors progressive continuation as demand absorption and liquidity depth keep broadening.',
        chartSpec: {
          chartStyle: 'Expanded Macro View (Wide X-Axis)',
          trendStructure: [
            'Phase 1: Early accumulation',
            'Phase 2: Initial expansion',
            'Phase 3: Cooling consolidation',
            'Phase 4: Positioning for next leg',
          ],
          momentumBehavior: 'Momentum is stabilizing with expansion attempts.',
          visualInterpretation:
            'Chart profile suggests a shallow upward channel with occasional consolidation shelves.',
          miniSeries: [20, 20, 21, 21, 22, 22, 23, 23, 24, 24, 25, 25],
          pathRepresentation:
            'Base -> Expansion probes -> Consolidation shelf -> Constructive drift',
        },
        outlookScenarios: {
          bullCase: 'Continuation accelerates if liquidity and demand remain aligned.',
          baseCase: 'Consolidation dominates while structure matures.',
          bearCase: 'A cooling pullback unfolds before the next accumulation phase.',
        },
        uiInstructions: {
          loading: {
            style: 'premium-gradient-shimmer',
            scanningEffect: 'crypto-data-scan',
            minDurationMs: 800,
            maxDurationMs: 1500,
          },
          progressiveRenderOrder: [
            'AI Insight',
            'Market Structure',
            'Key Signals',
            'Synthetic Trend Chart',
            'Forward Outlook',
            'Market Tone',
          ],
        },
        generatedAt: now,
        confidence,
        cardId,
        marketTone,
        riskScore,
        riskLabel,
        stats,
      };
    } catch (e) {
      return {
        title: `${col.displayLabel} — AI Market Brief`,
        summary: 'Cardhedger AI insight request failed.',
        bullets: [e instanceof Error ? e.message : String(e), `Query used: ${query}`],
        dynamics: [],
        syntheticChart: 'active consolidation with directional bias waiting for the next expansion leg',
        outlook: 'Continuation remains favored once momentum re-expands through the current consolidation zone.',
        chartSpec: {
          chartStyle: 'Expanded Macro View (Wide X-Axis)',
          trendStructure: [
            'Phase 1: Consolidation floor',
            'Phase 2: Probe expansion',
            'Phase 3: Cooling band',
            'Phase 4: Bias retention',
          ],
          momentumBehavior: 'Momentum is compressing with directional bias intact.',
          visualInterpretation:
            'Price appears to coil in a broad consolidation arc ahead of the next expansion attempt.',
          miniSeries: [22, 22, 23, 22, 23, 23, 22, 23, 24, 23, 24, 25],
          pathRepresentation:
            'Compression -> Oscillation -> Breakout pressure build -> Expansion setup',
        },
        outlookScenarios: {
          bullCase: 'Expansion resumes once consolidation overhead is absorbed.',
          baseCase: 'Market continues to consolidate in a controlled band.',
          bearCase: 'Cooling extends into a deeper but structured pullback.',
        },
        uiInstructions: {
          loading: {
            style: 'premium-gradient-shimmer',
            scanningEffect: 'crypto-data-scan',
            minDurationMs: 800,
            maxDurationMs: 1500,
          },
          progressiveRenderOrder: [
            'AI Insight',
            'Market Structure',
            'Key Signals',
            'Synthetic Trend Chart',
            'Forward Outlook',
            'Market Tone',
          ],
        },
        generatedAt: now,
        confidence: null,
        cardId: null,
      };
    }
  }
}

