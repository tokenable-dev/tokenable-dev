"use client";

import {
  COLLECTION_CHART_SURFACE,
  COLLECTION_DETAILS_BG_CLASS,
  COLLECTION_DETAILS_BORDER_ALL,
} from "@/components/marketplace/collectionOverviewChrome";
import { EChartsSized } from "@/components/charts/EChartsSized";
import { useCollectionDetailMobile } from "@/hooks/collection-detail";
import { useCollectionDualPriceChart } from "@/hooks/collection-dual-price-chart";
import { LIVE_MARKET_LINE } from "@/lib/marketplace/collection-dual-price-chart";
import { CollectionChartRangeToolbar } from "./CollectionChartRangeToolbar";
import type { CollectionDualPriceChartProps } from "./types";

export type { ChartRangeOption, CollectionDualPriceChartProps } from "./types";

export function CollectionDualPriceChart({
  platformUsd: _platformUsd,
  externalMarketUsd = null,
  externalWindowDays = null,
  externalRollingUsd = null,
  externalRollingKind: _externalRollingKind = "snapshot",
  externalLegendLabel: _externalLegendLabel = "External market (NM)",
  externalSeriesShortLabel = "External NM",
  externalRefLineTag = "External NM",
  chartTitle: _chartTitle = "External market vs on-platform trades",
  controls = null,
  rangeOptions,
  chartRange,
  onChartRangeChange,
  emptyStateMessage,
  isLoading,
  errorMessage,
  variant = "default",
  collectionOverviewMat = false,
  embedInMobileTab = false,
  chartToolbar = null,
  colorTheme = "default",
}: CollectionDualPriceChartProps) {
  const marketsLayout = variant === "markets";
  const isMobileChart = useCollectionDetailMobile();
  const compactTab = embedInMobileTab && marketsLayout;
  const cardHtmlDetail = colorTheme === "collection-detail";
  /** Card.html chart card needs a real drawable height — markets tab used 72px (looks flat). */
  const chartMinHeight = cardHtmlDetail
    ? isMobileChart
      ? 220
      : 280
    : compactTab
      ? 72
      : marketsLayout
        ? 72
        : 200;
  const useIntegratedRange =
    !isMobileChart &&
    rangeOptions != null &&
    rangeOptions.length > 0 &&
    chartRange != null &&
    onChartRangeChange != null;

  const rangeToolbar = useIntegratedRange ? (
    <CollectionChartRangeToolbar
      options={rangeOptions}
      value={chartRange}
      onChange={onChartRangeChange}
    />
  ) : null;

  const chartShellDefault = `rounded-2xl ${COLLECTION_DETAILS_BORDER_ALL} ${COLLECTION_DETAILS_BG_CLASS} shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]`;
  const marketsChrome =
    marketsLayout && collectionOverviewMat ? COLLECTION_CHART_SURFACE : chartShellDefault;

  const { merged, chartOption } = useCollectionDualPriceChart({
    externalMarketUsd,
    externalWindowDays,
    externalRollingUsd,
    externalSeriesShortLabel,
    externalRefLineTag,
    isMobileChart,
    compactTab,
    colorTheme,
  });

  const chartToolbarBarCls =
    "flex shrink-0 items-center border-b border-[rgba(38,39,45,0.5)] px-2 py-1 sm:px-2.5";

  if (isLoading) {
    return (
      <div
        className={
          cardHtmlDetail
            ? "flex min-h-0 flex-1 flex-col overflow-hidden"
            : marketsLayout
              ? `${marketsChrome} flex min-h-[72px] flex-col overflow-hidden ${
                  compactTab
                    ? "h-full min-h-0"
                    : "max-lg:min-h-[min(96px,16svh)] max-lg:h-full max-lg:min-h-0 lg:h-full lg:min-h-0"
                }`
              : `${chartShellDefault} flex min-h-[260px] flex-col overflow-hidden`
        }
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        {chartToolbar ? (
          <div className={chartToolbarBarCls}>
            {chartToolbar}
          </div>
        ) : null}
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-solid border-t-transparent"
            style={{ borderColor: `${LIVE_MARKET_LINE}40`, borderTopColor: "transparent" }}
          />
          <p className="text-center text-xs text-zinc-600">Loading chart…</p>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div
        className={
          cardHtmlDetail
            ? "flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-4 text-center text-sm text-rose-200/90"
            : marketsLayout
              ? `${marketsChrome} flex min-h-[72px] flex-col items-center justify-center px-4 py-4 text-center text-sm text-rose-200/90 ${
                  compactTab
                    ? "h-full min-h-0"
                    : "max-lg:min-h-[min(96px,16svh)] max-lg:h-full max-lg:min-h-0 lg:h-full lg:min-h-0"
                }`
              : "rounded-2xl border border-rose-500/20 bg-black px-4 py-6 text-center text-sm text-rose-200/90"
        }
      >
        {errorMessage}
      </div>
    );
  }

  if (!merged.hasExtSignal) {
    return (
      <div
        className={
          cardHtmlDetail
            ? "flex min-h-0 flex-1 flex-col overflow-hidden"
            : marketsLayout
              ? `${marketsChrome} flex min-h-[72px] flex-col overflow-hidden ${
                  compactTab
                    ? "h-full min-h-0"
                    : "max-lg:min-h-[min(96px,16svh)] max-lg:h-full max-lg:min-h-0 lg:h-full lg:min-h-0"
                }`
              : `${chartShellDefault} flex min-h-[110px] flex-col overflow-hidden`
        }
      >
        {chartToolbar ? (
          <div className={chartToolbarBarCls}>
            {chartToolbar}
          </div>
        ) : null}
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-4 text-center text-sm text-zinc-600">
          {emptyStateMessage ??
            "No market price history in this window yet."}
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        cardHtmlDetail
          ? "flex min-h-0 flex-1 flex-col overflow-hidden text-white"
          : marketsLayout
            ? `${marketsChrome} flex h-full min-h-0 flex-col overflow-hidden text-white ${
                compactTab ? "min-h-0" : "max-lg:min-h-0 lg:h-full lg:min-h-0"
              }`
            : `${chartShellDefault} text-white`
      }
    >
      {chartToolbar || rangeToolbar || (controls && !useIntegratedRange) ? (
        <div className={chartToolbarBarCls}>
          <div className="flex min-w-0 flex-1 items-center justify-end overflow-x-auto">
            {chartToolbar ?? rangeToolbar ?? controls}
          </div>
        </div>
      ) : null}

      <div
        className={
          cardHtmlDetail
            ? "relative flex min-h-0 flex-1 flex-col"
            : marketsLayout
              ? "relative flex min-h-0 flex-1 flex-col px-1 pb-1 pt-0 max-lg:min-h-0 sm:px-2 sm:pb-1.5"
              : "relative min-h-[200px] px-2 pb-3 pt-0 sm:px-4"
        }
      >
        <EChartsSized
          chartKey={merged.fixedWindowDays ?? "auto"}
          option={chartOption}
          minHeight={chartMinHeight}
          className={
            cardHtmlDetail
              ? "cd-chart-echarts h-full min-h-0 w-full"
              : marketsLayout
                ? compactTab
                  ? "h-full min-h-0 w-full"
                  : "h-full min-h-0 w-full max-lg:min-h-0"
                : "min-h-[200px] w-full"
          }
        />
      </div>
    </div>
  );
}
