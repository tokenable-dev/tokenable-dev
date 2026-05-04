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
  /** Human-readable comparison basis shown under “% Change (1 yr)”. */
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
  externalPriceChangeBasisText = null,
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

  const valueUnifiedClass = compact
    ? "text-[1rem] sm:text-[1.08rem] font-bold tabular-nums tracking-tight leading-none whitespace-nowrap"
    : "text-[1.15rem] sm:text-[1.28rem] font-bold tabular-nums tracking-tight leading-none whitespace-nowrap";
  /** Same vertical slot for every label so values sit on one horizontal baseline across columns. */
  const labelSlotClass = compact
    ? "min-h-[2.15rem] flex items-end text-[9px] font-semibold tracking-wide text-white leading-snug pb-0.5"
    : "min-h-[2.5rem] flex items-end text-[10px] font-semibold tracking-wide text-white leading-snug pb-0.5";

  return (
    <div
      className={`grid ${gridClass} gap-1.5 sm:gap-2 w-full min-w-0 mb-2 sm:mb-2.5`}
    >
      <div className="min-w-0 overflow-hidden rounded-xl border border-emerald-900/40 bg-zinc-950/90 px-2.5 py-1.5 sm:px-3 sm:py-2 flex flex-col justify-end shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <p className={labelSlotClass}>Market price</p>
        {externalPriceLoading && !showExternalPrimary ? (
          <div className="h-[1.35rem] w-28 animate-pulse rounded bg-zinc-800/70" aria-hidden />
        ) : showExternalPrimary ? (
          <p className={`${valueUnifiedClass} text-white`}>{formatUsdCompact(externalMarketUsd)}</p>
        ) : (
          <p className={`${valueUnifiedClass} text-white`}>{NO_EXTERNAL_PRICE}</p>
        )}
      </div>

      {showPriceChange ? (
        <div className="min-w-0 overflow-hidden rounded-xl border border-zinc-700/80 bg-zinc-950/80 px-2.5 py-1.5 sm:px-3 sm:py-2 flex flex-col justify-end shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <p className={labelSlotClass}>% Change (1 yr)</p>
          {externalPriceChange1yLoading && change == null ? (
            <div className="h-[1.35rem] w-20 animate-pulse rounded bg-zinc-800/70" aria-hidden />
          ) : (
            <p
              className={`${valueUnifiedClass} ${
                change == null || !Number.isFinite(change)
                  ? "text-white"
                  : changeUp
                    ? "text-emerald-400"
                    : changeDown
                      ? "text-red-400"
                      : "text-white"
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
          {externalPriceChangeBasisText?.trim() ? (
            <p className="mt-0.5 line-clamp-2 text-[9px] leading-tight text-white/75">
              {externalPriceChangeBasisText.trim()}
            </p>
          ) : null}
        </div>
      ) : null}

      {showVolatility ? (
        <div className="min-w-0 overflow-hidden rounded-xl border border-zinc-700/80 bg-zinc-950/80 px-2.5 py-1.5 sm:px-3 sm:py-2 flex flex-col justify-end shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <p className={labelSlotClass}>Volatility</p>
          <p className={`${valueUnifiedClass} text-white`}>
            {volatilityPct != null && Number.isFinite(volatilityPct)
              ? `${volatilityPct.toFixed(0)}%`
              : "—"}
          </p>
        </div>
      ) : null}

      {showMarketCap ? (
        <div className="min-w-0 overflow-hidden rounded-xl border border-zinc-700/80 bg-zinc-950/80 px-2.5 py-1.5 sm:px-3 sm:py-2 flex flex-col justify-end shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <p className={labelSlotClass}>Market cap</p>
          <p className={`${valueUnifiedClass} text-white`}>{formatMarketCap(marketCapUsd)}</p>
        </div>
      ) : null}
    </div>
  );
}
