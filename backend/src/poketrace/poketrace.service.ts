import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MarketplaceCollection } from '../marketplace/entities/marketplace-collection.entity';
import {
  buildPoketraceQueryFromRwaMetadata,
  mintPreviewDedupeKey,
  normalizePsaCardNameForPoketrace,
  primaryCardNumberForPoketrace,
} from './poketrace-mint-query.util';
import {
  parsePokeTraceHistoryBody,
  trimHistoryToWindow,
  type HistoryPoint,
} from './poketrace-history.util';
import {
  buildMockPoketraceNmHistory,
  buildMockPoketracePreview,
} from './poketrace.mock';

const POKETRACE_BASE = 'https://api.poketrace.com/v1';

type UnknownRecord = Record<string, unknown>;

function isRecord(x: unknown): x is UnknownRecord {
  return typeof x === 'object' && x !== null;
}

/** PokeTrace returns this string on soft rate limits; HTTP may be 429 or 200 with error payload */
function isPokeTraceRateLimitMessage(msg: string, httpStatus?: number): boolean {
  if (httpStatus === 429) return true;
  return /too\s+many\s+requests|slow\s+down|rate\s*limit/i.test(msg);
}

function truncateSearchQuery(s: string, maxLen: number): string {
  const t = s.trim().replace(/\s+/g, ' ');
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen).trim();
}

