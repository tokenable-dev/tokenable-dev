/**
 * Collection detail (and aligned views): external market NM history + chart x-axis use the same window.
 * Many cards only have a few months of eBay NM history — a **90d** window avoids a year-wide axis
 * with an empty left side when upstream points are recent-only.
 */
export const CHART_EXTERNAL_HISTORY = "90d" as const;

export type ChartExternalHistory = typeof CHART_EXTERNAL_HISTORY;

export const CHART_EXTERNAL_HISTORY_DAYS = 90 as const;

const WINDOW_SEC = CHART_EXTERNAL_HISTORY_DAYS * 86400;

export function chartDisplayWindowStartSec(nowSec = Math.floor(Date.now() / 1000)): number {
  return nowSec - WINDOW_SEC;
}
