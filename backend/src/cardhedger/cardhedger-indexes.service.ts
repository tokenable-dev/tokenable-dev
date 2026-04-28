import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CardhedgerService } from './cardhedger.service';

type CardRow = Record<string, unknown>;

export type CardhedgerGameIndexRow = {
  id: string;
  name: string;
  game_value_usd: number;
  game_value_change_7d_pct: number;
  game_value_change_30d_pct: number;
  game_value_change_90d_pct: number;
  game_value_change_180d_pct: number;
  game_value_change_365d_pct: number;
};

const HISTORY_SAMPLE_SIZE = 8;
const HISTORY_CONCURRENCY = 6;
const WINDOWS_DAYS = [7, 30, 90, 180, 365] as const;
type WindowDays = (typeof WINDOWS_DAYS)[number];

@Injectable()
export class CardhedgerIndexesService {
  private readonly enableHistoryBlend: boolean;
  private readonly cacheTtlMs: number;
  private readonly staleGraceMs: number;
  private cacheValue: { data: CardhedgerGameIndexRow[] } | null = null;
  private cacheUpdatedAtMs = 0;
  private inflight: Promise<{ data: CardhedgerGameIndexRow[] }> | null = null;

  constructor(
    private readonly cardhedger: CardhedgerService,
    private readonly config: ConfigService,
  ) {
    const raw = this.config.get<string>('CARDHEDGER_INDEXES_ENABLE_HISTORY_BLEND');
    this.enableHistoryBlend = raw === '1' || raw === 'true';
    this.cacheTtlMs = Math.max(
      5_000,
      Number(this.config.get<string>('CARDHEDGER_INDEXES_CACHE_TTL_MS') ?? 30_000) || 30_000,
    );
    this.staleGraceMs = Math.max(
      0,
      Number(this.config.get<string>('CARDHEDGER_INDEXES_CACHE_STALE_GRACE_MS') ?? 120_000) ||
        120_000,
    );
  }

  private async buildDashboardIndexes(): Promise<{ data: CardhedgerGameIndexRow[] }> {
    const [pokemon, mlb, nfl, nba] = await Promise.all([
      this.fetchCategoryIndex({
        id: 'pokemon',
        name: 'Pokemon Index',
        category: 'Pokemon',
      }),
      this.fetchCategoryIndex({
        id: 'mlb',
        name: 'MLB Index',
        category: 'Baseball',
      }),
      this.fetchCategoryIndex({
        id: 'nfl',
        name: 'NFL Index',
        category: 'Football',
      }),
      this.fetchCategoryIndex({
        id: 'nba',
        name: 'NBA Index',
        category: 'Basketball',
      }),
    ]);
    return { data: [pokemon, mlb, nfl, nba] };
  }

  private pickRepresentativeUsd(card: CardRow): number | null {
    const prices = card.prices;
    if (!Array.isArray(prices)) return null;
    const map = new Map<string, number>();
    for (const p of prices) {
      if (typeof p !== 'object' || p == null) continue;
      const grade = String((p as { grade?: unknown }).grade ?? '')
        .trim()
        .toUpperCase();
      const raw = (p as { price?: unknown }).price;
      const n =
        typeof raw === 'number'
          ? raw
          : typeof raw === 'string'
            ? parseFloat(raw.replace(/[^0-9.-]/g, ''))
            : NaN;
      if (!Number.isFinite(n) || n <= 0) continue;
      map.set(grade, n);
    }
    const pref = ['PSA 10', 'PSA 9', 'RAW', 'NEAR MINT'];
    for (const g of pref) {
      const v = map.get(g);
      if (v != null) return v;
    }
    const vals = [...map.values()];
    if (vals.length === 0) return null;
    return Math.max(...vals);
  }

  private pickRepresentativeGrade(card: CardRow): string | null {
    const prices = card.prices;
    if (!Array.isArray(prices)) return null;
    const grades = new Set<string>();
    for (const p of prices) {
      if (typeof p !== 'object' || p == null) continue;
      const g = String((p as { grade?: unknown }).grade ?? '')
        .trim()
        .toUpperCase();
      if (g) grades.add(g);
    }
    const pref = ['PSA 10', 'PSA 9', 'BGS 9.5', 'RAW', 'NEAR MINT'];
    for (const g of pref) {
      if (grades.has(g)) return g;
    }
    const first = [...grades][0];
    return first ?? null;
  }