/** PokeTrace full-text search: `&` and long regional tokens often yield zero hits vs TCGPlayer-style names */
function finalizePoketraceSearchString(s: string, maxLen: number): string {
  const t = s
    .replace(/\s*&\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return truncateSearchQuery(t, maxLen);
}

/**
 * JustTCG `queryUsed` (mint) usually includes set + card # — prefer it for PokeTrace search.
 * If `queryUsed` is short/generic (e.g. "Pikachu" only) but DB has a rich `cardSet`, append set
 * so search does not return unrelated sets (POP Series vs SV Promo).
 */
export function buildPoketraceSearchQuery(col: MarketplaceCollection): string {
  const qu = col.queryUsed?.trim();
  const c = col.components as UnknownRecord;
  const name = String(c.cardName ?? '').trim();
  const set = String(c.cardSet ?? '').trim();
  const num = String(c.cardNumber ?? '').trim();

  if (qu) {
    const ql = qu.toLowerCase();
    const sl = set.toLowerCase().replace(/\s+/g, ' ');
    if (sl.length > 4) {
      const setTokens = sl.split(/\s+/).filter((t) => t.length > 2);
      const missing = setTokens.some((t) => !ql.includes(t));
      if (missing) {
        return finalizePoketraceSearchString(`${qu} ${set}`, 120);
      }
    }
    return finalizePoketraceSearchString(qu, 120);
  }

  const parts: string[] = [];
  if (name) parts.push(name);
  if (num) parts.push(num);
  if (set) parts.push(set);
  if (parts.length > 0) return finalizePoketraceSearchString(parts.join(' '), 96);
  return finalizePoketraceSearchString(col.displayLabel.trim(), 80);
}

/**
 * Primary JustTCG-style query often misses on PokeTrace (JP-only wording, "Japanese", etc.).
 * Try progressively simpler strings; first hit wins in {@link resolveMatchedCardRow}.
 */
export function buildPoketraceSearchQueryAttempts(
  col: MarketplaceCollection,
): string[] {
  const primary = buildPoketraceSearchQuery(col);
  const c = col.components as UnknownRecord;
  const rawName = String(c.cardName ?? '').trim();
  const nameNorm = normalizePsaCardNameForPoketrace(rawName).trim();
  const set = String(c.cardSet ?? '').trim();
  const numRaw = String(c.cardNumber ?? '').trim().replace(/^#/, '');
  const wantPrimary = primaryCardNumberForPoketrace(numRaw);

  const fallbacks: string[] = [];

  if (nameNorm && wantPrimary) {
    fallbacks.push(finalizePoketraceSearchString(`${nameNorm} ${wantPrimary}`, 120));
  }
  if (nameNorm && numRaw) {
    fallbacks.push(finalizePoketraceSearchString(`${nameNorm} ${numRaw}`, 120));
  }
  if (nameNorm) {
    fallbacks.push(finalizePoketraceSearchString(nameNorm, 120));
  }

  const setLighter = finalizePoketraceSearchString(
    set.replace(/\bjapanese\b/gi, ' ').replace(/\bpokemon\b/gi, ' '),
    120,
  );
  if (nameNorm && setLighter && wantPrimary) {
    fallbacks.push(
      finalizePoketraceSearchString(`${nameNorm} ${wantPrimary} ${setLighter}`, 120),
    );
  }

  const denoised = finalizePoketraceSearchString(
    primary.replace(/\bjapanese\b/gi, ' ').replace(/\bpokemon\b/gi, ' '),
    120,
  );
  if (denoised && denoised.toLowerCase() !== primary.toLowerCase()) {
    fallbacks.push(denoised);
  }

  /**
   * JP slab text is often long; PokeTrace search matches English card titles for many JP promos
   * (e.g. Sword & Shield VMAX Climax FA Pikachu VMAX #046 / s8b).
   */
  if (
    nameNorm &&
    wantPrimary &&
    /\bpikachu\b/i.test(nameNorm) &&
    /\bvmax\b/i.test(nameNorm)
  ) {
    fallbacks.push(
      finalizePoketraceSearchString(`Pikachu VMAX ${wantPrimary}`, 120),
    );
    if (/\bvmax\s*climax\b/i.test(set)) {
      fallbacks.push(
        finalizePoketraceSearchString(`s8b Pikachu VMAX ${wantPrimary}`, 120),
      );
    }
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of [primary, ...fallbacks]) {
    const t = q.trim();
    if (!t || t.toLowerCase() === 'pokemon') continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out.length > 0
    ? out
    : [finalizePoketraceSearchString(col.displayLabel.trim(), 80)];
}

function scoreSearchHit(
  row: UnknownRecord,
  wantName: string,
  wantNum: string,
): number {
  const apiNameRaw = String(row.name ?? '');
  const name = apiNameRaw.toLowerCase();
  const num = String(row.cardNumber ?? '').toLowerCase();
  const wantN = normalizePsaCardNameForPoketrace(wantName).toLowerCase();
  const apiN = normalizePsaCardNameForPoketrace(apiNameRaw).toLowerCase();
  let s = 0;
  if (wantN && (name.includes(wantN) || wantN.includes(apiN) || apiN.includes(wantN)))
    s += 10;
  const wantPrimary = primaryCardNumberForPoketrace(
    wantNum.replace(/^#/, '').trim(),
  ).toLowerCase();
  const wantFull = wantNum.replace(/^#/, '').trim().toLowerCase();
  if (
    wantPrimary &&
    (num.includes(wantPrimary) || wantPrimary.includes(num.replace(/^#/, '')))
  )
    s += 8;
  else if (wantFull && num.includes(wantFull)) s += 8;
  if (num.includes('001') && wantNum.includes('001')) s += 5;
  return s;
}

/** Prefer catalog rows whose set name/slug aligns with mint `cardSet` (different Pikachu print). */
function scoreSetAlignment(row: UnknownRecord, wantSet: string): number {
  const w = wantSet.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!w) return 0;
  const set = isRecord(row.set) ? row.set : null;
  const setName = typeof set?.name === 'string' ? set.name.toLowerCase() : '';
  const setSlug = typeof set?.slug === 'string' ? set.slug.toLowerCase().replace(/-/g, ' ') : '';
  const bundle = `${setName} ${setSlug}`.replace(/\s+/g, ' ').trim();
  if (!bundle) return 0;
  let s = 0;
  if (setName && (setName === w || setName.includes(w) || w.includes(setName))) s += 40;
  else if (bundle.includes(w) || w.includes(bundle.slice(0, Math.min(bundle.length, w.length + 12))))
    s += 22;
  for (const tok of w.split(/\s+/)) {
    if (tok.length > 2 && bundle.includes(tok)) s += 5;
  }
  return Math.min(70, s);
}

/** PokeTrace rows may use numeric `id`; always coerce for API paths + strict checks. */
function poketraceCardIdFromRow(row: UnknownRecord): string | null {
  const id = row.id;
  if (id === undefined || id === null) return null;
  const s = String(id).trim();
  return s.length > 0 ? s : null;
}

function pickBestCard(
  data: unknown[],
  col: MarketplaceCollection,
): UnknownRecord | null {
  const c = col.components as UnknownRecord;
  const wantName = String(c.cardName ?? '').trim();
  const wantNum = String(c.cardNumber ?? '').trim();
  const wantSet = String(c.cardSet ?? '').trim();
  let best: UnknownRecord | null = null;
  let bestScore = -1;
  for (const row of data) {
    if (!isRecord(row)) continue;
    const sc =
      scoreSearchHit(row, wantName, wantNum) + scoreSetAlignment(row, wantSet);
    if (sc > bestScore) {
      bestScore = sc;
      best = row;
    }
  }
  return best;
}

export type PriceBand = {
  avg: number | null;
  low: number | null;
  high: number | null;
  lastUpdated: string | null;
  saleCount: number | null;
  approxSaleCount: boolean | null;
  /** PokeTrace rolling fields on tier (longer windows preferred for chart summary) */
  avg1d: number | null;
  avg7d: number | null;
  avg30d: number | null;
  median3d: number | null;
  median7d: number | null;
  median30d: number | null;
};

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function bandFromTier(t: unknown): PriceBand | null {
  if (!isRecord(t)) return null;
  const avg = typeof t.avg === 'number' ? t.avg : null;
  const low = typeof t.low === 'number' ? t.low : null;
  const high = typeof t.high === 'number' ? t.high : null;
  const lastUpdated =
    typeof t.lastUpdated === 'string' ? t.lastUpdated : null;
  const saleCount = typeof t.saleCount === 'number' ? t.saleCount : null;
  const approxSaleCount =
    typeof t.approxSaleCount === 'boolean' ? t.approxSaleCount : null;
  const avg1d = numOrNull(t.avg1d);
  const avg7d = numOrNull(t.avg7d);
  const avg30d = numOrNull(t.avg30d);
  const median3d = numOrNull(t.median3d);
  const median7d = numOrNull(t.median7d);
  const median30d = numOrNull(t.median30d);
  if (avg == null && low == null && high == null) return null;
  return {
    avg,
    low,
    high,
    lastUpdated,
    saleCount,
    approxSaleCount,
    avg1d,
    avg7d,
    avg30d,
    median3d,
    median7d,
    median30d,
  };
}

function hasSearchablePricePayload(prices: unknown): boolean {
  if (!isRecord(prices)) return false;
  const ebay = isRecord(prices.ebay) ? prices.ebay : null;
  const tcg = isRecord(prices.tcgplayer) ? prices.tcgplayer : null;
  return (
    !!(ebay && isRecord(ebay.NEAR_MINT)) ||
    !!(tcg && isRecord(tcg.NEAR_MINT))
  );
}

function summarizeRawPrices(prices: unknown): {
  ebayNearMint: PriceBand | null;
  tcgplayerNearMint: PriceBand | null;
} {
  if (!isRecord(prices)) {
    return { ebayNearMint: null, tcgplayerNearMint: null };
  }
  const ebay = isRecord(prices.ebay) ? prices.ebay : null;
  const tcg = isRecord(prices.tcgplayer) ? prices.tcgplayer : null;
  const nm = (o: UnknownRecord | null) =>
    o ? bandFromTier(o.NEAR_MINT) : null;
  return {
    ebayNearMint: nm(ebay),
    tcgplayerNearMint: nm(tcg),
  };
}

export type PoketraceNmHistoryResult = {
  enabled: boolean;
  searchQuery: string;
  matched: boolean;
  message?: string;
  /** True when {@link buildMockPoketraceNmHistory} is used (testing / upstream failure). */
  isMockData?: boolean;
  /** Requested window (calendar days) */
  days: number;
  /** Unix seconds, USD — eBay NEAR_MINT tier when available */
  points: Array<{ t: number; v: number }>;
  source: string;
  upstreamRequests: number;
};

export type PoketraceCollectionPreview = {
  enabled: boolean;
  searchQuery: string;
  matched: boolean;
  message?: string;
  /** True when {@link buildMockPoketracePreview} is used (testing / upstream failure). */
  isMockData?: boolean;
  card: null | {
    id: string;
    name: string;
    cardNumber: string;
    setName: string;
    setSlug: string | null;
    image: string | null;
    tcgplayerId: string | null;
    currency: string | null;
    market: string | null;
    lastUpdated: string | null;
    topPrice: number | null;
    totalSaleCount: number | null;
    hasGraded: boolean;
    /** PSA_10 etc. — tier *prices* require PokeTrace Pro for API history; we still list availability */
    gradedTiersAvailable: string[];
    ebayNearMint: PriceBand | null;
    tcgplayerNearMint: PriceBand | null;
  };
};

@Injectable()
export class PoketraceService {
  private readonly logger = new Logger(PoketraceService.name);
  private readonly apiKey: string | null;

  /** Any preview outcome (match, no match, rate limit) — avoids hammering PokeTrace on refetch */
  private readonly previewCacheTtlMs = 900_000;
  private readonly previewResponseCache = new Map<
    string,
    { at: number; value: PoketraceCollectionPreview }
  >();
  /** Same collection opened twice at once (e.g. React Strict Mode) → single upstream flight */
  private readonly previewInflight = new Map<
    string,
    Promise<PoketraceCollectionPreview>
  >();

  /** Search + card row for preview/history — avoids duplicate search when preview ran first */
  private readonly resolveCache = new Map<
    string,
    {
      at: number;
      value:
        | {
          searchQuery: string;
          row: UnknownRecord;
          cardId: string;
        }
        | {
          searchQuery: string;
          matched: false;
          message: string;
        };
    }
  >();
  private readonly resolveCacheTtlMs = 900_000;

  /** Concurrent resolve for same collection → one upstream search */
  private readonly resolveInflight = new Map<
    string,
    Promise<
      | { searchQuery: string; row: UnknownRecord; cardId: string }
      | { searchQuery: string; matched: false; message: string }
    >
  >();

  /** Global spacing between PokeTrace HTTP calls (process-wide) — reduces 429 bursts */
  private pokeTraceMutex = Promise.resolve();
  private lastPokeTraceCompletedAt = 0;
  private readonly pokeTraceMinIntervalMs: number;

  /** Backoff retries for 429 / "Too many requests" (inside serialized queue) */
  private readonly pokeTraceRetryMax: number;
  private readonly pokeTraceRetryBaseMs: number;

  /** GET /cards/:id JSON — shared by preview, resolve enrich, NM history card id */
  private readonly cardDetailCache = new Map<
    string,
    { at: number; value: unknown }
  >();
  private readonly cardDetailCacheTtlMs = 900_000;
  private readonly cardDetailInflight = new Map<string, Promise<unknown>>();

  private readonly historyInflight = new Map<
    string,
    Promise<PoketraceNmHistoryResult>
  >();

  /**
   * When PokeTrace returns no match, errors, or empty NM history — serve deterministic mock data
   * so UI/tests keep working (set in `.env`: `POKETRACE_MOCK_ON_FAILURE=1`).
   */
  private readonly mockOnFailure: boolean;
  /** Skip all upstream PokeTrace HTTP calls; always return mock (`POKETRACE_FORCE_MOCK_DATA=1`). */
  private readonly forceMock: boolean;

  constructor(private readonly config: ConfigService) {
    this.apiKey =
      this.config.get<string>('POKETRACE_PUBLIC_API_TOKEN')?.trim() || null;
    this.mockOnFailure = this.envTruthy('POKETRACE_MOCK_ON_FAILURE');
    this.forceMock = this.envTruthy('POKETRACE_FORCE_MOCK_DATA');
    const raw = this.config.get<string>('POKETRACE_MIN_INTERVAL_MS');
    const n = parseInt(String(raw ?? ''), 10);
    this.pokeTraceMinIntervalMs = Number.isFinite(n)
      ? Math.min(10_000, Math.max(0, n))
      : 1100;
    const rmax = parseInt(
      String(this.config.get<string>('POKETRACE_RETRY_MAX') ?? ''),
      10,
    );
    this.pokeTraceRetryMax = Number.isFinite(rmax)
      ? Math.min(8, Math.max(0, rmax))
      : 3;
    const rbase = parseInt(
      String(this.config.get<string>('POKETRACE_RETRY_BASE_MS') ?? ''),
      10,
    );
    this.pokeTraceRetryBaseMs = Number.isFinite(rbase)
      ? Math.min(60_000, Math.max(250, rbase))
      : 1500;
  }

  private envTruthy(key: string): boolean {
    const v = this.config.get<string>(key)?.trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes' || v === 'on';
  }

  /**
   * If real upstream did not yield a usable preview, optionally substitute mock data.
   */
  private maybeMockPreview(
    col: MarketplaceCollection,
    result: PoketraceCollectionPreview,
  ): PoketraceCollectionPreview {
    if (this.forceMock) {
      return buildMockPoketracePreview(col);
    }
    if (!this.mockOnFailure) {
      return result;
    }
    if (result.matched && result.card) {
      return result;
    }
    return buildMockPoketracePreview(col);
  }

  /**
   * If NM history is missing or too short for charts, optionally substitute mock series.
   */
  private maybeMockNmHistory(
    col: MarketplaceCollection,
    days: number,
    result: PoketraceNmHistoryResult,
  ): PoketraceNmHistoryResult {
    if (this.forceMock) {
      return buildMockPoketraceNmHistory({
        searchQuery: buildPoketraceSearchQuery(col),
        days,
      });
    }
    if (!this.mockOnFailure) {
      return result;
    }
    if (result.matched && result.points.length >= 2) {
      return result;
    }
    return buildMockPoketraceNmHistory({
      searchQuery:
        result.searchQuery?.trim() || buildPoketraceSearchQuery(col),
      days,
    });
  }

  /**
   * Collection `components` updated (e.g. poketraceCardId) — drop cached search/preview so
   * the next request re-resolves against PokeTrace.
   */
  invalidateCollectionPoketraceCaches(collectionKey: string): void {
    const k = collectionKey.toLowerCase();
    this.previewResponseCache.delete(k);
    this.resolveCache.delete(k);
    this.previewInflight.delete(k);
    this.resolveInflight.delete(k);
    for (const key of [...this.historyInflight.keys()]) {
      if (key.startsWith(`${k}:`)) this.historyInflight.delete(key);
    }
  }

  /** One at a time + optional gap — all search / GET card / history share this queue */
  private runSerializedPokeTrace<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.pokeTraceMutex.then(async () => {
      const gap = Math.max(
        0,
        this.pokeTraceMinIntervalMs -
          (Date.now() - this.lastPokeTraceCompletedAt),
      );
      if (gap > 0) {
        await new Promise<void>((r) => setTimeout(r, gap));
      }
      try {
        return await fn();
      } finally {
        this.lastPokeTraceCompletedAt = Date.now();
      }
    });
    this.pokeTraceMutex = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  private headers(): Record<string, string> {
    return {
      'X-API-Key': this.apiKey!,
      Accept: 'application/json',
    };
  }

  /**
   * Single HTTP JSON call with exponential backoff on rate limits.
   * `throw` — non-OK after retries → Error (search, card by id).
   * `return` — always returns last status/body (history pagination surfaces API messages).
   */
  private async pokeTraceExecute(
    url: string,
    errorMode: 'throw' | 'return',
  ): Promise<{ status: number; body: unknown }> {
    let last: { status: number; body: unknown } | null = null;
    for (let attempt = 0; attempt <= this.pokeTraceRetryMax; attempt++) {
      const res = await fetch(url, { headers: this.headers() });
      const body = (await res.json()) as unknown;
      last = { status: res.status, body };
      if (res.ok) return last;

      const msg = isRecord(body) && typeof body.error === 'string'
        ? body.error
        : `PokeTrace HTTP ${res.status}`;
      const rateLimited = isPokeTraceRateLimitMessage(msg, res.status);
      if (rateLimited && attempt < this.pokeTraceRetryMax) {
        const delay = Math.min(
          32_000,
          this.pokeTraceRetryBaseMs * 2 ** attempt,
        );
        this.logger.warn(
          `PokeTrace rate limited (${msg.slice(0, 120)}), retry ${attempt + 1}/${this.pokeTraceRetryMax} in ${delay}ms`,
        );
        await new Promise<void>((r) => setTimeout(r, delay));
        continue;
      }
      if (errorMode === 'throw') throw new Error(msg);
      return last;
    }
    if (errorMode === 'throw') {
      const msg = isRecord(last?.body) && typeof last.body.error === 'string'
        ? last.body.error
        : `PokeTrace HTTP ${last?.status ?? '?'}`;
      throw new Error(msg);
    }
    return last ?? { status: 0, body: {} };
  }

  async searchCards(search: string, limit = 12): Promise<unknown> {
    return this.runSerializedPokeTrace(async () => {
      const url = new URL(`${POKETRACE_BASE}/cards`);
      url.searchParams.set('search', search);
      url.searchParams.set('limit', String(limit));
      const { body } = await this.pokeTraceExecute(url.toString(), 'throw');
      return body;
    });
  }

  /**
   * GET /cards/:id with in-memory cache + inflight dedupe + retry on rate limit.
   * Preview + NM history + resolve often need the same catalog row — avoids duplicate HTTP.
   */
  async getCardById(id: string): Promise<unknown> {
    const key = id.trim();
    if (!key) throw new Error('PokeTrace card id empty');

    const hit = this.cardDetailCache.get(key);
    if (hit && Date.now() - hit.at < this.cardDetailCacheTtlMs) {
      return hit.value;
    }

    const pending = this.cardDetailInflight.get(key);
    if (pending) return pending;

    const flight = this.runSerializedPokeTrace(async () => {
      const url = `${POKETRACE_BASE}/cards/${encodeURIComponent(key)}`;
      const { body } = await this.pokeTraceExecute(url, 'throw');
      return body;
    })
      .then((body) => {
        this.cardDetailCache.set(key, { at: Date.now(), value: body });
        return body;
      })
      .finally(() => {
        this.cardDetailInflight.delete(key);
      });

    this.cardDetailInflight.set(key, flight);
    return flight;
  }

  /**
   * GET /cards/:id/prices/NEAR_MINT/history — Pro+; may paginate (cursor). Max `maxRequests` upstream calls.
   */
  async getNearMintHistoryForCollection(
    col: MarketplaceCollection | null,
    options?: { days?: number; maxRequests?: number },
  ): Promise<PoketraceNmHistoryResult> {
    const days = Math.min(
      Math.max(1, Math.floor(options?.days ?? 90)),
      365,
    );
    const maxRequests = Math.min(
      Math.max(1, Math.floor(options?.maxRequests ?? 3)),
      5,
    );

    if (!col) {
      return {
        enabled: this.isConfigured(),
        searchQuery: '',
        matched: false,
        message: 'Collection not found',
        days,
        points: [],
        source: 'ebay NEAR_MINT',
        upstreamRequests: 0,
      };
    }
    if (this.forceMock) {
      return buildMockPoketraceNmHistory({
        searchQuery: buildPoketraceSearchQuery(col),
        days,
      });
    }
    if (!this.isConfigured()) {
      if (this.mockOnFailure) {
        return buildMockPoketraceNmHistory({
          searchQuery: buildPoketraceSearchQuery(col),
          days,
        });
      }
      return {
        enabled: false,
        searchQuery: buildPoketraceSearchQuery(col),
        matched: false,
        message: 'PokeTrace is not configured (POKETRACE_PUBLIC_API_TOKEN)',
        days,
        points: [],
        source: 'ebay NEAR_MINT',
        upstreamRequests: 0,
      };
    }

    const cacheKey = `${col.collectionKey.toLowerCase()}:hist:${days}`;

    const inflight = this.historyInflight.get(cacheKey);
    if (inflight) return inflight;

    const flight = this.runNmHistoryFetch(col, days, maxRequests)
      .then((r) => this.maybeMockNmHistory(col, days, r))
      .finally(() => {
        this.historyInflight.delete(cacheKey);
      });
    this.historyInflight.set(cacheKey, flight);
    return flight;
  }

  private async runNmHistoryFetch(
    col: MarketplaceCollection,
    days: number,
    maxRequests: number,
  ): Promise<PoketraceNmHistoryResult> {
    const resolved = await this.resolveMatchedCardRow(col);
    if (!('cardId' in resolved)) {
      return {
        enabled: true,
        searchQuery: resolved.searchQuery,
        matched: false,
        message: resolved.message,
        days,
        points: [],
        source: 'ebay NEAR_MINT',
        upstreamRequests: 0,
      };
    }

    const { searchQuery, cardId } = resolved;
    let merged: HistoryPoint[] = [];
    let upstreamRequests = 0;
    let cursor: string | undefined;

    try {
      for (let i = 0; i < maxRequests; i++) {
        const url = new URL(
          `${POKETRACE_BASE}/cards/${encodeURIComponent(cardId)}/prices/NEAR_MINT/history`,
        );
        url.searchParams.set('days', String(days));
        url.searchParams.set('market', 'US');
        url.searchParams.set('source', 'ebay');
        if (cursor) url.searchParams.set('cursor', cursor);

        const { status, body } = await this.runSerializedPokeTrace(() =>
          this.pokeTraceExecute(url.toString(), 'return'),
        );
        upstreamRequests++;

        if (status < 200 || status >= 300) {
          const msg = isRecord(body) && typeof body.error === 'string'
            ? body.error
            : `PokeTrace HTTP ${status}`;
          return {
            enabled: true,
            searchQuery,
            matched: true,
            message: msg,
            days,
            points: merged.length > 0
              ? trimHistoryToWindow(merged, Math.floor(Date.now() / 1000), days)
              : [],
            source: 'ebay NEAR_MINT',
            upstreamRequests,
          };
        }

        const { points, nextCursor } = parsePokeTraceHistoryBody(body);
        merged = merged.concat(points);
        cursor = nextCursor ?? undefined;
        if (!cursor || points.length === 0) break;
      }

      const nowSec = Math.floor(Date.now() / 1000);
      const trimmed = trimHistoryToWindow(merged, nowSec, days);

      return {
        enabled: true,
        searchQuery,
        matched: true,
        days,
        points: trimmed,
        source: 'ebay NEAR_MINT',
        upstreamRequests,
      };
    } catch (e) {
      this.logger.warn(`PokeTrace NM history failed: ${String(e)}`);
      return {
        enabled: true,
        searchQuery,
        matched: true,
        message: e instanceof Error ? e.message : String(e),
        days,
        points: [],
        source: 'ebay NEAR_MINT',
        upstreamRequests,
      };
    }
  }

  /**
   * Cert/PSA analyze → mint: one PokeTrace search to pin catalog `cardId` for stable later lookups.
   */
  async tryResolveCardIdForMintMetadata(
    searchQueryRaw: string,
    hints: { cardName: string; cardNumber: string },
  ): Promise<{ cardId: string; searchQuery: string } | null> {
    if (!this.isConfigured()) return null;
    const q = truncateSearchQuery(searchQueryRaw.trim() || '', 120);
    const hasHints =
      hints.cardName.trim().length >= 2 || hints.cardNumber.trim().length >= 1;
    if ((!q || q === 'pokemon') && !hasHints) return null;

    const searchQuery =
      q && q !== 'pokemon'
        ? q
        : truncateSearchQuery(
            [hints.cardName, hints.cardNumber].filter(Boolean).join(' '),
            120,
          ) || 'pokemon';

    try {
      const searchBody = await this.searchCards(searchQuery, 15);
      const data = isRecord(searchBody) && Array.isArray(searchBody.data)
        ? searchBody.data
        : [];
      if (data.length === 0) return null;

      const col = {
        collectionKey: 'mint_resolve_temp',
        displayLabel: searchQuery,
        queryUsed: searchQuery,
        components: {
          cardName: hints.cardName,
          cardNumber: hints.cardNumber,
        },
        coverImageUrl: null,
        createdAt: new Date(),
      } as MarketplaceCollection;

      const picked = pickBestCard(data, col);
      const pid = picked ? poketraceCardIdFromRow(picked) : null;
      if (!picked || !pid) return null;
      return { cardId: pid, searchQuery };
    } catch (e) {
      this.logger.warn(
        `PokeTrace tryResolveCardIdForMintMetadata: ${e instanceof Error ? e.message : String(e)}`,
      );
      return null;
    }
  }

  /**
   * Cached search → card row (shared by preview + NM history).
   */
  private async resolveMatchedCardRow(
    col: MarketplaceCollection,
  ): Promise<
    | { searchQuery: string; row: UnknownRecord; cardId: string }
    | { searchQuery: string; matched: false; message: string }
  > {
    const key = col.collectionKey.toLowerCase();
    const hit = this.resolveCache.get(key);
    if (hit && Date.now() - hit.at < this.resolveCacheTtlMs) {
      return hit.value as
        | { searchQuery: string; row: UnknownRecord; cardId: string }
        | { searchQuery: string; matched: false; message: string };
    }

    const infl = this.resolveInflight.get(key);
    if (infl) return infl;

    const flight = (async () => {
      let searchQuery = buildPoketraceSearchQuery(col);
      try {
        const comp = col.components as UnknownRecord;
        const directId =
          typeof comp?.poketraceCardId === 'string'
            ? comp.poketraceCardId.trim()
            : '';
        if (directId) {
          try {
            const rawDetail = await this.getCardById(directId);
            let row: UnknownRecord | null = null;
            if (isRecord(rawDetail) && isRecord(rawDetail.data)) {
              row = rawDetail.data as UnknownRecord;
            } else if (isRecord(rawDetail) && typeof rawDetail.id === 'string') {
              row = rawDetail as UnknownRecord;
            }
            if (row && typeof row.id === 'string') {
              let useRow: UnknownRecord = row;
              const rowId = String(row.id).trim();
              const sameAsDirect =
                rowId.length > 0 && rowId === directId.trim();
              if (
                !hasSearchablePricePayload(row.prices) &&
                !sameAsDirect
              ) {
                try {
                  const detail2 = await this.getCardById(rowId);
                  if (isRecord(detail2) && isRecord(detail2.data)) {
                    useRow = detail2.data as UnknownRecord;
                  }
                } catch (e) {
                  this.logger.warn(
                    `PokeTrace GET /cards/:id (direct) enrich: ${e instanceof Error ? e.message : String(e)}`,
                  );
                }
              }
              const out = {
                searchQuery,
                row: useRow,
                cardId: String(useRow.id),
              };
              this.resolveCache.set(key, { at: Date.now(), value: out });
              return out;
            }
          } catch (e) {
            this.logger.warn(
              `PokeTrace catalog id ${directId} failed, falling back to search: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        }

        const attempts = buildPoketraceSearchQueryAttempts(col);
        let data: unknown[] = [];
        let searchQueryUsed = attempts[0] ?? searchQuery;
        for (const q of attempts) {
          searchQueryUsed = q;
          const searchBody = await this.searchCards(q, 15);
          const chunk = isRecord(searchBody) && Array.isArray(searchBody.data)
            ? searchBody.data
            : [];
          if (chunk.length > 0) {
            data = chunk;
            break;
          }
        }
        if (data.length === 0) {
          const v = {
            searchQuery: attempts[0] ?? searchQuery,
            matched: false as const,
            message: 'No PokeTrace cards matched this search',
          };
          this.resolveCache.set(key, { at: Date.now(), value: v });
          return v;
        }
        searchQuery = searchQueryUsed;

        const picked = pickBestCard(data, col);
        const pickedId = picked ? poketraceCardIdFromRow(picked) : null;
        if (!picked || !pickedId) {
          const v = {
            searchQuery,
            matched: false as const,
            message: 'Could not resolve card id',
          };
          this.resolveCache.set(key, { at: Date.now(), value: v });
          return v;
        }

        let row: UnknownRecord = picked;
        if (!hasSearchablePricePayload(picked.prices)) {
          try {
            const detail = await this.getCardById(pickedId);
            if (isRecord(detail) && isRecord(detail.data)) {
              row = detail.data;
            }
          } catch (e) {
            this.logger.warn(
              `PokeTrace GET /cards/:id skipped (resolve): ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        }

        const out = {
          searchQuery,
          row,
          cardId: pickedId,
        };
        this.resolveCache.set(key, { at: Date.now(), value: out });
        return out;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const v = { searchQuery, matched: false as const, message: msg };
        this.resolveCache.set(key, { at: Date.now(), value: v });
        return v;
      } finally {
        this.resolveInflight.delete(key);
      }
    })();

    this.resolveInflight.set(key, flight);
    return flight;
  }

  /**
   * Best-effort PokeTrace card + raw (NM) market bands for a marketplace collection.
   * PSA/BGS graded $ amounts for tiers like PSA_10 require a PokeTrace Pro plan (API returns UPGRADE_REQUIRED for history).
   */
  async getPreviewForCollection(
    col: MarketplaceCollection | null,
  ): Promise<PoketraceCollectionPreview> {
    if (!col) {
      return {
        enabled: this.isConfigured(),
        searchQuery: '',
        matched: false,
        message: 'Collection not found',
        card: null,
      };
    }
    if (this.forceMock) {
      return buildMockPoketracePreview(col);
    }
    if (!this.isConfigured()) {
      if (this.mockOnFailure) {
        return buildMockPoketracePreview(col);
      }
      return {
        enabled: false,
        searchQuery: buildPoketraceSearchQuery(col),
        matched: false,
        message: 'PokeTrace is not configured (POKETRACE_PUBLIC_API_TOKEN)',
        card: null,
      };
    }

    const cacheKey = col.collectionKey.toLowerCase();

    const anyHit = this.previewResponseCache.get(cacheKey);
    if (anyHit && Date.now() - anyHit.at < this.previewCacheTtlMs) {
      return this.maybeMockPreview(col, anyHit.value);
    }

    const inflight = this.previewInflight.get(cacheKey);
    if (inflight) return inflight;

    const flight = (async () => {
      const out = await this.runPreviewFetch(col);
      const merged = this.maybeMockPreview(col, out);
      this.previewResponseCache.set(cacheKey, { at: Date.now(), value: merged });
      return merged;
    })().finally(() => {
      this.previewInflight.delete(cacheKey);
    });
    this.previewInflight.set(cacheKey, flight);

    return flight;
  }

  /**
   * Resolve uses search + optional GET /cards/:id when NM bands are missing.
   * Card GETs are cached by id and deduped in-flight; rate limits trigger backoff retries.
   * Direct catalog id skips a redundant second GET when it would repeat the same id.
   */
  private async runPreviewFetch(
    col: MarketplaceCollection,
  ): Promise<PoketraceCollectionPreview> {
    const searchQuery = buildPoketraceSearchQuery(col);
    try {
      const resolved = await this.resolveMatchedCardRow(col);
      if (!('cardId' in resolved)) {
        return {
          enabled: true,
          searchQuery: resolved.searchQuery,
          matched: false,
          message: resolved.message,
          card: null,
        };
      }

      const { row } = resolved;

      const set = isRecord(row.set) ? row.set : null;
      const setName = typeof set?.name === 'string' ? set.name : '';
      const setSlug = typeof set?.slug === 'string' ? set.slug : null;
      const refs = isRecord(row.refs) ? row.refs : null;
      const tcgplayerId =
        typeof refs?.tcgplayerId === 'string' ? refs.tcgplayerId : null;

      const { ebayNearMint, tcgplayerNearMint } = summarizeRawPrices(
        row.prices,
      );

      const gradedTiers = Array.isArray(row.gradedOptions)
        ? (row.gradedOptions as string[]).filter(
            (g) => typeof g === 'string' && g.startsWith('PSA_'),
          )
        : [];

      return {
        enabled: true,
        searchQuery: resolved.searchQuery,
        matched: true,
        card: {
          id: String(row.id),
          name: String(row.name ?? ''),
          cardNumber: String(row.cardNumber ?? ''),
          setName,
          setSlug,
          image: typeof row.image === 'string' ? row.image : null,
          tcgplayerId,
          currency: typeof row.currency === 'string' ? row.currency : null,
          market: typeof row.market === 'string' ? row.market : null,
          lastUpdated:
            typeof row.lastUpdated === 'string' ? row.lastUpdated : null,
          topPrice: typeof row.topPrice === 'number' ? row.topPrice : null,
          totalSaleCount:
            typeof row.totalSaleCount === 'number'
              ? row.totalSaleCount
              : null,
          hasGraded: row.hasGraded === true,
          gradedTiersAvailable: gradedTiers.slice(0, 12),
          ebayNearMint,
          tcgplayerNearMint,
        },
      };
    } catch (e) {
      this.logger.warn(`PokeTrace preview failed: ${String(e)}`);
      return {
        enabled: true,
        searchQuery,
        matched: false,
        message: e instanceof Error ? e.message : String(e),
        card: null,
      };
    }
  }

  /**
   * RWA IPFS metadata → PokeTrace catalog + NM bands (same shape as collection preview).
   * Uses synthetic `collection_key` per deduped search so portfolio can batch unique cards.
   */
  async getPreviewForMintMetadata(
    metadata: unknown,
  ): Promise<PoketraceCollectionPreview> {
    const { query, cardName, cardNumber, poketraceCardId } =
      buildPoketraceQueryFromRwaMetadata(metadata);
    if (!poketraceCardId?.trim() && !query.trim()) {
      return {
        enabled: this.isConfigured(),
        searchQuery: '',
        matched: false,
        message: 'No search query in metadata',
        card: null,
      };
    }
    const colKey = poketraceCardId?.trim()
      ? `mintpt_${poketraceCardId.trim()}`
      : mintPreviewDedupeKey(query, cardName, cardNumber);
    const col = this.mintSyntheticCollection(colKey, query.trim() || 'pokemon', {
      cardName,
      cardNumber,
      poketraceCardId,
    });
    return this.getPreviewForCollection(col);
  }

  /**
   * Batch PokeTrace previews for My Assets — dedupes by search key, serializes via existing mutex.
   */
  async getBatchMintPreviews(
    items: Array<{ tokenId: number; metadata: unknown }>,
  ): Promise<Record<number, PoketraceCollectionPreview>> {
    const out: Record<number, PoketraceCollectionPreview> = {};
    const max = 32;
    const slice = items.slice(0, max);

    const groups = new Map<
      string,
      {
        query: string;
        cardName: string;
        cardNumber: string;
        poketraceCardId: string | null;
        tokenIds: number[];
      }
    >();

    for (const it of slice) {
      const { query, cardName, cardNumber, poketraceCardId } =
        buildPoketraceQueryFromRwaMetadata(it.metadata);
      if (!poketraceCardId?.trim() && !query.trim()) continue;
      const dk = poketraceCardId?.trim()
        ? `mintpt_${poketraceCardId.trim()}`
        : mintPreviewDedupeKey(query, cardName, cardNumber);
      const g = groups.get(dk);
      if (g) {
        g.tokenIds.push(it.tokenId);
      } else {
        groups.set(dk, {
          query,
          cardName,
          cardNumber,
          poketraceCardId,
          tokenIds: [it.tokenId],
        });
      }
    }

    for (const [, g] of groups) {
      const colKey = g.poketraceCardId?.trim()
        ? `mintpt_${g.poketraceCardId.trim()}`
        : mintPreviewDedupeKey(g.query, g.cardName, g.cardNumber);
      const col = this.mintSyntheticCollection(colKey, g.query.trim() || 'pokemon', {
        cardName: g.cardName,
        cardNumber: g.cardNumber,
        poketraceCardId: g.poketraceCardId,
      });
      const preview = await this.getPreviewForCollection(col);
      for (const tid of g.tokenIds) {
        out[tid] = preview;
      }
    }

    return out;
  }

  private mintSyntheticCollection(
    collectionKey: string,
    query: string,
    hints: {
      cardName: string;
      cardNumber: string;
      poketraceCardId?: string | null;
    },
  ): MarketplaceCollection {
    const components: UnknownRecord = {
      cardName: hints.cardName,
      cardNumber: hints.cardNumber,
    };
    const pid = hints.poketraceCardId?.trim();
    if (pid) components.poketraceCardId = pid;
    return {
      collectionKey,
      displayLabel: query.slice(0, 240),
      queryUsed: query,
      components,
      coverImageUrl: null,
      createdAt: new Date(),
    } as MarketplaceCollection;
  }
}
