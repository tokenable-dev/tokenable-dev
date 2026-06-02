import type { EChartsOption, LineSeriesOption } from "echarts";
import {
  AXIS_LABEL,
  CHART_DAY_SEC,
  LIVE_LINE_WIDTH,
  LIVE_MARKET_AREA_GRADIENT,
  LIVE_MARKET_LINE,
} from "./constants";
import { niceScale } from "./chartScale";
import {
  formatHoverWhen,
  formatTickDate,
  formatTooltipUsd,
  formatYAxisLabelCompact,
  roughTickConfigByWindowDays,
} from "./chartTimeTicks";
import type { MergedExternalChartData } from "./types";

export function buildCollectionDualPriceChartOption(input: {
  merged: MergedExternalChartData;
  externalMarketUsd?: number | null;
  externalSeriesShortLabel: string;
  externalRefLineTag: string;
  isMobileChart: boolean;
  compactTab: boolean;
}): EChartsOption {
  const {
    merged,
    externalMarketUsd,
    externalSeriesShortLabel,
    externalRefLineTag,
    isMobileChart,
    compactTab,
  } = input;

  const externalFlatSeries: Array<[number, number]> =
    !merged.extIsPolyline &&
    externalMarketUsd != null &&
    Number.isFinite(externalMarketUsd) &&
    externalMarketUsd > 0
      ? [
          [merged.tMin * 1000, externalMarketUsd],
          [merged.tMax * 1000, externalMarketUsd],
        ]
      : [];

  const series: LineSeriesOption[] = [];
  if (merged.extIsPolyline) {
    series.push({
      name: externalSeriesShortLabel,
      type: "line",
      data: merged.externalSeries,
      showSymbol: false,
      smooth: false,
      connectNulls: true,
      lineStyle: { color: LIVE_MARKET_LINE, width: LIVE_LINE_WIDTH },
      itemStyle: { color: LIVE_MARKET_LINE },
      areaStyle: { color: LIVE_MARKET_AREA_GRADIENT },
      emphasis: { focus: "series" },
    });
  }
  if (externalFlatSeries.length) {
    series.push({
      name: externalRefLineTag,
      type: "line",
      data: externalFlatSeries,
      showSymbol: false,
      smooth: false,
      lineStyle: { color: LIVE_MARKET_LINE, width: LIVE_LINE_WIDTH, type: "solid" },
      itemStyle: { color: LIVE_MARKET_LINE },
      areaStyle: { color: LIVE_MARKET_AREA_GRADIENT },
      emphasis: { focus: "series" },
    });
  }

  const extentDaysCeil =
    merged.tMax > merged.tMin ? Math.ceil((merged.tMax - merged.tMin) / CHART_DAY_SEC) : null;
  const roughTickDays = merged.fixedWindowDays ?? extentDaysCeil;
  const roughTick = roughTickConfigByWindowDays(roughTickDays ?? null);

  const axisSpanDays =
    merged.tMax > merged.tMin ? (merged.tMax - merged.tMin) / CHART_DAY_SEC : 0;
  const useCoarseTimeTicks = axisSpanDays > 1;

  const yTickCount = compactTab ? 2 : isMobileChart ? 3 : 4;
  const { min, max, interval } = niceScale(merged.vMin, merged.vMax, yTickCount);

  return {
    backgroundColor: "transparent",
    animation: !compactTab,
    animationDuration: compactTab ? 0 : 250,
    textStyle: { color: AXIS_LABEL, fontFamily: "ui-sans-serif, system-ui, sans-serif" },
    grid: compactTab
      ? { left: 28, right: 4, top: 6, bottom: 20, containLabel: false }
      : isMobileChart
        ? { left: 32, right: 6, top: 10, bottom: 24, containLabel: false }
        : { left: 48, right: 10, top: 4, bottom: 22, containLabel: false },
    dataZoom: [
      { type: "inside", xAxisIndex: 0, filterMode: "none" },
      { type: "slider", xAxisIndex: 0, height: 16, bottom: 0, show: false },
    ],
    xAxis: {
      type: "time",
      min: merged.tMin * 1000,
      max: merged.tMax * 1000,
      ...(useCoarseTimeTicks
        ? {
            minInterval: roughTick.minIntervalMs,
            splitNumber: roughTick.splitNumber,
          }
        : {}),
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: {
        color: AXIS_LABEL,
        fontSize: isMobileChart ? 10 : 13,
        hideOverlap: true,
        margin: isMobileChart ? 6 : 8,
        formatter: (value: number) => {
          const tSec = Math.floor(value / 1000);
          if (!useCoarseTimeTicks) return formatTickDate(tSec);
          return roughTick.formatter(tSec);
        },
      },
    },
    yAxis: {
      type: "value",
      min,
      max,
      interval,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: {
        color: AXIS_LABEL,
        fontSize: isMobileChart ? 9 : 11,
        width: isMobileChart ? 30 : 44,
        overflow: "truncate",
        formatter: (value: number) =>
          isMobileChart
            ? formatYAxisLabelCompact(value)
            : (() => {
                if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
                if (value >= 1_000) {
                  return `$${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}K`;
                }
                if (value >= 10) return `$${Math.round(value)}`;
                return `$${value.toFixed(value === 0 ? 0 : 2)}`;
              })(),
      },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "line",
        lineStyle: { color: "rgba(255,255,255,0.26)", type: "dashed" },
      },
      backgroundColor: "rgba(10,10,12,0.95)",
      borderColor: "rgba(255,255,255,0.10)",
      textStyle: { color: "#f4f4f5", fontSize: 11 },
      formatter: (params: unknown) => {
        const rows = Array.isArray(params) ? params : [];
        const first = rows[0] as { axisValue?: number } | undefined;
        const t = first?.axisValue != null ? Math.floor(first.axisValue / 1000) : null;

        const pick = (name: string) =>
          rows.find((r) => (r as { seriesName?: string }).seriesName === name) as
            | { value?: [number, number] }
            | undefined;

        const e =
          pick(externalSeriesShortLabel)?.value?.[1] ??
          pick(externalRefLineTag)?.value?.[1] ??
          null;

        const when = t != null ? formatHoverWhen(t) : "";
        return [
          `<div style="color:#a1a1aa;font-size:10px;margin-bottom:6px">${when}</div>`,
          `<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:#e4e4e7">Live Market Price</span><span style="color:${LIVE_MARKET_LINE};font-weight:600">${formatTooltipUsd(
            e as number | null,
          )}</span></div>`,
        ].join("");
      },
    },
    series,
  };
}
