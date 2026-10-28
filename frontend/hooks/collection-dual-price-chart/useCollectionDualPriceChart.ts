"use client";

import { useMemo } from "react";
import { useLocale } from "next-intl";
import type { EChartsOption } from "echarts";
import { useDisplayFx } from "@/components/i18n/DisplayPreferencesProvider";
import { resolveLocale } from "@/lib/i18n/preferences";
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
  const fx = useDisplayFx();
  const locale = resolveLocale(useLocale());

  const seriesLen = externalRollingUsd?.length ?? 0;
  const nowSec = useMemo(
    () => Math.floor(Date.now() / 1000),
    [externalWindowDays, seriesLen, colorTheme],
  );

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
        locale,
      }),
    [
      merged,
      externalMarketUsd,
      externalSeriesShortLabel,
      externalRefLineTag,
      isMobileChart,
      compactTab,
      colorTheme,
      locale,
      fx.currency,
      fx.observationDate,
      fx.stale,
      fx.fallbackToUsd,
    ],
  );

  return { merged, chartOption, nowSec };
}
