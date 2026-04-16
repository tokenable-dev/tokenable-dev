/**
 * Single chart window for collection price comparison (no day/week toggles).
 * JustTCG `priceHistoryDuration` max is **180d** (API); we request once at that length.
 */
export const CHART_EXTERNAL_HISTORY = "180d" as const;

export type ChartExternalHistory = typeof CHART_EXTERNAL_HISTORY;

const WINDOW_SEC = 180 * 86400;

export function chartDisplayWindowStartSec(nowSec = Math.floor(Date.now() / 1000)): number {
  return nowSec - WINDOW_SEC;
}
