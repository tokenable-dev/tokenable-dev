import type { EChartsOption, LineSeriesOption } from "echarts";
import {
  AXIS_LABEL,
  AXIS_LABEL_MOBILE,
  CHART_DAY_SEC,
  COLLECTION_DETAIL_AXIS_LABEL,
  COLLECTION_DETAIL_AZURE,
  COLLECTION_DETAIL_CHART_DATE_FONT,
  COLLECTION_DETAIL_CHART_MARK_FONT,
  COLLECTION_DETAIL_CHART_MONO,
  COLLECTION_DETAIL_LINE_WIDTH,
  collectionDetailChartAreaGradient,
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
  formatCardHtmlThreeTickDayLabel,
  cardHtmlPeriodAxisTickMs,
} from "./chartTimeTicks";
import type { MergedExternalChartData } from "./types";

type ChartXy = [number, number];

function seriesMedianUsd(data: ChartXy[]): number | null {
  const vs = data
    .map((p) => p[1])
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  if (vs.length === 0) return null;
  const mid = Math.floor(vs.length / 2);
  return vs.length % 2 === 1 ? vs[mid]! : (vs[mid - 1]! + vs[mid]!) / 2;
}

function markSide(coordX: number, tMinMs: number, tMaxMs: number): "left" | "right" {
  const span = tMaxMs - tMinMs;
  if (!(span > 0)) return "right";
  return coordX > tMinMs + span * 0.7 ? "left" : "right";
}

