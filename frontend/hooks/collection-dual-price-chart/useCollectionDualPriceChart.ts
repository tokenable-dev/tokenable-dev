"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import {
  buildCollectionDualPriceChartOption,
  mergeExternalChartSeries,
} from "@/lib/marketplace/collection-dual-price-chart";
import type { CollectionUsdPoint } from "@/lib/core";

export function useCollectionDualPriceChart(input: {
  externalMarketUsd?: number | null;
  externalWindowDays?: number | null;
  externalRollingUsd?: CollectionUsdPoint[] | null;
  externalSeriesShortLabel: string;
  externalRefLineTag: string;
  isMobileChart: boolean;
  compactTab: boolean;
  colorTheme?: "default" | "collection-detail";
}) {
  const {
    externalMarketUsd,
    externalWindowDays,
    externalRollingUsd,
    externalSeriesShortLabel,
    externalRefLineTag,
    isMobileChart,
    compactTab,
    colorTheme = "default",
  } = input;

  const nowSec = Math.floor(Date.now() / 1000);

  const merged = useMemo(
    () =>
      mergeExternalChartSeries({
        externalRollingUsd,
        externalMarketUsd,
        externalWindowDays,
        nowSec,
        stretchToWindow: colorTheme === "collection-detail",
      }),
    [externalRollingUsd, externalMarketUsd, externalWindowDays, nowSec, colorTheme],
  );

  const chartOption = useMemo<EChartsOption>(
    () =>
      buildCollectionDualPriceChartOption({
        merged,
        externalMarketUsd,
        externalSeriesShortLabel,
        externalRefLineTag,
        isMobileChart,
        compactTab,
        colorTheme,
      }),
    [
      merged,
      externalMarketUsd,
      externalSeriesShortLabel,
      externalRefLineTag,
      isMobileChart,
      compactTab,
      colorTheme,
    ],
  );

  return { merged, chartOption, nowSec };
}
