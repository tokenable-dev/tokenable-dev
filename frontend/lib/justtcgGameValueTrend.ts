import type { JustTcgPriceHistoryPoint } from "@/lib/api";

const DAY_SEC = 86400;

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

export type GameIndex180dSeries = {
  /** Two points: ~180d ago → now (aggregate index USD). */
  points: JustTcgPriceHistoryPoint[];
  /** % change from first to last point. */
  changePct: number;
  /** Shown next to the chart (sparkline spans ~180 calendar days). */
  comparisonAnchorLabel: string;
};

/**
 * Sparkline + % for aggregate game index (`game_value_usd`) vs ~180d ago.
 * Uses `game_value_change_180d_pct` when JustTCG includes it; otherwise estimates
 * past value by compounding published trailing returns (90d×2, else 30d×6, else 7d×(180/7)).
 */
/**
 * Sparkline path: same ~180d window and headline % as
 * {@link buildGameIndex180dComparisonSeries}, but adds intermediate samples at
 * ~90d / ~30d / ~7d from trailing returns so the line is not a single straight
 * segment (still modelled from published aggregates, not tick-level history).
 */
export function buildGameIndexSparklinePoints(params: {
  valueUsd: number;
  change7dPct: number;
  change30dPct: number;
  change90dPct: number;
  change180dPct?: number;
  rawChange90dPct?: number;
  rawChange30dPct?: number;
}): JustTcgPriceHistoryPoint[] {
  const series = buildGameIndex180dComparisonSeries({
    valueUsd: params.valueUsd,
    change7dPct: params.change7dPct,
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

export function buildGameIndex180dComparisonSeries(params: {
  valueUsd: number;
  change7dPct: number;
  change180dPct?: number;
  rawChange90dPct?: number;
  rawChange30dPct?: number;
}): GameIndex180dSeries {
  const v = params.valueUsd;
  const now = Math.floor(Date.now() / 1000);
  const t0 = now - 180 * DAY_SEC;

  const anchor = "vs ~6 months ago";

  if (!Number.isFinite(v) || v <= 0) {
    return { points: [], changePct: 0, comparisonAnchorLabel: anchor };
  }

  if (
    params.change180dPct !== undefined &&
    Number.isFinite(params.change180dPct)
  ) {
    const r180 = params.change180dPct;
    const past = v / (1 + r180 / 100);
    return {
      points: [
        { p: past, t: t0 },
        { p: v, t: now },
      ],
      changePct: r180,
      comparisonAnchorLabel: anchor,
    };
  }

  if (
    params.rawChange90dPct !== undefined &&
    Number.isFinite(params.rawChange90dPct)
  ) {
    const r90 = params.rawChange90dPct;
    const past = v / (1 + r90 / 100) ** 2;
    const pct = ((v / past - 1) * 100);
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
    const past = v / (1 + r30 / 100) ** 6;
    const pct = ((v / past - 1) * 100);
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
  const periods = 180 / 7;
  const past = v / (1 + r7 / 100) ** periods;
  const pct = ((v / past - 1) * 100);
  return {
    points: [
      { p: past, t: t0 },
      { p: v, t: now },
    ],
    changePct: pct,
    comparisonAnchorLabel: anchor,
  };
}