function cardHtmlDecorateLine(
  seriesItem: LineSeriesOption,
  data: ChartXy[],
  lineColor: string,
): LineSeriesOption {
  if (data.length === 0) return seriesItem;
  const first = data[0]!;
  const last = data[data.length - 1]!;
  let hi = first;
  let lo = first;
  for (const p of data) {
    if (p[1] > hi[1]) hi = p;
    if (p[1] < lo[1]) lo = p;
  }
  const median = seriesMedianUsd(data);
  const tMin = first[0];
  const tMax = last[0];

  const marks: NonNullable<LineSeriesOption["markPoint"]>["data"] = [];
  if (hi[1] !== last[1]) {
    marks.push({
      name: "high",
      coord: hi,
      symbol: "circle",
      symbolSize: 6.4,
      itemStyle: { color: "rgba(255,255,255,0.75)", borderWidth: 0 },
      label: {
        show: true,
        formatter: `High ${formatCardHtmlTooltipUsd(hi[1])}`,
        position: markSide(hi[0], tMin, tMax),
        color: "rgba(255,255,255,0.6)",
        fontWeight: 600,
        fontSize: COLLECTION_DETAIL_CHART_MARK_FONT,
        fontFamily: COLLECTION_DETAIL_CHART_MONO,
        distance: 8,
      },
    });
  }
  marks.push({
    name: "low",
    coord: lo,
    symbol: "circle",
    symbolSize: 6.4,
    itemStyle: { color: "rgba(255,255,255,0.4)", borderWidth: 0 },
    label: {
      show: true,
      formatter: `Low ${formatCardHtmlTooltipUsd(lo[1])}`,
      position: "bottom",
      color: "rgba(255,255,255,0.42)",
      fontWeight: 600,
      fontSize: COLLECTION_DETAIL_CHART_MARK_FONT,
      fontFamily: COLLECTION_DETAIL_CHART_MONO,
      distance: 8,
    },
  });
  marks.push({
    name: "now",
    coord: last,
    symbol: "circle",
    symbolSize: 8,
    itemStyle: {
      color: "#fff",
      borderColor: lineColor,
      borderWidth: 2,
    },
    label: {
      show: true,
      formatter: formatCardHtmlTooltipUsd(last[1]),
      /* Inside the plot (Card.html pill overlays the line end — do not steal grid.right). */
      position: "left",
      backgroundColor: lineColor,
      color: "#fff",
      fontWeight: 800,
      fontSize: 12,
      fontFamily: COLLECTION_DETAIL_CHART_MONO,
      padding: [5, 9],
      borderRadius: 5,
      distance: 10,
      overflow: "none",
    },
  });

  const markLineData: NonNullable<LineSeriesOption["markLine"]>["data"] = [
    {
      yAxis: last[1],
      lineStyle: {
        type: [4, 4],
        color: "rgba(26,111,255,0.5)",
        width: 1,
      },
      label: { show: false },
    },
  ];
  if (median != null && Number.isFinite(median)) {
    markLineData.push({
      yAxis: median,
      lineStyle: {
        type: [5, 4],
        color: "rgba(255,255,255,0.45)",
        width: 1,
      },
      label: {
        show: true,
        formatter: `Median ${formatCardHtmlTooltipUsd(median)}`,
        position: "middle",
        backgroundColor: "#191919",
        color: "rgba(255,255,255,0.72)",
        fontWeight: 600,
        fontSize: 11,
        fontFamily: COLLECTION_DETAIL_CHART_MONO,
        padding: [2, 4],
      },
    });
  }

  return {
    ...seriesItem,
    showSymbol: false,
    symbol: "circle",
    symbolSize: 9,
    itemStyle: {
      color: "#fff",
      borderColor: lineColor,
      borderWidth: 2,
    },
    emphasis: {
      focus: "none",
      scale: false,
      itemStyle: {
        color: "#fff",
        borderColor: lineColor,
        borderWidth: 2,
      },
    },
    markLine: {
      silent: true,
      symbol: "none",
      animation: false,
      clip: false,
      label: { show: false },
      data: markLineData,
    },
    markPoint: {
      silent: true,
      animation: false,
      clip: false,
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
  const lineColor = isCardHtml ? COLLECTION_DETAIL_AZURE : LIVE_MARKET_LINE;
  const areaGradient = isCardHtml
    ? collectionDetailChartAreaGradient()
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
      isCardHtml
        ? cardHtmlDecorateLine(line, merged.externalSeries, lineColor)
        : line,
    );
  }
  if (externalFlatSeries.length) {
    const flatColor = isCardHtml ? COLLECTION_DETAIL_AZURE : lineColor;
    const flatArea = isCardHtml
      ? collectionDetailChartAreaGradient()
      : areaGradient;
    const flat: LineSeriesOption = {
      name: externalRefLineTag,
      type: "line",
      data: externalFlatSeries,
      showSymbol: false,
      smooth: false,
      lineStyle: { color: flatColor, width: lineWidth, type: "solid" },
      itemStyle: { color: flatColor },
      areaStyle: { color: flatArea },
      emphasis: { focus: "series" },
    };
    series.push(
      isCardHtml
        ? cardHtmlDecorateLine(flat, externalFlatSeries, flatColor)
        : flat,
    );
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

  const xSpanMs =
    merged.tMax > merged.tMin ? (merged.tMax - merged.tMin) * 1000 : 0;

  return {
    backgroundColor: "transparent",
    animation: isCardHtml ? false : !compactTab,
    animationDuration: isCardHtml || compactTab ? 0 : 250,
    textStyle: {
      color: axisLabelColor,
      fontFamily: axisFontFamily ?? "ui-sans-serif, system-ui, sans-serif",
    },
    grid: isCardHtml
      ? { left: 16, right: 16, top: 22, bottom: 20, containLabel: false }
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
      {
        type: "inside" as const,
        xAxisIndex: 0,
        filterMode: "none" as const,
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        moveOnMouseWheel: false,
        preventDefaultMouseMove: true,
        ...(xSpanMs > 0
          ? {
              minValueSpan: Math.min(
                2 * CHART_DAY_SEC * 1000,
                xSpanMs * 0.05,
              ),
            }
          : {}),
      },
    ],
    xAxis: isCardHtml
      ? {
          /* value (ms), not time — ECharts 6 TimeScale.leveledFormat crashes on customValues. */
          type: "value" as const,
          min: merged.tMin * 1000,
          max: merged.tMax * 1000,
          splitNumber: 2,
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: {
            color: axisLabelColor,
            fontSize: COLLECTION_DETAIL_CHART_DATE_FONT,
            fontFamily: COLLECTION_DETAIL_CHART_MONO,
            hideOverlap: false,
            showMinLabel: true,
            showMaxLabel: true,
            alignMinLabel: "left" as const,
            alignMaxLabel: "right" as const,
            customValues: cardHtmlPeriodAxisTickMs(merged.tMin, merged.tMax),
            margin: isMobileChart ? 12 : 10,
            padding: [4, 0, 0, isMobileChart ? 6 : 4],
            formatter: (value: number) =>
              formatCardHtmlThreeTickDayLabel(
                Math.floor(value / 1000),
                merged.tMin,
                merged.tMax,
              ),
          },
        }
      : {
          type: "time" as const,
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
            fontFamily: axisFontFamily,
            hideOverlap: true,
            showMinLabel: true,
            showMaxLabel: true,
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
      position: isCardHtml ? "right" : "left",
      min,
      max,
      splitNumber: isCardHtml ? 3 : undefined,
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
        formatter: (value: number) => {
          if (isCardHtml) return "";
          return isYearView
            ? formatYAxisLabelPlain(value)
            : formatYAxisLabelCompact(value);
        },
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
      backgroundColor: isCardHtml ? "#1c1e26" : "rgba(10,10,12,0.95)",
      borderWidth: 1,
      borderColor: isCardHtml
        ? "rgba(255,255,255,0.09)"
        : "rgba(255,255,255,0.10)",
      extraCssText: isCardHtml
        ? "border-radius:8px;box-shadow:0 8px 24px -8px rgba(0,0,0,0.7);padding:7px 10px;white-space:nowrap;"
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
            pos[1] - size.contentSize[1] - 12,
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
        if (isCardHtml) {
          return [
            `<div style="font-family:${COLLECTION_DETAIL_CHART_MONO};font-size:13px;font-weight:800;color:#fff;">${formatCardHtmlTooltipUsd(e as number | null)}</div>`,
            `<div style="font-family:${COLLECTION_DETAIL_CHART_MONO};font-size:11px;color:rgba(255,255,255,0.52);margin-top:2px;">${when}</div>`,
          ].join("");
        }
        return [
          `<div style="color:rgba(255,255,255,0.55);font-size:10px;margin-bottom:6px;font-family:var(--font-mono),monospace">${when}</div>`,
          `<div style="display:flex;justify-content:space-between;align-items:center;gap:16px"><span style="color:#e4e4e7;font-size:12px;">Live Market Price</span><span style="color:${lineColor};font-weight:500;font-size:12px;font-family:var(--font-mono),monospace">${formatTooltipUsd(e as number | null)}</span></div>`,
        ].join("");
      },
    },
    series,
  };
}
