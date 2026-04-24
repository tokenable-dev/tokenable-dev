import type { CollectionMarketStats, CollectionUsdPoint } from "@/lib/api";

/** Legacy copy — prefer {@link NO_EXTERNAL_PRICE} for catalog/spot paths. */
export const INSUFFICIENT_MARKET_DATA = "Insufficient market data";

export const NO_EXTERNAL_PRICE = "No external price available";

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

/** @deprecated Pool band is not shown as “market price”; kept for rare admin-style views. */
export function formatListingPoolBandLabel(stats: CollectionMarketStats | null | undefined): string | null {
  if (!stats?.isReliable) return null;
  const lo = stats.band.low ?? stats.p25;
  const hi = stats.band.high ?? stats.p75;
  if (lo == null || hi == null || !Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  return `${formatUsdCompact(lo)} – ${formatUsdCompact(hi)} (p25–p75)`;
}

/**
 * Illustrative polyline for the chart: p25 → median → p75 over the window (distribution, not a time series).
 */
export function buildListingPoolDistributionPolyline(
  stats: CollectionMarketStats | null | undefined,
  windowDays = 90,
): CollectionUsdPoint[] {
  if (!stats?.isReliable) return [];
  const lo = stats.band.low ?? stats.p25;
  const mid = stats.median;
  const hi = stats.band.high ?? stats.p75;
  if (lo == null || mid == null || hi == null) return [];
  if (![lo, mid, hi].every((x) => Number.isFinite(x) && x > 0)) return [];
  const now = Math.floor(Date.now() / 1000);
  const span = Math.max(1, windowDays) * 86400;
  const t0 = now - span;
  const t1 = now - Math.round(span / 2);
  const t2 = now;
  return [
    { t: t0, v: lo },
    { t: t1, v: mid },
    { t: t2, v: hi },
  ];
}

/** CV% of listing prices (liquidity dispersion), not external NM validity. */
export function listingPoolVolatilityCvPct(stats: CollectionMarketStats | null | undefined): number | null {
  const m = stats?.median;
  const v = stats?.volatility;
  if (m == null || v == null || !(m > 0) || !Number.isFinite(v)) return null;
  return (v / m) * 100;
}
