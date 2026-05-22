/** Product-wide label for external / reference price % change tiles. */
export const MARKET_PRICE_CHANGE_PERIOD_LABEL = "1 mo";

/** Compact suffix for badges (exchange cards, pills). */
export const MARKET_PRICE_CHANGE_PERIOD_SHORT = "1mo";

/** When 1 mo reference % cannot be computed (insufficient Cardhedger history). */
export const REFERENCE_CHANGE_UNAVAILABLE_LABEL = "No history";

export const REFERENCE_CHANGE_UNAVAILABLE_HINT =
  "Not enough eBay reference price history to calculate a 1 mo change.";

/** ~30 calendar days — aligned with backend `30d` snapshot window. */
export const MARKET_PRICE_CHANGE_LAG_SEC = 30 * 86_400;

/** Batched collection snapshots used for {@link MARKET_PRICE_CHANGE_LAG_SEC} % change. */
export const MARKET_PRICE_CHANGE_SNAPSHOT_DURATION =
  "30d" as const;

/** Flat reference move (~0% over the window) — show explicit zero, not "no data". */
export const REFERENCE_CHANGE_FLAT_LABEL = "0.0%";

const FLAT_CHANGE_EPSILON_PCT = 0.05;

export function isFlatReferencePercentChange(pct: number): boolean {
  return Number.isFinite(pct) && Math.abs(pct) < FLAT_CHANGE_EPSILON_PCT;
}

export type ReferenceChangeTone = "up" | "down" | "flat";

export function referenceChangeTone(pct: number): ReferenceChangeTone {
  if (isFlatReferencePercentChange(pct)) return "flat";
  if (pct > 0) return "up";
  return "down";
}

export function formatReferencePercentChange(
  pct: number,
  decimals = 1,
): string {
  if (isFlatReferencePercentChange(pct)) return REFERENCE_CHANGE_FLAT_LABEL;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(decimals)}%`;
}
