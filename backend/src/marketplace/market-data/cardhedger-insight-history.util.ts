/** Slice ascending price history to the last `days` calendar window. */
export function slicePriceHistoryByDays(
  pts: Array<{ t: number; v: number }>,
  days: number,
): Array<{ t: number; v: number }> {
  const d = Math.max(1, Math.floor(days));
  if (!Array.isArray(pts) || pts.length === 0) return [];
  const cutoff = Math.floor(Date.now() / 1000) - d * 86_400;
  return pts.filter((p) => p.t >= cutoff);
}
