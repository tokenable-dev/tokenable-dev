import type { EChartsOption, LineSeriesOption } from "echarts";
import {
  AXIS_LABEL,
  AXIS_LABEL_MOBILE,
  CHART_DAY_SEC,
  COLLECTION_DETAIL_AXIS_LABEL,
  COLLECTION_DETAIL_CHART_AREA_GRADIENT,
  COLLECTION_DETAIL_CHART_DATE_FONT,
  COLLECTION_DETAIL_CHART_LINE,
  COLLECTION_DETAIL_CHART_MARK_FONT,
  COLLECTION_DETAIL_CHART_MONO,
  COLLECTION_DETAIL_LINE_WIDTH,
  LIVE_LINE_WIDTH,
  LIVE_MARKET_AREA_GRADIENT,
  LIVE_MARKET_LINE,
} from "./constants";
import { niceScale, yearViewPriceScale } from "./chartScale";
import {
  formatCardHtmlHoverWhen,
  formatHoverWhen,
  formatTickShortMdYear,
  formatTickYearOrMonthLabel,
  formatCardHtmlTooltipUsd,
  formatTooltipUsd,
  formatYAxisLabelCompact,
  formatYAxisLabelPlain,
  roughTickConfigByWindowDays,
  roughTickConfigCardHtml,
} from "./chartTimeTicks";
import type { MergedExternalChartData } from "./types";

type ChartXy = [number, number];

function cardHtmlDecorateLine(
  seriesItem: LineSeriesOption,
  data: ChartXy[],
): LineSeriesOption {
  if (data.length === 0) return seriesItem;
  let hi = data[0]!;
  let lo = data[0]!;
  for (const p of data) {
    if (p[1] > hi[1]) hi = p;
    if (p[1] < lo[1]) lo = p;
  }
  const first = data[0]!;
  const lastIdx = data.length - 1;

  const marks: NonNullable<LineSeriesOption["markPoint"]>["data"] = [
    {
      name: "high",
      coord: hi,
      symbol: "circle",
      symbolSize: 7,
      itemStyle: { color: "rgba(255,255,255,0.92)", borderWidth: 0 },
      label: {
        show: true,
        formatter: `High ${formatCardHtmlTooltipUsd(hi[1])}`,
        position: "top",
        color: "#fff",
        fontWeight: 600,
        fontSize: COLLECTION_DETAIL_CHART_MARK_FONT,
        fontFamily: COLLECTION_DETAIL_CHART_MONO,
        distance: 10,
      },
    },
  ];
  if (hi[0] !== lo[0] || hi[1] !== lo[1]) {
    marks.push({
      name: "low",
      coord: lo,
      symbol: "circle",
      symbolSize: 7,
      itemStyle: { color: "rgba(150,170,210,0.9)", borderWidth: 0 },
      label: {
        show: true,
        formatter: `Low ${formatCardHtmlTooltipUsd(lo[1])}`,
        position: "bottom",
        color: "rgba(200,214,240,0.95)",
        fontWeight: 600,
        fontSize: COLLECTION_DETAIL_CHART_MARK_FONT,
        fontFamily: COLLECTION_DETAIL_CHART_MONO,
        distance: 10,
      },
    });
  }

  return {
    ...seriesItem,
    showSymbol: true,
    symbol: "circle",
    symbolSize: (_value: unknown, params: { dataIndex?: number }) =>
      params.dataIndex === lastIdx ? 8 : 0,
    itemStyle: {
      color: "#fff",
      borderColor: COLLECTION_DETAIL_CHART_LINE,
      borderWidth: 2,
    },
    emphasis: {
      focus: "none",
      scale: false,
      itemStyle: {
        color: "#fff",
        borderColor: COLLECTION_DETAIL_CHART_LINE,
        borderWidth: 2,
      },
    },
    markLine: {
      silent: true,
      symbol: "none",
      animation: false,
      label: { show: false },
      lineStyle: {
        type: [4, 4],
        color: "rgba(255,255,255,0.14)",
        width: 1,
      },
      data: [{ yAxis: first[1] }],
    },
    markPoint: {
      silent: true,
      animation: false,
      label: {
        fontSize: COLLECTION_DETAIL_CHART_MARK_FONT,
        fontWeight: 600,
        fontFamily: COLLECTION_DETAIL_CHART_MONO,
      },
      data: marks,
    },
  };
}

