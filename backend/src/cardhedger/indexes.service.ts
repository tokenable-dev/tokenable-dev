import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CardhedgerService } from './cardhedger.service';

type CardRow = Record<string, unknown>;
type PriceSeries = Array<{ t: number; p: number }>;
/**
 * One-shot pre-indexed view of `/v1/cards/price-updates` keyed by `card_id`.
 * Built once per rebuild so each category's window computation is O(cards-in-cat)
 * instead of O(total-updates). Each inner series is sorted ascending by timestamp.
 */
type UpdatesByCard = Map<string, PriceSeries[]>;

export type CardhedgerGameIndexRow = {
  id: string;
  name: string;
  game_value_usd: number;
  /** Null when Cardhedger streams do not support a defensible estimate (never coerced to 0). */
  game_value_change_7d_pct: number | null;
  game_value_change_30d_pct: number | null;
  game_value_change_90d_pct: number | null;
  game_value_change_180d_pct: number | null;
  game_value_change_365d_pct: number | null;
};

const HISTORY_SAMPLE_SIZE = 5;
const HISTORY_CONCURRENCY = 8;
const WINDOWS_DAYS = [7, 30, 90, 180, 365] as const;
type WindowDays = (typeof WINDOWS_DAYS)[number];
const DISK_CACHE_SCHEMA_VERSION = 2;

