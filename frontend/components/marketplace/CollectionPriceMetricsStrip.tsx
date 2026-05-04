"use client";

import type { CollectionMarketStats } from "@/lib/core";
import {
  formatLiquidityDepthLabel,
  formatUsdCompact,
  NO_EXTERNAL_PRICE,
} from "@/lib/market";

function metricVolatilityFromPrices(usdValues: number[]): number | null {
  const vals = usdValues.filter((v) => Number.isFinite(v) && v > 0);
  if (vals.length < 3) return null;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  if (mean <= 0) return null;
  const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
  const cv = (Math.sqrt(variance) / mean) * 100;
  if (!Number.isFinite(cv)) return null;
  return Math.min(999, Math.round(cv * 10) / 10);
}

export interface CollectionPriceMetricsStripProps {
  /** Primary spot from external market source (Cardhedger-backed). */
  externalMarketUsd?: number | null;
  externalPriceSource?: string | null;
  /** e.g. "PSA 9" for chart / strip alignment */
  marketTierDisplay?: string | null;
  /** When external price is catalog-matched, mirrors preview `matchConfidence`. */
  externalMarketMatchConfidence?: "verified" | "approximate" | null;
  externalPriceLoading?: boolean;
  /** CV% from external tier daily history. */
  externalVolatilityCvPct?: number | null;
  /** e.g. "~1y Cardhedger tier daily closes" */
  volatilityFootnote?: string | null;
  /** Fallback when external series is too short */
  platformPriceSamples?: number[];
  bookSpreadPct?: number | null;
  /** Listing pool — liquidity hint only */
  marketStats?: CollectionMarketStats | null;
  marketStatsLoading?: boolean;
  /** % change: oldest → newest point in ~1y external tier series vs current strip spot */
  externalPriceChange1yPct?: number | null;
  externalPriceChange1yLoading?: boolean;
  /** Human-readable comparison basis shown under the Price change label. */
  externalPriceChangeBasisText?: string | null;
  marketCapUsd?: number | null;
  /** How market cap was derived (PSA pop × tier spot, etc.) */
  marketCapMethodHint?: string | null;
  showPriceChange?: boolean;
  showVolatility?: boolean;
  showMarketCap?: boolean;
  compact?: boolean;
  formatMarketCap: (usd: number | null) => string;
}

export function CollectionPriceMetricsStrip({
  externalMarketUsd = null,
  externalPriceLoading = false,
  externalVolatilityCvPct = null,
  platformPriceSamples = [],
  bookSpreadPct = null,
  marketStats = null,
  marketStatsLoading = false,
  externalPriceChange1yPct = null,
  externalPriceChange1yLoading = false,
  externalPriceChangeBasisText = "From First Data",
  marketCapUsd = null,
  showPriceChange = true,
  showVolatility = true,
  showMarketCap = true,
  compact = false,
  formatMarketCap,
}: CollectionPriceMetricsStripProps) {
  const volFromTrades = metricVolatilityFromPrices(platformPriceSamples);
  const volatilityPct =
    externalVolatilityCvPct != null && Number.isFinite(externalVolatilityCvPct)
      ? externalVolatilityCvPct
      : volFromTrades ?? bookSpreadPct;

  const change = externalPriceChange1yPct;
  const changeUp = change != null && change > 0;
  const changeDown = change != null && change < 0;

  const showExternalPrimary =
    externalMarketUsd != null &&
    Number.isFinite(externalMarketUsd) &&
    externalMarketUsd > 0;

  const visibleMetricCount =
    1 + (showPriceChange ? 1 : 0) + (showVolatility ? 1 : 0) + (showMarketCap ? 1 : 0);
  const gridClass =
    visibleMetricCount <= 1
      ? "grid-cols-1"
      : visibleMetricCount === 2
        ? "grid-cols-2"
        : visibleMetricCount === 3
          ? "grid-cols-2 sm:grid-cols-3"
          : "grid-cols-2 sm:grid-cols-4";

  const valueMainClass = compact
    ? "w-full text-[clamp(0.88rem,2.7vw,1.15rem)] leading-none font-bold tabular-nums tracking-tight text-zinc-50 whitespace-nowrap"
    : "w-full text-[clamp(1.05rem,4vw,2.05rem)] leading-none font-bold tabular-nums tracking-tight text-zinc-50 whitespace-nowrap";
  const valueSubClass = compact
    ? "w-full text-[clamp(0.82rem,2.5vw,1.05rem)] leading-none font-bold tabular-nums tracking-tight whitespace-nowrap"
    : "w-full text-[clamp(1rem,3.6vw,1.75rem)] leading-none font-bold tabular-nums tracking-tight whitespace-nowrap";
  const labelClass = compact
    ? "text-[10px] font-semibold tracking-wide text-slate-300 mb-1.5"
    : "text-xs font-semibold tracking-wide text-slate-200 mb-1.5";

  return (
    <div className={`grid ${gridClass} gap-3 sm:gap-4 w-full min-w-0 mb-4`}>
      <div className="min-w-0 overflow-hidden rounded-2xl border border-emerald-900/40 bg-zinc-950/90 px-4 py-4 min-h-[118px] flex flex-col justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <p className={labelClass}>Market price</p>
        {externalPriceLoading && !showExternalPrimary ? (
          <div className="h-11 w-36 animate-pulse rounded-md bg-zinc-800/70" />
        ) : showExternalPrimary ? (
          <p className={valueMainClass}>
            {formatUsdCompact(externalMarketUsd)}
          </p>
        ) : (
          <p className="text-lg font-semibold leading-snug text-zinc-500">{NO_EXTERNAL_PRICE}</p>
        )}
      </div>

      {showPriceChange ? (
        <div className="min-w-0 overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-950/80 px-4 py-4 min-h-[118px] flex flex-col justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <p className={labelClass}>Historical Change</p>
          <p className="mb-1.5 text-[10px] leading-tight text-zinc-500">
            {externalPriceChangeBasisText ?? "—"}
          </p>
          {externalPriceChange1yLoading && change == null ? (
            <div className="h-9 w-24 animate-pulse rounded-md bg-zinc-800/70" />
          ) : (
            <p
              className={`${valueSubClass} ${
                change == null || !Number.isFinite(change)
                  ? "text-zinc-500"
                  : changeUp
                    ? "text-emerald-300"
                    : changeDown
                      ? "text-rose-300"
                      : "text-zinc-100"
              }`}
            >
              {change != null && Number.isFinite(change) ? (
                <>
                  {change > 0 ? "+" : ""}
                  {change.toFixed(1)}%
                </>
              ) : (
                "—"
              )}
            </p>
          )}
        </div>
      ) : null}

      {showVolatility ? (
        <div className="min-w-0 overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-950/80 px-4 py-4 min-h-[118px] flex flex-col justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <p className={labelClass}>Volatility</p>
          <p className={`${valueSubClass} text-sky-200`}>
            {volatilityPct != null && Number.isFinite(volatilityPct)
              ? `${volatilityPct.toFixed(0)}%`
              : "—"}
          </p>
        </div>
      ) : null}

      {showMarketCap ? (
        <div className="min-w-0 overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-950/80 px-4 py-4 min-h-[118px] flex flex-col justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <p className={labelClass}>Market cap</p>
          <p className={`${valueSubClass} text-amber-100/95`}>
            {formatMarketCap(marketCapUsd)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
