import type { CollectionUsdPoint } from "@/lib/core";

/** Matches backend {@link ChartHistoryWindow} / API `priceHistoryDuration`. */
export type ChartBundleDuration =
  | "7d"
  | "30d"
  | "90d"
  | "180d"
  | "365d"
  | "max";

const SEC_DAY = 86_400;

/** Aligned with backend `CHART_FULL_COMPS_ARCHIVE_MAX_DAYS`. */
export const CHART_COMPS_ARCHIVE_MAX_DAYS = 4000;

function daysForChartWindow(window: ChartBundleDuration): number {
  switch (window) {
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
    case "180d":
      return 180;
    case "365d":
      return 365;
    case "max":
      return CHART_COMPS_ARCHIVE_MAX_DAYS;
    default:
      return 30;
  }
}

/**
 * Clip comps-merged snapshot series to a chart toolbar window (anchored to latest sale).
 * Fetch once with `max`, then call this per 7D…MAX for consistent merged data.
 */
export function filterMergedChartPointsForWindow(
  points: CollectionUsdPoint[] | null | undefined,
  window: ChartBundleDuration,
): CollectionUsdPoint[] {
  const cleaned = (points ?? []).filter(
    (p) => Number.isFinite(p.t) && Number.isFinite(p.v) && p.v > 0,
  );
  if (cleaned.length === 0) return [];

  const sorted = [...cleaned].sort((a, b) => a.t - b.t);
  const lastT = sorted[sorted.length - 1]!.t;
  const maxDays = daysForChartWindow(window);
  const cutoff = lastT - maxDays * SEC_DAY;
  return sorted.filter((p) => p.t >= cutoff);
}