@Injectable()
export class CardhedgerIndexesService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(CardhedgerIndexesService.name);
  private readonly enableHistoryBlend: boolean;
  private readonly cacheTtlMs: number;
  private readonly prewarmDelayMs: number;
  private readonly refreshIntervalMs: number;
  private readonly diskCachePath: string;
  private cacheValue: { data: CardhedgerGameIndexRow[] } | null = null;
  private cacheUpdatedAtMs = 0;
  private inflight: Promise<{ data: CardhedgerGameIndexRow[] }> | null = null;
  private prewarmTimer: NodeJS.Timeout | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private scheduledRebuildCount = 0;

  constructor(
    private readonly cardhedger: CardhedgerService,
    private readonly config: ConfigService,
  ) {
    const raw = this.config.get<string>('CARDHEDGER_INDEXES_ENABLE_HISTORY_BLEND');
    this.enableHistoryBlend = raw === '1' || raw === 'true';
    // Market-index aggregates (7d/30d/90d/180d/365d % change, USD total) are
    // daily-granularity metrics. A scheduled 24h refresh is sufficient and
    // avoids the wasteful "rebuild whenever a dashboard hit happens to fall
    // 5+ min after the previous build" pattern.
    this.cacheTtlMs = Math.max(
      60_000, // 1 min minimum sanity floor
      Number(this.config.get<string>('CARDHEDGER_INDEXES_CACHE_TTL_MS') ?? 86_400_000) ||
        86_400_000,
    );
    this.prewarmDelayMs = Math.max(
      0,
      Number(this.config.get<string>('CARDHEDGER_INDEXES_PREWARM_DELAY_MS') ?? 3_000) || 3_000,
    );
    // Scheduled background refresh cadence. Defaults to 24h; override for faster
    // dev loops or staging verification.
    this.refreshIntervalMs = Math.max(
      60_000, // 1 min minimum — anything smaller is almost certainly a config mistake
      Number(
        this.config.get<string>('CARDHEDGER_INDEXES_REFRESH_INTERVAL_MS') ?? 86_400_000,
      ) || 86_400_000,
    );
    this.diskCachePath = path.join(
      os.tmpdir(),
      `cardhedger-indexes-v${DISK_CACHE_SCHEMA_VERSION}.json`,
    );
    // Hydrate synchronously at construction so the very first request (even before
    // onApplicationBootstrap fires) can serve a stale snapshot immediately.
    this.hydrateFromDisk();
  }

  /**
   * Nest lifecycle hook — after the app is ready:
   *   1) Kick off an immediate pre-warm (non-blocking).
   *   2) Schedule a recurring background refresh on a fixed cadence (default 24h).
   *
   * We intentionally do not await: the first GET should never block on Cardhedger.
   * Scheduled rebuilds are decoupled from user traffic, so dashboards never trigger
   * an implicit rebuild — the cache is simply read.
   */
  onApplicationBootstrap(): void {
    this.prewarmTimer = setTimeout(() => {
      void this.rebuildCache().catch((err) =>
        this.logger.warn(
          `index prewarm failed: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    }, this.prewarmDelayMs);
    // Don't keep the Node process alive just for the timers.
    this.prewarmTimer.unref?.();

    this.refreshTimer = setInterval(() => {
      this.scheduledRebuildCount += 1;
      const n = this.scheduledRebuildCount;
      this.logger.log(
        `scheduled rebuild #${n} starting (interval=${Math.round(
          this.refreshIntervalMs / 1000,
        )}s)`,
      );
      void this.rebuildCache().catch((err) =>
        this.logger.warn(
          `scheduled rebuild #${n} failed: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    }, this.refreshIntervalMs);
    this.refreshTimer.unref?.();

    this.logger.log(
      `indexes service ready — prewarm in ${this.prewarmDelayMs}ms, ` +
        `scheduled refresh every ${Math.round(this.refreshIntervalMs / 1000)}s ` +
        `(${(this.refreshIntervalMs / 3_600_000).toFixed(1)}h)`,
    );
  }

  onApplicationShutdown(): void {
    if (this.prewarmTimer) {
      clearTimeout(this.prewarmTimer);
      this.prewarmTimer = null;
    }
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private hydrateFromDisk(): void {
    try {
      if (!fs.existsSync(this.diskCachePath)) return;
      const raw = fs.readFileSync(this.diskCachePath, 'utf8');
      const parsed = JSON.parse(raw) as {
        updatedAt?: number;
        data?: CardhedgerGameIndexRow[];
      };
      if (!Array.isArray(parsed.data) || parsed.data.length === 0) return;
      const updatedAt = Number(parsed.updatedAt ?? 0);
      if (!Number.isFinite(updatedAt) || updatedAt <= 0) return;
      this.cacheValue = { data: parsed.data };
      this.cacheUpdatedAtMs = updatedAt;
      const ageSec = Math.round((Date.now() - updatedAt) / 1000);
      this.logger.log(`hydrated dashboard indexes from disk (age=${ageSec}s)`);
    } catch (err) {
      this.logger.warn(
        `disk cache hydrate failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private persistToDisk(value: { data: CardhedgerGameIndexRow[] }, updatedAtMs: number): void {
    const payload = JSON.stringify({ updatedAt: updatedAtMs, data: value.data });
    // Fire-and-forget; silent best-effort. A tmpdir that's read-only or full should
    // not break the hot path.
    void fs.promises.writeFile(this.diskCachePath, payload, 'utf8').catch(() => {});
  }

  private async buildDashboardIndexes(): Promise<{ data: CardhedgerGameIndexRow[] }> {
    const started = Date.now();
    // Fetch the 365-day price-update stream once and pre-index it by card_id so every
    // category's window derivation is O(cards-in-cat) instead of O(total-updates).
    const sharedUpdatesBody = await this.fetchPriceUpdatesRaw().catch((err) => {
      this.logger.warn(
        `price-updates fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    });
    const updatesFetchedAt = Date.now();
    const preIndexed = sharedUpdatesBody ? this.indexUpdatesByCard(sharedUpdatesBody) : null;
    const updatesIndexedAt = Date.now();

    const [pokemon, mlb, nfl, nba] = await Promise.all([
      this.fetchCategoryIndex({
        id: 'pokemon',
        name: 'Pokemon Index',
        category: 'Pokemon',
        preIndexed,
      }),
      this.fetchCategoryIndex({
        id: 'mlb',
        name: 'MLB Index',
        category: 'Baseball',
        preIndexed,
      }),
      this.fetchCategoryIndex({
        id: 'nfl',
        name: 'NFL Index',
        category: 'Football',
        preIndexed,
      }),
      this.fetchCategoryIndex({
        id: 'nba',
        name: 'NBA Index',
        category: 'Basketball',
        preIndexed,
      }),
    ]);
    const finishedAt = Date.now();
    this.logger.log(
      `dashboard indexes built in ${finishedAt - started}ms ` +
        `(fetch_updates=${updatesFetchedAt - started}ms, ` +
        `index_updates=${updatesIndexedAt - updatesFetchedAt}ms, ` +
        `categories=${finishedAt - updatesIndexedAt}ms, ` +
        `update_keys=${preIndexed?.size ?? 0})`,
    );
    return { data: [pokemon, mlb, nfl, nba] };
  }

  private async fetchPriceUpdatesRaw(): Promise<unknown> {
    const since365 = new Date(Date.now() - 365 * 86400_000).toISOString();
    return this.cardhedger.forwardJson('POST', '/v1/cards/price-updates', {
      body: { since: since365, ignore_grades: ['Raw'] },
    });
  }

  /**
   * Parse `/v1/cards/price-updates` once into a `card_id → series[]` map.
   *
   * Current implementation (pre-optimisation) re-scanned the entire updates array
   * four times — once per category — inside `estimateWindowChangesFromUpdates`.
   * With a year of updates that's tens of thousands of records × 4, which is
   * wasteful CPU on the hot rebuild path.
   *
   * Here we pay that cost once; each inner series is a single `(cardId, grade)`
   * combo sorted ascending by timestamp so downstream can just slice by window.
   */
  private indexUpdatesByCard(body: unknown): UpdatesByCard {
    const updates = Array.isArray((body as { updates?: unknown[] })?.updates)
      ? ((body as { updates: unknown[] }).updates ?? [])
      : [];
    const flat = new Map<string, PriceSeries>(); // key: `${cardId}::${grade}`
    for (const u of updates) {
      if (typeof u !== 'object' || u == null) continue;
      const cardId = String((u as { card_id?: unknown }).card_id ?? '').trim();
      if (!cardId) continue;
      const grade = String((u as { grade?: unknown }).grade ?? '')
        .trim()
        .toUpperCase();
      if (!grade) continue;
      const tRaw = (u as { update_timestamp?: unknown }).update_timestamp;
      const pRaw = (u as { price?: unknown }).price;
      const t = typeof tRaw === 'string' ? Date.parse(tRaw) : NaN;
      const p = this.toNumber(pRaw);
      if (!Number.isFinite(t) || p == null || p <= 0) continue;
      const k = `${cardId}::${grade}`;
      const arr = flat.get(k);
      if (arr) {
        arr.push({ t: Math.floor(t / 1000), p });
      } else {
        flat.set(k, [{ t: Math.floor(t / 1000), p }]);
      }
    }
    const byCard: UpdatesByCard = new Map();
    for (const [key, arr] of flat) {
      arr.sort((a, b) => a.t - b.t);
      const sep = key.indexOf('::');
      const cardId = sep > 0 ? key.slice(0, sep) : key;
      const bucket = byCard.get(cardId);
      if (bucket) bucket.push(arr);
      else byCard.set(cardId, [arr]);
    }
    return byCard;
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

  /**
   * Compute window % changes from the pre-indexed updates map (no API calls).
   * Replaces the old `estimateWindowChangesFromUpdates` which re-scanned the
   * whole updates array per category on every rebuild.
   */
  private estimateWindowChangesFromIndexedUpdates(
    rows: CardRow[],
    preIndexed: UpdatesByCard | null,
  ): Record<WindowDays, number | null> {
    const out: Record<WindowDays, number | null> = {
      7: null,
      30: null,
      90: null,
      180: null,
      365: null,
    };
    if (!preIndexed || preIndexed.size === 0) return out;

    // Pull just this category's series out of the shared index (O(cards-in-cat)).
    const relevant: PriceSeries[] = [];
    for (const r of rows) {
      const cardId = this.pickCardId(r);
      if (!cardId) continue;
      const bucket = preIndexed.get(cardId);
      if (!bucket) continue;
      for (const s of bucket) {
        if (s.length >= 2) relevant.push(s);
      }
    }
    if (relevant.length === 0) return out;

    const latestSec = Math.floor(Date.now() / 1000);
    for (const d of WINDOWS_DAYS) {
      const windowStart = latestSec - d * 86400;
      const deltas: Array<{ value: number; weight: number }> = [];
      for (const arr of relevant) {
        // arr is already sorted ascending from indexUpdatesByCard — find first
        // in-window point with a linear scan from the left (tiny per-series).
        let firstIdx = -1;
        for (let i = 0; i < arr.length; i += 1) {
          if (arr[i]!.t >= windowStart) {
            firstIdx = i;
            break;
          }
        }
        if (firstIdx < 0) continue;
        if (arr.length - firstIdx < 2) continue;
        const first = arr[firstIdx]!;
        const last = arr[arr.length - 1]!;
        const p = this.pct(first.p, last.p);
        if (p != null) deltas.push({ value: p, weight: Math.max(1, last.p) });
      }
      out[d] = this.weightedMean(deltas);
    }
    return out;
  }

  private async fetchCategoryIndex(params: {
    id: string;
    name: string;
    category: string;
    preIndexed: UpdatesByCard | null;
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

    // Synchronous in-memory derivation — no extra API calls here.
    const updates = this.estimateWindowChangesFromIndexedUpdates(rows, params.preIndexed);
    const updatesAllMissing = WINDOWS_DAYS.every((d) => updates[d] == null);
    // Cardhedger occasionally returns a flat 365d delta when the stream only has
    // recent updates — treat that as effectively missing for the 365d bucket.
    const hasSuspiciousFlat365 = updates[365] != null && Math.abs(updates[365]!) < 0.01;
    const gains: Record<WindowDays, number | null> = {
      7: updates[7],
      30: updates[30],
      90: updates[90],
      180: updates[180],
      365: updates[365],
    };

    // History fallback is expensive (N sample cards × /v1/cards/prices-by-card).
    // Previously we triggered this whenever *any* single window was null, which
    // doubled the rebuild cost. Restrict to the two cases where the updates signal
    // is genuinely unusable: everything null, or the 365d window looks bogus.
    const needsHistoryFallback = updatesAllMissing || hasSuspiciousFlat365;
    if (needsHistoryFallback) {
      const histFallback = await this.estimateWindowChangesFromHistory(rows);
      if (updatesAllMissing) {
        for (const d of WINDOWS_DAYS) {
          if (histFallback[d] != null) gains[d] = histFallback[d]!;
        }
      } else if (hasSuspiciousFlat365 && histFallback[365] != null) {
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
          h != null && u != null
            ? Number((h * 0.75 + u * 0.25).toFixed(4))
            : h != null
              ? h
              : u ?? null;
      }
    }
    const round2 = (v: number | null): number | null => {
      if (v == null || !Number.isFinite(v)) return null;
      return Number(v.toFixed(2));
    };
    return {
      id: params.id,
      name: params.name,
      game_value_usd: Number(total.toFixed(2)),
      game_value_change_7d_pct: round2(gains[7]),
      game_value_change_30d_pct: round2(gains[30]),
      game_value_change_90d_pct: round2(gains[90]),
      game_value_change_180d_pct: round2(gains[180]),
      game_value_change_365d_pct: round2(gains[365]),
    };
  }

  private async rebuildCache(): Promise<{ data: CardhedgerGameIndexRow[] }> {
    if (this.inflight) return this.inflight;
    this.inflight = this.buildDashboardIndexes()
      .then((value) => {
        this.cacheValue = value;
        this.cacheUpdatedAtMs = Date.now();
        // Persist so the next server boot serves stale-immediately instead of
        // blocking another 5–15 s rebuild for the first dashboard request.
        this.persistToDisk(value, this.cacheUpdatedAtMs);
        return value;
      })
      .finally(() => {
        this.inflight = null;
      });
    return this.inflight;
  }

  /**
   * Serve the in-memory (or disk-hydrated) cache. User traffic never triggers a
   * rebuild — that's handled exclusively by the scheduled refresh (default 24h)
   * and the initial pre-warm. Admins can still force a fresh fetch via
   * `?refresh=1` for operational overrides.
   *
   * Cold-start fallback: if the server is brand-new *and* no disk cache exists
   * (e.g. first-ever deploy to a fresh host), we block once on a synchronous
   * rebuild. After that first rebuild, hydrate-from-disk guarantees subsequent
   * restarts always have something to serve immediately.
   */
  async getDashboardIndexes(opts?: {
    forceRefresh?: boolean;
  }): Promise<{ data: CardhedgerGameIndexRow[] }> {
    this.cardhedger.assertConfigured();
    if (opts?.forceRefresh) {
      return this.rebuildCache();
    }
    if (this.cacheValue) {
      return this.cacheValue;
    }
    // First-ever boot with an empty disk cache. This happens at most once per host.
    return this.rebuildCache();
  }
}