  private toCardhedgerGradeParam(grade: string): string {
    const g = grade.trim().toUpperCase();
    if (g === 'RAW') return 'Raw';
    if (g === 'NEAR MINT') return 'Near Mint';
    return grade.trim();
  }

  private pickCardId(card: CardRow): string | null {
    const id = card.card_id;
    if (typeof id !== 'string' || !id.trim()) return null;
    return id.trim();
  }

  private toNumber(v: unknown): number | null {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = parseFloat(v.replace(/[^0-9.-]/g, ''));
      if (Number.isFinite(n)) return n;
    }
    return null;
  }

  private pct(first: number | null, last: number | null): number | null {
    if (first == null || last == null || !(first > 0)) return null;
    const p = ((last - first) / first) * 100;
    return Number.isFinite(p) ? p : null;
  }

  private deriveWindowPctFromSeries(
    points: Array<{ t: number; p: number }>,
    days: WindowDays,
  ): number | null {
    if (points.length < 2) return null;
    const sorted = [...points].sort((a, b) => a.t - b.t);
    const latest = sorted[sorted.length - 1]!;
    const target = latest.t - days * 86400;
    let ref = sorted[0]!;
    let bestGap = Math.abs(ref.t - target);
    for (const pt of sorted) {
      const gap = Math.abs(pt.t - target);
      if (gap < bestGap) {
        ref = pt;
        bestGap = gap;
      }
    }
    return this.pct(ref.p, latest.p);
  }

  private weightedMean(items: Array<{ value: number; weight: number }>): number | null {
    let sw = 0;
    let sx = 0;
    for (const it of items) {
      if (!Number.isFinite(it.value) || !Number.isFinite(it.weight) || it.weight <= 0) {
        continue;
      }
      sw += it.weight;
      sx += it.value * it.weight;
    }
    if (sw <= 0) return null;
    return sx / sw;
  }

  private async mapInBatches<T, R>(
    input: readonly T[],
    concurrency: number,
    fn: (item: T, idx: number) => Promise<R>,
  ): Promise<R[]> {
    const out: R[] = [];
    for (let i = 0; i < input.length; i += concurrency) {
      const chunk = input.slice(i, i + concurrency);
      const settled = await Promise.all(chunk.map((x, off) => fn(x, i + off)));
      out.push(...settled);
    }
    return out;
  }

  private async estimateWindowChangesFromHistory(
    rows: CardRow[],
  ): Promise<Record<WindowDays, number | null>> {
    const candidates = rows
      .map((r) => {
        const cardId = this.pickCardId(r);
        const grade = this.pickRepresentativeGrade(r);
        const weight = this.pickRepresentativeUsd(r);
        return {
          cardId,
          grade,
          weight: weight != null && weight > 0 ? weight : 1,
        };
      })
      .filter(
        (x): x is { cardId: string; grade: string; weight: number } =>
          Boolean(x.cardId && x.grade),
      )
      .sort((a, b) => b.weight - a.weight)
      .slice(0, HISTORY_SAMPLE_SIZE);

    const perCard = await this.mapInBatches(candidates, HISTORY_CONCURRENCY, async (c) => {
      try {
        const gradeParam = this.toCardhedgerGradeParam(c.grade);
        const body = await this.cardhedger.forwardJson('POST', '/v1/cards/prices-by-card', {
          body: { card_id: c.cardId, grade: gradeParam, days: 365 },
        });
        const prices = Array.isArray((body as { prices?: unknown[] })?.prices)
          ? ((body as { prices: unknown[] }).prices ?? [])
          : [];
        const series = prices
          .map((p) => {
            if (typeof p !== 'object' || p == null) return null;
            const tRaw = (p as { closing_date?: unknown }).closing_date;
            const pxRaw = (p as { price?: unknown }).price;
            const t = typeof tRaw === 'string' ? Date.parse(tRaw) : NaN;
            const px = this.toNumber(pxRaw);
            if (!Number.isFinite(t) || px == null || px <= 0) return null;
            return { t: Math.floor(t / 1000), p: px };
          })
          .filter((x): x is { t: number; p: number } => x != null);
        return { weight: c.weight, series };
      } catch {
        return { weight: c.weight, series: [] as Array<{ t: number; p: number }> };
      }
    });

    const out: Record<WindowDays, number | null> = {
      7: null,
      30: null,
      90: null,
      180: null,
      365: null,
    };
    for (const d of WINDOWS_DAYS) {
      const weighted: Array<{ value: number; weight: number }> = [];
      for (const c of perCard) {
        const p = this.deriveWindowPctFromSeries(c.series, d);
        if (p != null) weighted.push({ value: p, weight: c.weight });
      }
      out[d] = this.weightedMean(weighted);
    }
    return out;
  }

  private async estimateWindowChangesFromUpdates(
    rows: CardRow[],
  ): Promise<Record<WindowDays, number | null>> {
    const cardSet = new Set(
      rows
        .map((r) => this.pickCardId(r))
        .filter((x): x is string => Boolean(x)),
    );
    const out: Record<WindowDays, number | null> = {
      7: null,
      30: null,
      90: null,
      180: null,
      365: null,
    };
    if (cardSet.size === 0) return out;

    // Single fetch (365d) and derive 7/30/90/180/365 windows from the same update stream.
    try {
      const since365 = new Date(Date.now() - 365 * 86400_000).toISOString();
      const body = await this.cardhedger.forwardJson('POST', '/v1/cards/price-updates', {
        body: {
          since: since365,
          ignore_grades: ['Raw'],
        },
      });
      const updates = Array.isArray((body as { updates?: unknown[] })?.updates)
        ? ((body as { updates: unknown[] }).updates ?? [])
        : [];
      const byKey = new Map<string, Array<{ t: number; p: number }>>();
      for (const u of updates) {
        if (typeof u !== 'object' || u == null) continue;
        const cardId = String((u as { card_id?: unknown }).card_id ?? '').trim();
        if (!cardSet.has(cardId)) continue;
        const grade = String((u as { grade?: unknown }).grade ?? '')
          .trim()
          .toUpperCase();
        const tRaw = (u as { update_timestamp?: unknown }).update_timestamp;
        const pRaw = (u as { price?: unknown }).price;
        const t = typeof tRaw === 'string' ? Date.parse(tRaw) : NaN;
        const p = this.toNumber(pRaw);
        if (!grade || !Number.isFinite(t) || p == null || p <= 0) continue;
        const k = `${cardId}::${grade}`;
        const arr = byKey.get(k) ?? [];
        arr.push({ t: Math.floor(t / 1000), p });
        byKey.set(k, arr);
      }

      const latestSec = Math.floor(Date.now() / 1000);
      for (const d of WINDOWS_DAYS) {
        const windowStart = latestSec - d * 86400;
        const deltas: Array<{ value: number; weight: number }> = [];
        for (const arr of byKey.values()) {
          if (arr.length < 2) continue;
          arr.sort((a, b) => a.t - b.t);
          const inWindow = arr.filter((pt) => pt.t >= windowStart);
          if (inWindow.length < 2) continue;
          const first = inWindow[0]!;
          const last = inWindow[inWindow.length - 1]!;
          const p = this.pct(first.p, last.p);
          if (p != null) deltas.push({ value: p, weight: Math.max(1, last.p) });
        }
        out[d] = this.weightedMean(deltas);
      }
    } catch {
      for (const d of WINDOWS_DAYS) out[d] = null;
    }
    return out;
  }

  private async fetchCategoryIndex(params: {
    id: string;
    name: string;
    category: string;
  }): Promise<CardhedgerGameIndexRow> {
    const categoryCandidates =
      params.id === 'nfl'
        ? ['Football', 'NFL', 'American Football']
        : params.id === 'mlb'
          ? ['Baseball', 'MLB']
          : params.id === 'nba'
            ? ['Basketball', 'NBA']
            : [params.category];

    let rows: CardRow[] = [];
    for (const category of categoryCandidates) {
      const body = await this.cardhedger.forwardJson('POST', '/v1/cards/card-search', {
        body: {
          category,
          page: 1,
          page_size: 80,
        },
      });
      const cards = Array.isArray((body as { cards?: unknown[] })?.cards)
        ? ((body as { cards: unknown[] }).cards ?? [])
        : [];
      rows = cards.filter((x): x is CardRow => typeof x === 'object' && x != null);
      if (rows.length > 0) break;
    }

    let total = 0;
    for (const c of rows) {
      const px = this.pickRepresentativeUsd(c);
      if (px != null) total += px;
    }

    const updates = await this.estimateWindowChangesFromUpdates(rows);
    const updatesAllMissing = WINDOWS_DAYS.every((d) => updates[d] == null);
    const hasMissingUpdateWindow = WINDOWS_DAYS.some((d) => updates[d] == null);
    const hasSuspiciousFlat365FromUpdates =
      updates[365] != null && Math.abs(updates[365]!) < 0.01;
    const gains: Record<WindowDays, number> = {
      7: updates[7] ?? 0,
      30: updates[30] ?? 0,
      90: updates[90] ?? 0,
      180: updates[180] ?? 0,
      365: updates[365] ?? 0,
    };

    // Safety fallback:
    // - if updates are entirely missing, recover all windows from history
    // - if only specific windows are missing (e.g. 365d), fill only those windows from history
    if (updatesAllMissing || hasMissingUpdateWindow || hasSuspiciousFlat365FromUpdates) {
      const histFallback = await this.estimateWindowChangesFromHistory(rows);
      for (const d of WINDOWS_DAYS) {
        if (updatesAllMissing) {
          if (histFallback[d] != null) gains[d] = histFallback[d]!;
          continue;
        }
        if (updates[d] == null && histFallback[d] != null) gains[d] = histFallback[d]!;
      }
      if (hasSuspiciousFlat365FromUpdates && histFallback[365] != null) {
        gains[365] = histFallback[365]!;
      }
    }

    // Optional quality mode: blend with per-card history (slower).
    if (this.enableHistoryBlend) {
      const hist = await this.estimateWindowChangesFromHistory(rows);
      for (const d of WINDOWS_DAYS) {
        const h = hist[d];
        const u = updates[d];
        gains[d] =
          h != null && u != null ? h * 0.75 + u * 0.25 : h != null ? h : u != null ? u : 0;
      }
    }
    return {
      id: params.id,
      name: params.name,
      game_value_usd: Number(total.toFixed(2)),
      game_value_change_7d_pct: Number(gains[7].toFixed(2)),
      game_value_change_30d_pct: Number(gains[30].toFixed(2)),
      game_value_change_90d_pct: Number(gains[90].toFixed(2)),
      game_value_change_180d_pct: Number(gains[180].toFixed(2)),
      game_value_change_365d_pct: Number(gains[365].toFixed(2)),
    };
  }

  private isFresh(nowMs: number): boolean {
    return this.cacheValue != null && nowMs - this.cacheUpdatedAtMs <= this.cacheTtlMs;
  }

  private isWithinStaleGrace(nowMs: number): boolean {
    return (
      this.cacheValue != null &&
      nowMs - this.cacheUpdatedAtMs <= this.cacheTtlMs + this.staleGraceMs
    );
  }

  private async rebuildCache(): Promise<{ data: CardhedgerGameIndexRow[] }> {
    if (this.inflight) return this.inflight;
    this.inflight = this.buildDashboardIndexes()
      .then((value) => {
        this.cacheValue = value;
        this.cacheUpdatedAtMs = Date.now();
        return value;
      })
      .finally(() => {
        this.inflight = null;
      });
    return this.inflight;
  }

  async getDashboardIndexes(opts?: {
    forceRefresh?: boolean;
  }): Promise<{ data: CardhedgerGameIndexRow[] }> {
    this.cardhedger.assertConfigured();
    const nowMs = Date.now();
    if (opts?.forceRefresh) {
      return this.rebuildCache();
    }

    if (this.isFresh(nowMs) && this.cacheValue) {
      return this.cacheValue;
    }

    // Stale-while-revalidate: return stale immediately, refresh in background.
    if (this.isWithinStaleGrace(nowMs) && this.cacheValue) {
      void this.rebuildCache();
      return this.cacheValue;
    }

    // Hard miss/too old: block on a fresh rebuild.
    return this.rebuildCache();
  }
}

