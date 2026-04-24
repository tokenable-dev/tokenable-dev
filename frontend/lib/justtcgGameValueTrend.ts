import type { JustTcgPriceHistoryPoint } from "@/lib/api";

const DAY_SEC = 86400;

/** Market index cards: compare “now” vs this many calendar days ago (landing). */
export const MARKET_INDEX_COMPARISON_DAYS = 365;

/**
 * Builds a 4-point series of implied total market value (USD) from current
 * `game_value_usd` and JustTCG aggregate % changes (7d / 30d / 90d windows).
 * V_past ≈ V_now / (1 + r/100). Same data as the headline stats — usable when
 * per-card `priceHistory` is missing (common on list/search endpoints).
 */
export function buildImpliedGameValueTrend(params: {
  valueUsd: number;
  change7dPct: number;
  change30dPct: number;
  change90dPct: number;
}): JustTcgPriceHistoryPoint[] {
  const vNow = params.valueUsd;
  if (!Number.isFinite(vNow) || vNow <= 0) return [];

  const r7 = safePct(params.change7dPct);
  const r30 = safePct(params.change30dPct);
  const r90 = safePct(params.change90dPct);

  const now = Math.floor(Date.now() / 1000);
  const v7 = vNow / (1 + r7 / 100);
  const v30 = vNow / (1 + r30 / 100);
  const v90 = vNow / (1 + r90 / 100);

  return [
    { p: v90, t: now - 90 * DAY_SEC },
    { p: v30, t: now - 30 * DAY_SEC },
    { p: v7, t: now - 7 * DAY_SEC },
    { p: vNow, t: now },
  ];
}

