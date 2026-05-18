import type { MarketPriceHistoryPoint } from "@/lib/core";

const DAY_SEC = 86400;
export const MARKET_INDEX_COMPARISON_DAYS = 365;

export type GameIndexComparisonSeries = {
  points: MarketPriceHistoryPoint[];
  changePct: number;
  comparisonAnchorLabel: string;
};

/**
 * Two-point series from the aggregate 365d % returned by the backend (Cardhedger-derived).
 * No compounding from shorter windows — avoids misleading synthetic “1Y” figures.
 */
export function buildGameIndexComparisonSeries(params: {
  valueUsd: number;
  change365dPct?: number | null;
  comparisonDays?: number;
}): GameIndexComparisonSeries {
  const comparisonDays = params.comparisonDays ?? MARKET_INDEX_COMPARISON_DAYS;
  const v = params.valueUsd;
  const now = Math.floor(Date.now() / 1000);
  const t0 = now - comparisonDays * DAY_SEC;
  const anchor = "vs ~1 year ago (Cardhedger index)";
  const r365 = params.change365dPct;
  if (
    !Number.isFinite(v) ||
    v <= 0 ||
    r365 == null ||
    typeof r365 !== "number" ||
    !Number.isFinite(r365)
  ) {
    return { points: [], changePct: NaN, comparisonAnchorLabel: anchor };
  }
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

export function buildGameIndexSparklinePoints(params: {
  valueUsd: number;
  change365dPct?: number | null;
  comparisonDays?: number;
}): MarketPriceHistoryPoint[] {
  return buildGameIndexComparisonSeries({
    valueUsd: params.valueUsd,
    change365dPct: params.change365dPct,
    comparisonDays: params.comparisonDays,
  }).points;
}
