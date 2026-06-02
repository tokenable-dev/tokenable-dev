"use client";

import {
  formatReferencePercentChange,
  formatUsdCompact,
  formatPsaPopulationCount,
  NO_EXTERNAL_PRICE,
  REFERENCE_CHANGE_UNAVAILABLE_HINT,
  REFERENCE_CHANGE_UNAVAILABLE_LABEL,
  referenceChangeTone,
} from "@/lib/market";
import type { PsaPopulationMetrics } from "@/lib/market/gradedCardMarketCap";
import type { CollectionPriceMetricsStripProps } from "@/lib/marketplace/price-metrics-strip";
import type { usePriceMetricsStripModel } from "@/hooks/price-metrics-strip";
import { MetricTile } from "./MetricTile";
import { metricFooterFromText } from "./metricFootnotes";
import {
  metricPanelInsetCls,
  metricPanelLabelCls,
  metricPanelPopCellCls,
  metricPanelValueCls,
  metricPanelValueWrapCls,
} from "./theme";

type Model = ReturnType<typeof usePriceMetricsStripModel>;

function PsaPopulationStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 flex-1 basis-0">
      <span className={metricPanelLabelCls}>{label}</span>
      <div className={metricPanelValueWrapCls}>
        <span
          className={`max-lg:text-zinc-100 lg:text-white ${metricPanelValueCls}`}
          title={value !== "—" ? value : undefined}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

function PsaPopulationMetricCell({ metrics }: { metrics: PsaPopulationMetrics }) {
  return (
    <div
      className={`flex min-w-0 flex-col items-start justify-center text-left ${metricPanelInsetCls} ${metricPanelPopCellCls}`}
    >
      <div className="grid w-full min-w-0 grid-cols-2 gap-x-3 lg:gap-x-5">
        <PsaPopulationStat
          label="PSA 10 Pop"
          value={formatPsaPopulationCount(metrics.psa10Pop)}
        />
        <PsaPopulationStat
          label="Total PSA Pop"
          value={formatPsaPopulationCount(metrics.totalPsaPop)}
        />
      </div>
    </div>
  );
}

export function CollectionPriceMetricsStripUnifiedRow({
  compact = false,
  formatMarketCap,
  volume24hUsdc = null,
  volume24hLoading = false,
  psaPopulationMetrics = null,
  model,
}: Pick<
  CollectionPriceMetricsStripProps,
  "compact" | "formatMarketCap" | "volume24hUsdc" | "volume24hLoading" | "psaPopulationMetrics"
> & { model: Model }) {
  const change1Mo = model.change;
  const popMetrics = psaPopulationMetrics ?? { psa10Pop: null, totalPsaPop: null };
  const gridClass =
    "grid w-full max-lg:grid-cols-2 max-lg:gap-x-2 max-lg:gap-y-1 lg:grid-cols-6 lg:gap-x-0 lg:gap-y-0";

  return (
    <div className={`w-full min-w-0 lg:min-h-[116px] ${compact ? "mb-0 sm:mb-0.5" : "mb-0"}`}>
      <div
        className={`grid ${gridClass} h-full min-h-0 min-w-0 items-stretch justify-items-stretch`}
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
        <PsaPopulationMetricCell metrics={popMetrics} />
      </div>
    </div>
  );
}
