"use client";

import type { ReactNode } from "react";
import type { CollectionMarketStats } from "@/lib/core";
import { formatUsdCompact, NO_EXTERNAL_PRICE } from "@/lib/market";

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
  externalMarketUsd?: number | null;
  externalPriceSource?: string | null;
  marketTierDisplay?: string | null;
  externalMarketMatchConfidence?: "verified" | "approximate" | null;
  externalPriceLoading?: boolean;
  externalVolatilityCvPct?: number | null;
  volatilityFootnote?: string | null;
  platformPriceSamples?: number[];
  bookSpreadPct?: number | null;
  marketStats?: CollectionMarketStats | null;
  marketStatsLoading?: boolean;
  externalPriceChange1yPct?: number | null;
  externalPriceChange1yLoading?: boolean;
  externalPriceChangeBasisText?: string | null;
  marketCapUsd?: number | null;
  marketCapMethodHint?: string | null;
  showPriceChange?: boolean;
  showVolatility?: boolean;
  showMarketCap?: boolean;
  /** When false, hides tier / source footers under tiles (collection overview). */
  showFootnotes?: boolean;
  compact?: boolean;
  formatMarketCap: (usd: number | null) => string;
  /**
   * When set, renders only tiles for that column — pair with CollectionOverviewBoard
   * `bookColumnMetricsRow` so price/change sit above the chart and vol/cap above the book.
   */
  exchangeColumn?: "chart" | "trade";
}

function isNonemptyFooter(node: ReactNode): boolean {
  if (node === undefined || node === null || node === false) return false;
  if (typeof node === "string") return node.trim().length > 0;
  return true;
}

function MetricTile({
  label,
  accent = "muted",
  value,
  footer,
  compact,
}: {
  label: string;
  accent?: "market" | "muted";
  value: ReactNode;
  footer?: ReactNode;
  compact: boolean;
}) {
  const border =
    accent === "market"
      ? "border border-emerald-900/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
      : "border border-zinc-700/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";
  const labelCls =
    "text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400";
  const valueCls = compact
    ? "text-[1.2rem] sm:text-[1.36rem] font-bold tabular-nums tracking-tight leading-none"
    : "text-[1.14rem] sm:text-[1.3rem] font-bold tabular-nums tracking-tight leading-none";

  const hasFooter = isNonemptyFooter(footer);

  if (!hasFooter) {
    const pad = compact ? "px-3 py-2.5 sm:px-3.5 sm:py-2.5" : "px-3 py-2.5 sm:px-4 sm:py-3";
    return (
      <div
        className={`flex min-h-0 min-w-0 flex-col justify-center rounded-xl bg-zinc-950/88 ${border} ${pad}`}
      >
        <span className={`${labelCls} leading-[1.3] text-pretty`}>{label}</span>
        <div className={`mt-1.5 flex min-h-[1.5rem] flex-wrap items-baseline gap-x-1 ${valueCls}`}>
          {value}
        </div>
      </div>
    );
  }

  const pad = compact ? "px-3 py-3 sm:px-3.5 sm:py-3" : "px-3 py-3 sm:px-4";

  return (
    <div
      className={`flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl bg-zinc-950/88 ${border} ${pad}`}
    >
      <div className="flex min-h-[2.8125rem] flex-col justify-end">
        <span className={`${labelCls} leading-[1.35] text-pretty`}>{label}</span>
        <div className={`mt-2 flex min-h-[1.75rem] flex-wrap items-baseline gap-x-1 ${valueCls}`}>
          {value}
        </div>
      </div>
      <div className="mt-2 flex min-h-[2.5rem] flex-col justify-start text-[10px] leading-snug text-zinc-500 sm:min-h-[2.625rem] sm:text-[11px]">
        {footer}
      </div>
    </div>
  );
}

