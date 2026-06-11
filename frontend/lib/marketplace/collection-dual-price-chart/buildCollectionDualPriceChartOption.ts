import type { EChartsOption, LineSeriesOption } from "echarts";
import {
  AXIS_LABEL,
  AXIS_LABEL_MOBILE,
  CHART_DAY_SEC,
  LIVE_LINE_WIDTH,
  LIVE_MARKET_AREA_GRADIENT,
  LIVE_MARKET_LINE,
} from "./constants";
import { niceScale, yearViewPriceScale } from "./chartScale";
import {
  formatHoverWhen,
  formatTickShortMdYear,
  formatTickYearOrMonthLabel,
  formatTooltipUsd,
  formatYAxisLabelCompact,
  formatYAxisLabelPlain,
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
  const isYearView =
    merged.fixedWindowDays != null && merged.fixedWindowDays >= 300;

  const yTickCount = compactTab ? 2 : isMobileChart ? 3 : 4;
  const { min, max, interval } = isYearView
    ? yearViewPriceScale(merged.vMin, merged.vMax)
    : niceScale(merged.vMin, merged.vMax, yTickCount);

  const axisLabelColor = isMobileChart ? AXIS_LABEL_MOBILE : AXIS_LABEL;
  const axisLabelSize = isMobileChart ? 10 : 13;
  const yAxisLabelSize = isMobileChart ? 10 : 11;

  return {
    backgroundColor: "transparent",
    animation: !compactTab,
    animationDuration: compactTab ? 0 : 250,
    textStyle: { color: axisLabelColor, fontFamily: "ui-sans-serif, system-ui, sans-serif" },
    grid: compactTab
      ? { left: 38, right: 6, top: 20, bottom: 30, containLabel: false }
      : isMobileChart
        ? { left: 44, right: 8, top: 26, bottom: 36, containLabel: false }
        : isYearView
          ? { left: 52, right: 12, top: 28, bottom: 32, containLabel: false }
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
        color: axisLabelColor,
        fontSize: axisLabelSize,
        hideOverlap: true,
        margin: isMobileChart ? 12 : 10,
        padding: [4, 0, 0, isMobileChart ? 6 : 4],
        rich: isYearView
          ? {
              year: {
                color: axisLabelColor,
                fontWeight: 700,
                fontSize: axisLabelSize,
              },
            }
          : undefined,
        formatter: (value: number) => {
          const tSec = Math.floor(value / 1000);
          if (!useCoarseTimeTicks) return formatTickShortMdYear(tSec);
          if (isYearView) return formatTickYearOrMonthLabel(tSec, merged.tMin);
          return roughTick.formatter(tSec);
        },
      },
    },
    yAxis: {
      type: "value",
      min,
      max,
      interval,
      name: isYearView ? "USD" : undefined,
      nameLocation: "end",
      nameGap: isMobileChart ? 6 : 8,
      nameTextStyle: {
        color: axisLabelColor,
        fontSize: yAxisLabelSize,
        align: "right",
        padding: [0, 6, 0, 0],
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: {
        color: axisLabelColor,
        fontSize: yAxisLabelSize,
        width: isMobileChart ? 34 : 44,
        overflow: "truncate",
        align: "right",
        margin: isMobileChart ? 10 : 8,
        padding: [0, 0, isMobileChart ? 4 : 2, 0],
        formatter: (value: number) =>
          isYearView
            ? formatYAxisLabelPlain(value)
            : isMobileChart
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