function safePct(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

export type GameIndexComparisonSeries = {
  points: JustTcgPriceHistoryPoint[];
  changePct: number;
  comparisonAnchorLabel: string;
};

/** @deprecated Use {@link GameIndexComparisonSeries} */
export type GameIndex180dSeries = GameIndexComparisonSeries;

/**
 * Sparkline + % for aggregate game index (`game_value_usd`) vs {@link MARKET_INDEX_COMPARISON_DAYS} ago.
 * Uses `game_value_change_365d_pct` when JustTCG includes it; else compounds `game_value_change_180d_pct`
 * over (365/180) periods, then 90d / 30d / 7d windows scaled to the same horizon — **not tick-level history**.
 */
export function buildGameIndexComparisonSeries(params: {
  valueUsd: number;
  change7dPct: number;
  comparisonDays?: number;
  change365dPct?: number;
  change180dPct?: number;
  rawChange90dPct?: number;
  rawChange30dPct?: number;
}): GameIndexComparisonSeries {
  const comparisonDays = params.comparisonDays ?? MARKET_INDEX_COMPARISON_DAYS;
  const v = params.valueUsd;
  const now = Math.floor(Date.now() / 1000);
  const t0 = now - comparisonDays * DAY_SEC;
  const anchor =
    comparisonDays >= 330 ? "vs ~1 year ago" : "vs ~6 months ago";

  if (!Number.isFinite(v) || v <= 0) {
    return { points: [], changePct: 0, comparisonAnchorLabel: anchor };
  }

  if (
    params.change365dPct !== undefined &&
    Number.isFinite(params.change365dPct) &&
    comparisonDays >= 300
  ) {
    const r365 = params.change365dPct;
    const past = v / (1 + r365 / 100);
    return {
      points: [
        { p: past, t: t0 },
        { p: v, t: now },
      ],
      changePct: r365,
      comparisonAnchorLabel: anchor,
    };
  }

  if (params.change180dPct !== undefined && Number.isFinite(params.change180dPct)) {
    const r180 = params.change180dPct;
    const periods = comparisonDays / 180;
    const past = v / (1 + r180 / 100) ** periods;
    const pct = (v / past - 1) * 100;
    return {
      points: [
        { p: past, t: t0 },
        { p: v, t: now },
      ],
      changePct: pct,
      comparisonAnchorLabel: anchor,
    };
  }

  if (
    params.rawChange90dPct !== undefined &&
    Number.isFinite(params.rawChange90dPct)
  ) {
    const r90 = params.rawChange90dPct;
    const periods = comparisonDays / 90;
    const past = v / (1 + r90 / 100) ** periods;
    const pct = (v / past - 1) * 100;
    return {
      points: [
        { p: past, t: t0 },
        { p: v, t: now },
      ],
      changePct: pct,
      comparisonAnchorLabel: anchor,
    };
  }

  if (
    params.rawChange30dPct !== undefined &&
    Number.isFinite(params.rawChange30dPct)
  ) {
    const r30 = params.rawChange30dPct;
    const periods = comparisonDays / 30;
    const past = v / (1 + r30 / 100) ** periods;
    const pct = (v / past - 1) * 100;
    return {
      points: [
        { p: past, t: t0 },
        { p: v, t: now },
      ],
      changePct: pct,
      comparisonAnchorLabel: anchor,
    };
  }

  const r7 = safePct(params.change7dPct);
  const periods = comparisonDays / 7;
  const past = v / (1 + r7 / 100) ** periods;
  const pct = (v / past - 1) * 100;
  return {
    points: [
      { p: past, t: t0 },
      { p: v, t: now },
    ],
    changePct: pct,
    comparisonAnchorLabel: anchor,
  };
}

/**
 * @deprecated Use {@link buildGameIndexComparisonSeries} (defaults to 1y).
 * Kept for any external imports; passes `comparisonDays: 180`.
 */
export function buildGameIndex180dComparisonSeries(params: {
  valueUsd: number;
  change7dPct: number;
  change180dPct?: number;
  rawChange90dPct?: number;
  rawChange30dPct?: number;
}): GameIndexComparisonSeries {
  return buildGameIndexComparisonSeries({
    ...params,
    comparisonDays: 180,
  });
}

/**
 * Sparkline path: same horizon as {@link buildGameIndexComparisonSeries}, plus intermediate
 * samples at ~90d / ~30d / ~7d from trailing returns so the line is not a single straight segment.
 */
export function buildGameIndexSparklinePoints(params: {
  valueUsd: number;
  change7dPct: number;
  change30dPct: number;
  change90dPct: number;
  comparisonDays?: number;
  change365dPct?: number;
  change180dPct?: number;
  rawChange90dPct?: number;
  rawChange30dPct?: number;
}): JustTcgPriceHistoryPoint[] {
  const series = buildGameIndexComparisonSeries({
    valueUsd: params.valueUsd,
    change7dPct: params.change7dPct,
    comparisonDays: params.comparisonDays ?? MARKET_INDEX_COMPARISON_DAYS,
    change365dPct: params.change365dPct,
    change180dPct: params.change180dPct,
    rawChange90dPct: params.rawChange90dPct,
    rawChange30dPct: params.rawChange30dPct,
  });
  if (series.points.length < 2) return series.points;

  const left = series.points[0]!;
  const right = series.points[series.points.length - 1]!;

  const implied = buildImpliedGameValueTrend({
    valueUsd: params.valueUsd,
    change7dPct: params.change7dPct,
    change30dPct: params.change30dPct,
    change90dPct: params.change90dPct,
  });

  const inner = implied.filter((q) => q.t > left.t);
  const merged = [left, ...inner].sort((a, b) => a.t - b.t);

  const out: JustTcgPriceHistoryPoint[] = [];
  for (const p of merged) {
    if (out.length && out[out.length - 1]!.t === p.t) {
      out[out.length - 1] = p;
    } else {
      out.push(p);
    }
  }

  if (!out.length) return series.points;

  const last = out[out.length - 1]!;
  if (last.t === right.t) {
    out[out.length - 1] = right;
  } else {
    out.push(right);
  }

  return out;
}
