"use client";

import { IBM_Plex_Sans } from "next/font/google";
import type { ReactNode } from "react";
import {
  COLLECTION_DETAILS_BG_CLASS,
  COLLECTION_DETAILS_BORDER_ALL,
} from "@/components/marketplace/collectionOverviewChrome";
import { formatUsdCompact, NO_EXTERNAL_PRICE } from "@/lib/market";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});

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
  /**
   * Single row: Current Price, % Change 24h, Volume 24h, Total Pop, Market Cap.
   * Ignores {@link exchangeColumn}.
   */
  exchangeUnifiedRow?: boolean;
  externalPriceChange24hPct?: number | null;
  externalPriceChange24hLoading?: boolean;
  /** Sum of on-platform fill prices (USDC) in the last 24h; null while trades are loading. */
  volume24hUsdc?: number | null;
  volume24hLoading?: boolean;
  /** PSA total population for the slab (from collection components / catalog). */
  totalPopulation?: number | null;
}

function isNonemptyFooter(node: ReactNode): boolean {
  if (node === undefined || node === null || node === false) return false;
  if (typeof node === "string") return node.trim().length > 0;
  return true;
}

function MetricTile({
  label,
  value,
  footer,
  compact,
  variant = "card",
  tone = "default",
  cellClassName,
}: {
  label: string;
  value: ReactNode;
  footer?: ReactNode;
  compact: boolean;
  variant?: "card" | "panelCell";
  /** Highlights the value (e.g. live market price). */
  tone?: "default" | "primary";
  cellClassName?: string;
}) {
  const border = `${COLLECTION_DETAILS_BORDER_ALL} shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]`;
  const labelCls =
    "text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400";
  const valueCls = compact
    ? "text-[1.2rem] sm:text-[1.36rem] font-bold tabular-nums tracking-tight leading-none"
    : "text-[1.14rem] sm:text-[1.3rem] font-bold tabular-nums tracking-tight leading-none";

  const hasFooter = isNonemptyFooter(footer);

  if (variant === "panelCell") {
    const inset =
      tone === "primary"
        ? "max-xl:col-span-2 max-xl:rounded-md max-xl:px-3 max-xl:py-2.5 max-xl:bg-mint/[0.06] xl:col-span-auto xl:rounded-none xl:px-3 xl:py-2 xl:sm:px-3.5 xl:sm:py-2.5 xl:bg-transparent"
        : "max-xl:px-3 max-xl:py-2 xl:px-3 xl:py-2 xl:sm:px-3.5 xl:sm:py-2.5";
    const panelLabelCls = `${ibmPlexSans.className} max-xl:text-[10px] max-xl:font-semibold max-xl:uppercase max-xl:leading-none max-xl:tracking-[0.08em] max-xl:text-zinc-500 xl:text-[16px] xl:font-normal xl:normal-case xl:leading-[150%] xl:tracking-[0px] xl:text-zinc-400`;
    const panelValueWrapCls = "mt-1 flex w-full min-w-0 flex-wrap items-baseline gap-x-1 xl:mt-3 xl:min-h-[1.75rem]";
    const panelValueTextCls = `${ibmPlexSans.className} max-xl:text-[15px] max-xl:font-bold max-xl:leading-none max-xl:tracking-tight max-xl:tabular-nums xl:text-[24px] xl:font-semibold xl:leading-[150%] xl:tracking-[0px] xl:tabular-nums xl:text-white`;
    const valueNode = (
      <div className={panelValueWrapCls}>
        <div className={`min-w-0 ${panelValueTextCls}`}>{value}</div>
      </div>
    );
    if (!hasFooter) {
      return (
        <div
          className={`flex min-w-0 flex-col items-start justify-center text-left ${inset} ${cellClassName ?? ""}`}
        >
          <span className={`${panelLabelCls} text-pretty`}>{label}</span>
          {valueNode}
        </div>
      );
    }
    return (
      <div
        className={`flex min-w-0 flex-col items-start justify-center text-left ${inset} ${cellClassName ?? ""}`}
      >
        <span className={`${panelLabelCls} text-pretty`}>{label}</span>
        {valueNode}
        <div className="mt-1 w-full text-left text-[9px] leading-snug text-zinc-500 xl:mt-1.5 xl:text-[10px] xl:sm:text-[11px]">
          {footer}
        </div>
      </div>
    );
  }

  if (!hasFooter) {
    const pad = compact ? "px-3 py-2.5 sm:px-3.5 sm:py-2.5" : "px-3 py-2.5 sm:px-4 sm:py-3";
    return (
      <div
        className={`flex min-h-0 min-w-0 flex-col justify-center rounded-xl ${COLLECTION_DETAILS_BG_CLASS} ${border} ${pad}`}
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
      className={`flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl ${COLLECTION_DETAILS_BG_CLASS} ${border} ${pad}`}
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
  exchangeUnifiedRow = false,
  externalPriceChange24hPct = null,
  externalPriceChange24hLoading = false,
  volume24hUsdc = null,
  volume24hLoading = false,
  totalPopulation = null,
}: CollectionPriceMetricsStripProps) {
  const showExternalPrimary =
    externalMarketUsd != null &&
    Number.isFinite(externalMarketUsd) &&
    externalMarketUsd > 0;

  if (exchangeUnifiedRow) {
    const change24h = externalPriceChange24hPct;
    const change24hUp = change24h != null && change24h > 0;
    const change24hDown = change24h != null && change24h < 0;
    const gridClass =
      "grid w-full max-xl:grid-cols-2 max-xl:gap-x-3 max-xl:gap-y-2 xl:grid-cols-5 xl:gap-0";

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

    const capFooter =
      showFootnotes && marketCapMethodHint?.trim() ? (
        <span className="line-clamp-2 text-pretty">{marketCapMethodHint.trim()}</span>
      ) : undefined;

    return (
      <div
        className={`w-full min-w-0 overflow-hidden rounded-lg border border-[rgba(38,39,45,1)] bg-[rgb(20,20,21)] max-xl:px-2 max-xl:py-2.5 max-xl:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] xl:min-h-[116px] xl:px-2.5 xl:py-2 ${compact ? "mb-0 sm:mb-0.5" : "mb-2 sm:mb-2.5"}`}
      >
        <div
          className={`grid ${gridClass} h-full min-h-0 min-w-0 items-stretch justify-items-stretch gap-0`}
        >
          <MetricTile
            variant="panelCell"
            tone="primary"
            label="Current Price"
            compact={compact}
            footer={priceFooter}
            value={
              <>
                {externalPriceLoading && !showExternalPrimary ? (
                  <span
                    className="inline-block h-[1rem] w-[5.5rem] max-w-full animate-pulse rounded bg-zinc-800/75 xl:h-[1.5rem] xl:w-[7rem]"
                    aria-hidden
                  />
                ) : showExternalPrimary ? (
                  <span className="min-w-0 max-xl:text-mint xl:text-white">
                    {formatUsdCompact(externalMarketUsd)}
                  </span>
                ) : (
                  <span className="min-w-0 truncate max-xl:text-zinc-400 xl:text-white">
                    {NO_EXTERNAL_PRICE}
                  </span>
                )}
              </>
            }
          />
          <MetricTile
            variant="panelCell"
            label="% Change 24h"
            compact={compact}
            value={
              <>
                {externalPriceChange24hLoading && change24h == null ? (
                  <span
                    className="inline-block h-[1rem] w-[4rem] animate-pulse rounded bg-zinc-800/75 xl:h-[1.5rem] xl:w-[4.5rem]"
                    aria-hidden
                  />
                ) : change24h != null && Number.isFinite(change24h) ? (
                  <span
                    className={
                      change24hUp
                        ? "text-mint"
                        : change24hDown
                          ? "text-rose-400"
                          : "text-zinc-300"
                    }
                  >
                    {change24h > 0 ? "+" : ""}
                    {change24h.toFixed(1)}%
                  </span>
                ) : (
                  <span className="max-xl:text-zinc-400 xl:text-white">—</span>
                )}
              </>
            }
          />
          <MetricTile
            variant="panelCell"
            label="Volume 24h"
            compact={compact}
            value={
              <>
                {volume24hLoading && volume24hUsdc == null ? (
                  <span
                    className="inline-block h-[1rem] w-[4.5rem] max-w-full animate-pulse rounded bg-zinc-800/75 xl:h-[1.5rem] xl:w-[5.5rem]"
                    aria-hidden
                  />
                ) : (
                  <span className="min-w-0 max-xl:text-zinc-100 xl:text-white">
                    {formatUsdCompact(volume24hUsdc)}
                  </span>
                )}
              </>
            }
          />
          <MetricTile
            variant="panelCell"
            label="Market Cap"
            compact={compact}
            footer={capFooter}
            value={
              <span className="min-w-0 truncate max-xl:text-zinc-100 xl:text-white">
                {formatMarketCap(marketCapUsd)}
              </span>
            }
          />
          <MetricTile
            variant="panelCell"
            label="Total Pop"
            compact={compact}
            value={
              <span className="min-w-0 tabular-nums max-xl:text-zinc-100 xl:text-white">
                {totalPopulation != null && Number.isFinite(totalPopulation) && totalPopulation > 0
                  ? totalPopulation.toLocaleString("en-US")
                  : "—"}
              </span>
            }
          />
        </div>
      </div>
    );
  }

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
          label="Market Price"
          compact={compact}
          footer={priceFooter}
          value={
            <>
              {externalPriceLoading && !showExternalPrimary ? (
                <span className="inline-block h-[0.875rem] w-[6rem] max-w-full animate-pulse rounded bg-zinc-800/75" aria-hidden />
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
                <span className="inline-block h-[0.875rem] w-[3.5rem] animate-pulse rounded bg-zinc-800/75" aria-hidden />
              ) : change != null && Number.isFinite(change) ? (
                <span
                  className={
                    "text-white"
                  }
                >
                  {change > 0 ? "+" : ""}
                  {change.toFixed(1)}%
                </span>
              ) : (
                <span className="text-white">—</span>
              )}
            </>
          }
        />
      ) : null}

      {showTradeColumn && showVolatility ? (
        <MetricTile label="Volatility" compact={compact} footer={volFooter} value={
          <span className="text-white">
            {volatilityPct != null && Number.isFinite(volatilityPct)
              ? `${volatilityPct.toFixed(0)}%`
              : "—"}
          </span>
        }
        />
      ) : null}

      {showTradeColumn && showMarketCap ? (
        <MetricTile label="Market cap" compact={compact} footer={capFooter} value={
          <span className="min-w-0 truncate text-white">{formatMarketCap(marketCapUsd)}</span>
        }
        />
      ) : null}
    </div>
  );
}
