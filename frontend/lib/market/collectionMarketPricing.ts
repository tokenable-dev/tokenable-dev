import type { CollectionMarketStats, CollectionUsdPoint } from "@/lib/core";

/** Shown when catalog / reference USD cannot be resolved (not a prose explanation). */
export const NO_EXTERNAL_PRICE = "N/A";

export function formatUsdCompact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
