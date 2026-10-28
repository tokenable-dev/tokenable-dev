import type { CollectionMarketStats, CollectionUsdPoint } from "@/lib/core";
import { formatDisplayMoney, formatUsdcAmount } from "@/lib/market/displayMoney";

/** Shown when catalog / reference USD cannot be resolved (not a prose explanation). */
export const NO_EXTERNAL_PRICE = "N/A";

/**
 * Catalog / market reference USD. Converted for display with the latest ECB rate.
 * Call `useDisplayFx()` in memoized components so a currency change rerenders them.
 */
export function formatUsdCompact(n: number | null | undefined): string {
  return formatDisplayMoney(n);
}

/** On-platform ask, bid, or listed sale. This is the USDC payment, not a reference price. */
export function formatUsdListing(n: number | null | undefined): string {
  return formatUsdcAmount(n);
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