export function CollectionPriceMetricsStrip({
  externalMarketUsd = null,
  externalPriceSource = null,
  marketTierDisplay = null,
  externalMarketMatchConfidence = null,
  externalPriceLoading = false,
  externalVolatilityCvPct = null,
  volatilityFootnote = null,
  platformPriceSamples = [],
  bookSpreadPct = null,
  externalPriceChange1yPct = null,
  externalPriceChange1yLoading = false,
  externalPriceChangeBasisText = null,
  marketCapUsd = null,
  marketCapMethodHint = null,
  showPriceChange = true,
  showVolatility = true,
  showMarketCap = true,
  showFootnotes = true,
  compact = false,
  formatMarketCap,
  exchangeColumn,
}: CollectionPriceMetricsStripProps) {
  const showChartColumn =
    exchangeColumn === undefined
      ? true
      : exchangeColumn === "chart";
  const showTradeColumn =
    exchangeColumn === undefined
      ? true
      : exchangeColumn === "trade";

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

  const chartSlotCount =
    (showChartColumn ? 1 : 0) + (showChartColumn && showPriceChange ? 1 : 0);
  const tradeSlotCount =
    (showVolatility && showTradeColumn ? 1 : 0) +
    (showMarketCap && showTradeColumn ? 1 : 0);

  const visibleMetricCount =
    exchangeColumn === undefined
      ? chartSlotCount + tradeSlotCount
      : exchangeColumn === "chart"
        ? chartSlotCount
        : tradeSlotCount;

  const gridClass =
    visibleMetricCount <= 1
      ? "grid-cols-1"
      : visibleMetricCount === 2
        ? "grid-cols-2"
        : visibleMetricCount === 3
          ? "grid-cols-1 min-[480px]:grid-cols-3"
          : "grid-cols-2 sm:grid-cols-4";

  let priceFooter: ReactNode = undefined;
  if (showFootnotes) {
    const priceFooterParts: string[] = [];
    if (marketTierDisplay?.trim()) priceFooterParts.push(marketTierDisplay.trim());
    if (externalMarketMatchConfidence === "verified") priceFooterParts.push("Match: verified");
    else if (externalMarketMatchConfidence === "approximate") priceFooterParts.push("Match: approximate");
    if (externalPriceSource?.trim()) priceFooterParts.push(externalPriceSource.trim());
    if (priceFooterParts.length > 0) {
      priceFooter = (
        <span className="line-clamp-2 text-pretty">{priceFooterParts.join(" · ")}</span>
      );
    }
  }

  const changeBasis =
    showFootnotes && externalPriceChangeBasisText?.trim() ? (
      <span className="line-clamp-2 text-pretty">{externalPriceChangeBasisText.trim()}</span>
    ) : undefined;

  const volFooter =
    showFootnotes && volatilityFootnote?.trim() ? (
      <span className="line-clamp-2 text-pretty">{volatilityFootnote.trim()}</span>
    ) : undefined;

  const capFooter =
    showFootnotes && marketCapMethodHint?.trim() ? (
      <span className="line-clamp-2 text-pretty">{marketCapMethodHint.trim()}</span>
    ) : undefined;

  return (
    <div
      className={`grid ${gridClass} w-full min-w-0 items-stretch gap-2 sm:gap-3 ${compact ? "mb-0 sm:mb-0.5" : "mb-2 sm:mb-2.5"}`}
    >
      {showChartColumn ? (
        <MetricTile
          label="Market price"
          accent="market"
          compact={compact}
          footer={priceFooter}
          value={
            <>
              {externalPriceLoading && !showExternalPrimary ? (
                <span className="inline-block h-[1.2rem] w-[6rem] max-w-full animate-pulse rounded bg-zinc-800/75" aria-hidden />
              ) : showExternalPrimary ? (
                <span className="min-w-0 text-white">{formatUsdCompact(externalMarketUsd)}</span>
              ) : (
                <span className="min-w-0 truncate text-white">{NO_EXTERNAL_PRICE}</span>
              )}
            </>
          }
        />
      ) : null}

      {showChartColumn && showPriceChange ? (
        <MetricTile
          label="% Change (1 yr)"
          compact={compact}
          footer={changeBasis}
          value={
            <>
              {externalPriceChange1yLoading && change == null ? (
                <span className="inline-block h-[1.2rem] w-[4rem] animate-pulse rounded bg-zinc-800/75" aria-hidden />
              ) : change != null && Number.isFinite(change) ? (
                <span
                  className={
                    changeUp ? "text-emerald-400" : changeDown ? "text-red-400" : "text-zinc-100"
                  }
                >
                  {change > 0 ? "+" : ""}
                  {change.toFixed(1)}%
                </span>
              ) : (
                <span className="text-zinc-100">—</span>
              )}
            </>
          }
        />
      ) : null}

      {showTradeColumn && showVolatility ? (
        <MetricTile label="Volatility" compact={compact} footer={volFooter} value={
          <span className="text-zinc-100">
            {volatilityPct != null && Number.isFinite(volatilityPct)
              ? `${volatilityPct.toFixed(0)}%`
              : "—"}
          </span>
        }
        />
      ) : null}

      {showTradeColumn && showMarketCap ? (
        <MetricTile label="Market cap" compact={compact} footer={capFooter} value={
          <span className="min-w-0 truncate text-zinc-100">{formatMarketCap(marketCapUsd)}</span>
        }
        />
      ) : null}
    </div>
  );
}