export function buildCollectionDualPriceChartOption(input: {
  merged: MergedExternalChartData;
  externalMarketUsd?: number | null;
  externalSeriesShortLabel: string;
  externalRefLineTag: string;
  isMobileChart: boolean;
  compactTab: boolean;
  colorTheme?: "default" | "collection-detail";
}): EChartsOption {
  const {
    merged,
    externalMarketUsd,
    externalSeriesShortLabel,
    externalRefLineTag,
    isMobileChart,
    compactTab,
    colorTheme = "default",
  } = input;

  const isCardHtml = colorTheme === "collection-detail";
  const lineColor = isCardHtml ? COLLECTION_DETAIL_CHART_LINE : LIVE_MARKET_LINE;
  const areaGradient = isCardHtml
    ? COLLECTION_DETAIL_CHART_AREA_GRADIENT
    : LIVE_MARKET_AREA_GRADIENT;
  const lineWidth = isCardHtml ? COLLECTION_DETAIL_LINE_WIDTH : LIVE_LINE_WIDTH;

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
    const line: LineSeriesOption = {
      name: externalSeriesShortLabel,
      type: "line",
      data: merged.externalSeries,
      showSymbol: false,
      smooth: false,
      connectNulls: true,
      lineStyle: { color: lineColor, width: lineWidth },
      itemStyle: { color: lineColor },
      areaStyle: { color: areaGradient },
      emphasis: { focus: "series" },
    };
    series.push(
      isCardHtml ? cardHtmlDecorateLine(line, merged.externalSeries) : line,
    );
  }
  if (externalFlatSeries.length) {
    const flat: LineSeriesOption = {
      name: externalRefLineTag,
      type: "line",
      data: externalFlatSeries,
      showSymbol: false,
      smooth: false,
      lineStyle: { color: lineColor, width: lineWidth, type: "solid" },
      itemStyle: { color: lineColor },
      areaStyle: { color: areaGradient },
      emphasis: { focus: "series" },
    };
    series.push(isCardHtml ? cardHtmlDecorateLine(flat, externalFlatSeries) : flat);
  }

  const extentDaysCeil =
    merged.tMax > merged.tMin
      ? Math.ceil((merged.tMax - merged.tMin) / CHART_DAY_SEC)
      : null;
  const roughTickDays = merged.fixedWindowDays ?? extentDaysCeil;
  const roughTick = isCardHtml
    ? roughTickConfigCardHtml(roughTickDays ?? null)
    : roughTickConfigByWindowDays(roughTickDays ?? null);

  const axisSpanDays =
    merged.tMax > merged.tMin ? (merged.tMax - merged.tMin) / CHART_DAY_SEC : 0;
  const useCoarseTimeTicks = axisSpanDays > 1;
  // Card.html uses the same `lab()` for all windows — no separate 1Y chrome.
  const isYearView =
    !isCardHtml &&
    merged.fixedWindowDays != null &&
    merged.fixedWindowDays >= 300;

  const yTickCount = compactTab ? 8 : isMobileChart ? 10 : 12;
  const { min, max, interval } = isCardHtml
    ? (() => {
        const mx = merged.vMax;
        const mn = merged.vMin;
        const pad = (mx - mn) * 0.14 || mx * 0.1;
        return {
          min: Math.max(0, mn - pad),
          max: mx + pad,
          interval: undefined as number | undefined,
        };
      })()
    : isYearView
      ? yearViewPriceScale(merged.vMin, merged.vMax)
      : niceScale(merged.vMin, merged.vMax, yTickCount);

  const axisLabelColor = isCardHtml
    ? COLLECTION_DETAIL_AXIS_LABEL
    : isMobileChart
      ? AXIS_LABEL_MOBILE
      : AXIS_LABEL;
  const axisLabelSize = isCardHtml ? 13 : isMobileChart ? 10 : 13;
  const yAxisLabelSize = isCardHtml ? 13 : isMobileChart ? 10 : 11;
  const yearViewYAxisNamePadBottom = isMobileChart ? 12 : 16;
  const yearViewGridTop = compactTab ? 30 : isMobileChart ? 36 : 40;
  // Card.html: Inter 13px axis labels (Y is sans, not mono).
  const axisFontFamily = isCardHtml
    ? "var(--font-sans), Inter, system-ui, sans-serif"
    : undefined;

  return {
    backgroundColor: "transparent",
    animation: !compactTab,
    animationDuration: compactTab ? 0 : 250,
    textStyle: {
      color: axisLabelColor,
      fontFamily: axisFontFamily ?? "ui-sans-serif, system-ui, sans-serif",
    },
    grid: isCardHtml
      ? { left: 16, right: 16, top: 30, bottom: 28, containLabel: false }
      : compactTab
      ? {
          left: 38,
          right: 6,
          top: isYearView ? yearViewGridTop : 20,
          bottom: 30,
          containLabel: false,
        }
      : isMobileChart
        ? {
            left: 44,
            right: 8,
            top: isYearView ? yearViewGridTop : 26,
            bottom: 36,
            containLabel: false,
          }
        : isYearView
          ? {
              left: 52,
              right: 12,
              top: yearViewGridTop,
              bottom: 32,
              containLabel: false,
            }
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
            splitNumber: isCardHtml ? 2 : roughTick.splitNumber,
          }
        : {}),
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: {
        color: axisLabelColor,
        fontSize: isCardHtml ? COLLECTION_DETAIL_CHART_DATE_FONT : axisLabelSize,
        fontFamily: isCardHtml ? COLLECTION_DETAIL_CHART_MONO : axisFontFamily,
        hideOverlap: true,
        showMinLabel: isCardHtml ? true : undefined,
        showMaxLabel: isCardHtml ? true : undefined,
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
          if (isCardHtml) {
            return roughTick.formatter(tSec);
          }
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
      ...(interval != null ? { interval } : {}),
      name: isYearView ? "USD" : undefined,
      nameLocation: "end",
      nameGap: isMobileChart ? 10 : 12,
      nameTextStyle: {
        color: axisLabelColor,
        fontSize: yAxisLabelSize,
        align: "right",
        padding: [0, 6, yearViewYAxisNamePadBottom, 0],
      },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: {
        show: !isCardHtml,
        color: axisLabelColor,
        fontSize: yAxisLabelSize,
        fontFamily: axisFontFamily,
        width: isMobileChart ? 34 : 44,
        overflow: "truncate",
        align: "right",
        margin: isMobileChart ? 10 : 8,
        padding: [0, 0, isMobileChart ? 4 : 2, 0],
        formatter: (value: number) =>
          isCardHtml || isYearView
            ? formatYAxisLabelPlain(value)
            : formatYAxisLabelCompact(value),
      },
    },
    tooltip: {
      trigger: "axis",
      confine: true,
      axisPointer: {
        type: "line",
        snap: true,
        label: { show: false },
        lineStyle: {
          color: isCardHtml ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.26)",
          width: 1,
          type: isCardHtml ? "solid" : "dashed",
        },
      },
      backgroundColor: isCardHtml ? "var(--ink-2, #0e0e0e)" : "rgba(10,10,12,0.95)",
      borderWidth: isCardHtml ? 0 : 1,
      borderColor: isCardHtml ? "transparent" : "rgba(255,255,255,0.10)",
      extraCssText: isCardHtml
        ? "filter:drop-shadow(5px 5px 0 rgba(26,111,255,0.5));padding:12px 15px;border-radius:0;white-space:nowrap;"
        : undefined,
      position: isCardHtml
        ? (
            pos: number[],
            _params: unknown,
            _el: unknown,
            _rect: unknown,
            size: { contentSize: number[] },
          ) => [
            pos[0] - size.contentSize[0] / 2,
            pos[1] - size.contentSize[1] - 10,
          ]
        : undefined,
      textStyle: { color: "#f4f4f5", fontSize: isCardHtml ? 12 : 11 },
      formatter: (params: unknown) => {
        const rows = Array.isArray(params) ? params : [];
        const first = rows[0] as { axisValue?: number } | undefined;
        const t =
          first?.axisValue != null ? Math.floor(first.axisValue / 1000) : null;

        const pick = (name: string) =>
          rows.find((r) => (r as { seriesName?: string }).seriesName === name) as
            | { value?: [number, number] }
            | undefined;

        const e =
          pick(externalSeriesShortLabel)?.value?.[1] ??
          pick(externalRefLineTag)?.value?.[1] ??
          null;

        const when =
          t != null
            ? isCardHtml
              ? formatCardHtmlHoverWhen(t)
              : formatHoverWhen(t)
            : "";
        const priceColor = isCardHtml ? "var(--pos, #00C864)" : lineColor;
        return [
          `<div style="color:rgba(255,255,255,0.55);font-size:${isCardHtml ? 12 : 10}px;margin-bottom:${isCardHtml ? 8 : 6}px;font-family:var(--font-mono),monospace">${when}</div>`,
          `<div style="display:flex;justify-content:space-between;align-items:center;gap:${isCardHtml ? 20 : 16}px"><span style="color:${isCardHtml ? "rgba(255,255,255,0.82)" : "#e4e4e7"};font-size:${isCardHtml ? 14 : 12}px;font-family:${isCardHtml ? "var(--font-sans),sans-serif" : "inherit"}">Live Market Price</span><span style="color:${priceColor};font-weight:500;font-size:${isCardHtml ? 15 : 12}px;font-family:var(--font-mono),monospace">${
            isCardHtml
              ? formatCardHtmlTooltipUsd(e as number | null)
              : formatTooltipUsd(e as number | null)
          }</span></div>`,
        ].join("");
      },
    },
    series,
  };
}
