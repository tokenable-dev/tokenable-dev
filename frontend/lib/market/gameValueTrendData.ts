import type { MarketPriceHistoryPoint } from "@/lib/core";

const DAY_SEC = 86400;
export const MARKET_INDEX_COMPARISON_DAYS = 365;

export function buildImpliedGameValueTrend(params: {
  valueUsd: number;
  change7dPct: number;
  change30dPct: number;
  change90dPct: number;
}): MarketPriceHistoryPoint[] {
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
  points: MarketPriceHistoryPoint[];
  changePct: number;
  comparisonAnchorLabel: string;
};

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
  const anchor = comparisonDays >= 330 ? "vs ~1 year ago" : "vs ~6 months ago";
  if (!Number.isFinite(v) || v <= 0) return { points: [], changePct: 0, comparisonAnchorLabel: anchor };
  if (params.change365dPct !== undefined && Number.isFinite(params.change365dPct) && comparisonDays >= 300) {
    const past = v / (1 + params.change365dPct / 100);
    return { points: [{ p: past, t: t0 }, { p: v, t: now }], changePct: params.change365dPct, comparisonAnchorLabel: anchor };
  }
  if (params.change180dPct !== undefined && Number.isFinite(params.change180dPct)) {
    const periods = comparisonDays / 180;
    const past = v / (1 + params.change180dPct / 100) ** periods;
    return { points: [{ p: past, t: t0 }, { p: v, t: now }], changePct: (v / past - 1) * 100, comparisonAnchorLabel: anchor };
  }
  if (params.rawChange90dPct !== undefined && Number.isFinite(params.rawChange90dPct)) {
    const periods = comparisonDays / 90;
    const past = v / (1 + params.rawChange90dPct / 100) ** periods;
    return { points: [{ p: past, t: t0 }, { p: v, t: now }], changePct: (v / past - 1) * 100, comparisonAnchorLabel: anchor };
  }
  if (params.rawChange30dPct !== undefined && Number.isFinite(params.rawChange30dPct)) {
    const periods = comparisonDays / 30;
    const past = v / (1 + params.rawChange30dPct / 100) ** periods;
    return { points: [{ p: past, t: t0 }, { p: v, t: now }], changePct: (v / past - 1) * 100, comparisonAnchorLabel: anchor };
  }
  const r7 = safePct(params.change7dPct);
  const periods = comparisonDays / 7;
  const past = v / (1 + r7 / 100) ** periods;
  return { points: [{ p: past, t: t0 }, { p: v, t: now }], changePct: (v / past - 1) * 100, comparisonAnchorLabel: anchor };
}

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
}): MarketPriceHistoryPoint[] {
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
  const out: MarketPriceHistoryPoint[] = [];
  for (const p of merged) {
    if (out.length && out[out.length - 1]!.t === p.t) out[out.length - 1] = p;
    else out.push(p);
  }
  if (!out.length) return series.points;
  const last = out[out.length - 1]!;
  if (last.t === right.t) out[out.length - 1] = right;
  else out.push(right);
  return out;
}

