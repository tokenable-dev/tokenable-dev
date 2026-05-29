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

export function CollectionPriceMetricsStripUnifiedRow({
  compact = false,
  formatMarketCap,
  volume24hUsdc = null,
  volume24hLoading = false,
  totalPopulation = null,
  model,
}: Pick<
  CollectionPriceMetricsStripProps,
  "compact" | "formatMarketCap" | "volume24hUsdc" | "volume24hLoading" | "totalPopulation"
> & { model: Model }) {
  const change1Mo = model.change;
  const gridClass =
    "grid w-full max-lg:grid-cols-2 max-lg:gap-x-2 max-lg:gap-y-1 lg:grid-cols-5 lg:gap-0";

  return (
    <div
      className={`w-full min-w-0 overflow-hidden rounded-lg border border-[rgba(38,39,45,1)] bg-[rgb(20,20,21)] max-lg:px-1.5 max-lg:py-1.5 lg:min-h-[116px] lg:px-2.5 lg:py-2 lg:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${compact ? "mb-0 sm:mb-0.5" : "mb-2 sm:mb-2.5"}`}
    >
      <div
        className={`grid ${gridClass} h-full min-h-0 min-w-0 items-stretch justify-items-stretch gap-0`}
      >
        <MetricTile
          variant="panelCell"
          tone="primary"
          label="Current Price"
          compact={compact}
          footer={metricFooterFromText(model.priceFooterText)}
          value={
            <>
              {model.externalPriceLoading && !model.showExternalPrimary ? (
                <span
                  className="inline-block h-[0.8rem] w-[4.5rem] max-w-full animate-pulse rounded bg-zinc-800/75 lg:h-[1.5rem] lg:w-[7rem]"
                  aria-hidden
                />
              ) : model.showExternalPrimary ? (
                <span className="min-w-0 max-lg:text-mint lg:text-white">
                  {formatUsdCompact(model.externalMarketUsd!)}
                </span>
              ) : (
                <span className="min-w-0 truncate max-lg:text-zinc-400 lg:text-white">
                  {NO_EXTERNAL_PRICE}
                </span>
              )}
            </>
          }
        />
        <MetricTile
          variant="panelCell"
          label={`% Change ${model.changePeriodLabel}`}
          compact={compact}
          value={
            <>
              {model.externalPriceChange1MoLoading && change1Mo == null ? (
                <span
                  className="inline-block h-[0.8rem] w-[3.25rem] animate-pulse rounded bg-zinc-800/75 lg:h-[1.5rem] lg:w-[4.5rem]"
                  aria-hidden
                />
              ) : change1Mo != null && Number.isFinite(change1Mo) ? (
                <span
                  className={
                    referenceChangeTone(change1Mo) === "up"
                      ? "text-mint"
                      : referenceChangeTone(change1Mo) === "down"
                        ? "text-rose-400"
                        : "text-zinc-400"
                  }
                >
                  {formatReferencePercentChange(change1Mo)}
                </span>
              ) : (
                <span
                  className="max-lg:text-zinc-400 lg:text-white"
                  title={REFERENCE_CHANGE_UNAVAILABLE_HINT}
                >
                  {REFERENCE_CHANGE_UNAVAILABLE_LABEL}
                </span>
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
                  className="inline-block h-[0.8rem] w-[3.75rem] max-w-full animate-pulse rounded bg-zinc-800/75 lg:h-[1.5rem] lg:w-[5.5rem]"
                  aria-hidden
                />
              ) : (
                <span className="min-w-0 max-lg:text-zinc-100 lg:text-white">
                  {formatUsdCompact(
                    volume24hUsdc != null && Number.isFinite(volume24hUsdc) ? volume24hUsdc : 0,
                  )}
                </span>
              )}
            </>
          }
        />
        <MetricTile
          variant="panelCell"
          label="Market Cap"
          compact={compact}
          footer={metricFooterFromText(model.capFooterText)}
          value={
            <span className="min-w-0 truncate max-lg:text-zinc-100 lg:text-white">
              {formatMarketCap(model.marketCapUsd)}
            </span>
          }
        />
        <MetricTile
          variant="panelCell"
          label="Total Pop"
          compact={compact}
          value={
            <span className="min-w-0 tabular-nums max-lg:text-zinc-100 lg:text-white">
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
