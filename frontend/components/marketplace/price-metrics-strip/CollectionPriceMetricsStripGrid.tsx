"use client";

import {
  formatReferencePercentChange,
  formatUsdCompact,
  NO_EXTERNAL_PRICE,
  REFERENCE_CHANGE_UNAVAILABLE_HINT,
  REFERENCE_CHANGE_UNAVAILABLE_LABEL,
  referenceChangeTone,
} from "@/lib/market";
import type { CollectionPriceMetricsStripProps } from "@/lib/marketplace/price-metrics-strip";
import type { usePriceMetricsStripModel } from "@/hooks/price-metrics-strip";
import { MetricTile } from "./MetricTile";
import { metricFooterFromText } from "./metricFootnotes";

type Model = ReturnType<typeof usePriceMetricsStripModel>;

export function CollectionPriceMetricsStripGrid({
  compact = false,
  formatMarketCap,
  model,
}: Pick<CollectionPriceMetricsStripProps, "compact" | "formatMarketCap"> & {
  model: Model;
}) {
  const change = model.change;

  return (
    <div
      className={`grid ${model.gridClass} w-full min-w-0 items-stretch gap-2 sm:gap-3 ${compact ? "mb-0 sm:mb-0.5" : "mb-2 sm:mb-2.5"}`}
    >
      {model.showChartColumn ? (
        <MetricTile
          label="Market Price"
          compact={compact}
          footer={metricFooterFromText(model.priceFooterText)}
          value={
            <>
              {model.externalPriceLoading && !model.showExternalPrimary ? (
                <span
                  className="inline-block h-[0.875rem] w-[6rem] max-w-full animate-pulse rounded bg-zinc-800/75"
                  aria-hidden
                />
              ) : model.showExternalPrimary ? (
                <span className="min-w-0 text-white">
                  {formatUsdCompact(model.externalMarketUsd!)}
                </span>
              ) : (
                <span className="min-w-0 truncate text-white">{NO_EXTERNAL_PRICE}</span>
              )}
            </>
          }
        />
      ) : null}

      {model.showChartColumn && model.showPriceChange ? (
        <MetricTile
          label={`Chg (${model.changePeriodLabel})`}
          compact={compact}
          footer={metricFooterFromText(model.changeBasisText)}
          value={
            <>
              {model.externalPriceChange1MoLoading && change == null ? (
                <span
                  className="inline-block h-[0.875rem] w-[3.5rem] animate-pulse rounded bg-zinc-800/75"
                  aria-hidden
                />
              ) : change != null && Number.isFinite(change) ? (
                <span
                  className={
                    referenceChangeTone(change) === "up"
                      ? "text-mint"
                      : referenceChangeTone(change) === "down"
                        ? "text-rose-400"
                        : "text-zinc-400"
                  }
                >
                  {formatReferencePercentChange(change)}
                </span>
              ) : (
                <span className="text-zinc-400" title={REFERENCE_CHANGE_UNAVAILABLE_HINT}>
                  {REFERENCE_CHANGE_UNAVAILABLE_LABEL}
                </span>
              )}
            </>
          }
        />
      ) : null}

      {model.showTradeColumn && model.showVolatility ? (
        <MetricTile
          label="Volatility"
          compact={compact}
          footer={metricFooterFromText(model.volFooterText)}
          value={
            <span className="text-white">
              {model.volatilityPct != null && Number.isFinite(model.volatilityPct)
                ? `${model.volatilityPct.toFixed(0)}%`
                : "—"}
            </span>
          }
        />
      ) : null}

      {model.showTradeColumn && model.showMarketCap ? (
        <MetricTile
          label="Market cap"
          compact={compact}
          footer={metricFooterFromText(model.capFooterText)}
          value={
            <span className="min-w-0 truncate text-white">
              {formatMarketCap(model.marketCapUsd)}
            </span>
          }
        />
      ) : null}
    </div>
  );
}
