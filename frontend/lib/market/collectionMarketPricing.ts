import type { CollectionMarketStats, CollectionUsdPoint } from "@/lib/core";

/** Shown when catalog / reference USD cannot be resolved (not a prose explanation). */
export const NO_EXTERNAL_PRICE = "N/A";

/** Catalog / Cardhedger / 30D median — drop cents (`$39.99` → `$39`). */
export function formatUsdCompact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${Math.trunc(n).toLocaleString("en-US")}`;
}

/** On-platform ask, bid, or listed sale — whole dollars only. */
export function formatUsdListing(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/** Hero velocity — whole % (reference window change). */
export function formatVelocityPercent(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  const rounded = Math.round(pct);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}%`;
}

/**
 * On-platform listing depth (same collectionKey). Not a catalog price; optional UI hint only.
 */
export function formatLiquidityDepthLabel(stats: CollectionMarketStats | null | undefined): string | null {
  if (!stats || stats.sampleSize <= 0) return null;
  const strength = stats.isReliable ? "Strong" : "Light";
  const n = stats.sampleSize;
  return `${n} on-platform listing${n === 1 ? "" : "s"} · ${strength} depth`;
}
