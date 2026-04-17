import type {
  JustTcgCardRow,
  JustTcgCardsListResponse,
  JustTcgPriceHistoryPoint,
} from "@/lib/api";

/**
 * Chooses the variant with the longest `priceHistory` in a cards search response
 * (max granularity for index sparklines).
 */
export function pickLongestPriceHistory(
  response: JustTcgCardsListResponse,
): JustTcgPriceHistoryPoint[] | null {
  let best: JustTcgPriceHistoryPoint[] | null = null;
  for (const row of response.data ?? []) {
    for (const v of row.variants ?? []) {
      const ph = v.priceHistory;
      if (!ph?.length) continue;
      const sorted = [...ph].sort((a, b) => a.t - b.t);
      if (!best || sorted.length > best.length) best = sorted;
    }
  }
  return best && best.length >= 2 ? best : null;
}

/** First / last price change % over the selected history window. */
export function pctChangeOverSeries(points: JustTcgPriceHistoryPoint[]): number | null {
  if (points.length < 2) return null;
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const a = sorted[0]!.p;
  const b = sorted[sorted.length - 1]!.p;
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
  return ((b - a) / a) * 100;
}
