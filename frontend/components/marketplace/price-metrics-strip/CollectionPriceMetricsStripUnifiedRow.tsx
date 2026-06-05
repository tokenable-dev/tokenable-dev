"use client";

import {
  formatReferencePercentChange,
  formatUsdCompact,
  formatPsaPopulationCount,
  formatPsaPopulationPair,
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
  tradeVolumeUsdc = null,
  tradeVolumeLoading = false,
  psaPopulationMetrics = null,
  model,
}: Pick<
  CollectionPriceMetricsStripProps,
  "compact" | "formatMarketCap" | "tradeVolumeUsdc" | "tradeVolumeLoading" | "psaPopulationMetrics"
> & { model: Model }) {
  const change1Mo = model.change;
  const popMetrics = psaPopulationMetrics ?? { psa10Pop: null, totalPsaPop: null };
  const popPairLabel = formatPsaPopulationPair(popMetrics.psa10Pop, popMetrics.totalPsaPop);
  const popPairTitle =
    popMetrics.psa10Pop != null || popMetrics.totalPsaPop != null
      ? `PSA 10: ${formatPsaPopulationCount(popMetrics.psa10Pop)} · Total: ${formatPsaPopulationCount(popMetrics.totalPsaPop)}`
      : undefined;
  const gridClass =
    "grid w-full max-lg:grid-cols-2 max-lg:gap-x-2 max-lg:gap-y-1 lg:grid-cols-5 lg:gap-x-1 lg:gap-y-0 xl:gap-x-1.5";

  return (
    <div
      className={`@container/metrics w-full min-w-0 lg:min-h-[116px] ${compact ? "mb-0 sm:mb-0.5" : "mb-0"}`}
    >
      <div
        className={`grid ${gridClass} h-full min-h-0 min-w-0 items-stretch justify-items-stretch`}
      >
        <MetricTile
          variant="panelCell"
          tone="primary"
          label="Price"
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
                <span className="max-lg:text-zinc-400 lg:text-white">
                  {NO_EXTERNAL_PRICE}
                </span>
              )}
            </>
          }
        />
        <MetricTile
          variant="panelCell"
          label={`Chg ${model.changePeriodLabel}`}
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
          label="Volume 30d"
          compact={compact}
          value={
            <>
              {tradeVolumeLoading && tradeVolumeUsdc == null ? (
                <span
                  className="inline-block h-[0.8rem] w-[3.75rem] max-w-full animate-pulse rounded bg-zinc-800/75 lg:h-[1.5rem] lg:w-[5.5rem]"
                  aria-hidden
                />
              ) : (
                <span className="min-w-0 max-lg:text-zinc-100 lg:text-white">
                  {formatUsdCompact(
                    tradeVolumeUsdc != null && Number.isFinite(tradeVolumeUsdc)
                      ? tradeVolumeUsdc
                      : 0,
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
            <span className="max-lg:text-zinc-100 lg:text-white">
              {formatMarketCap(model.marketCapUsd)}
            </span>
          }
        />
        <MetricTile
          variant="panelCell"
          label="PSA 10 / Pop"
          labelTitle="PSA 10 / Total Pop"
          labelValueLayout="stackedNowrap"
          compact={compact}
          cellClassName="max-lg:col-span-2"
          value={
            <span className="max-lg:text-zinc-100 lg:text-white" title={popPairTitle}>
              {popPairLabel}
            </span>
          }
        />
      </div>
    </div>
  );
}
