"use client";

import { useMemo, type ReactNode } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption, LineSeriesOption } from "echarts";
import type { CollectionUsdPoint } from "@/lib/core";
import {
  COLLECTION_CHART_SURFACE,
  COLLECTION_DETAILS_BG_CLASS,
  COLLECTION_DETAILS_BORDER_ALL,
} from "@/components/marketplace/collectionOverviewChrome";

const LIVE_MARKET_LINE = "rgba(135, 255, 72, 1)";
/** Area under line — light mint wash; keep low alpha so panel reads as one surface. */
const LIVE_MARKET_AREA_GRADIENT = {
  type: "linear" as const,
  x: 0,
  y: 0,
  x2: 0,
  y2: 1,
  colorStops: [
    { offset: 0, color: "rgba(135, 255, 72, 0.14)" },
    { offset: 0.55, color: "rgba(135, 255, 72, 0.04)" },
    { offset: 1, color: "rgba(135, 255, 72, 0)" },
  ],
};
/** X/Y tick labels — silver / light grey */
const AXIS_LABEL = "rgba(190, 190, 195, 0.92)";

const LIVE_LINE_WIDTH = 3;
const DAY = 86400;
const HOUR = 3600;

function niceScale(
  rawMin: number,
  rawMax: number,
  targetTicks = 5,
): { min: number; max: number; interval: number } {
  const range = rawMax - rawMin;
  if (range === 0 || !Number.isFinite(range)) return { min: 0, max: 1, interval: 0.25 };

  const roughStep = range / Math.max(targetTicks - 1, 1);
  const mag = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const norm = roughStep / mag;

  let step: number;
  if (norm <= 1) step = mag;
  else if (norm <= 2) step = 2 * mag;
  else if (norm <= 2.5) step = 2.5 * mag;
  else if (norm <= 5) step = 5 * mag;
  else step = 10 * mag;

  const min = Math.max(0, Math.floor(rawMin / step) * step);
  const max = Math.ceil(rawMax / step) * step;
  return { min, max, interval: step };
}

function utcDayKey(tSec: number): string {
  const d = new Date(tSec * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

function buildPlatformUtcDayStaticPoints(
  points: CollectionUsdPoint[],
  nowSec: number,
): CollectionUsdPoint[] {
  if (points.length === 0) return [];
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const byDay = new Map<string, CollectionUsdPoint>();
  for (const p of sorted) {
    if (!(typeof p.v === "number" && Number.isFinite(p.v) && p.v > 0)) continue;
    const k = utcDayKey(p.t);
    const prev = byDay.get(k);
    if (!prev || p.t >= prev.t) byDay.set(k, p);
  }

  const out: CollectionUsdPoint[] = [];
  for (const k of [...byDay.keys()].sort()) {
    const last = byDay.get(k)!;
    const [y, mo, d] = k.split("-").map(Number);
    const tNoon = Math.floor(Date.UTC(y!, mo! - 1, d!, 12, 0, 0) / 1000);
    out.push({ t: Math.min(tNoon, nowSec), v: last.v });
  }
  return out;
}

function formatTickDate(tSec: number): string {
  return new Date(tSec * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTickMonth(tSec: number): string {
  return new Date(tSec * 1000).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  });
}

/** Long spans — readable month + full year */
function formatTickMonthYearNumeric(tSec: number): string {
  return new Date(tSec * 1000).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function roughTickConfigByWindowDays(windowDays: number | null): {
  minIntervalMs: number;
  splitNumber: number;
  formatter: (tSec: number) => string;
} {
  if (windowDays == null || !Number.isFinite(windowDays) || windowDays <= 0) {
    return {
      minIntervalMs: 120 * DAY * 1000,
      splitNumber: 5,
      formatter: formatTickMonthYearNumeric,
    };
  }
  if (windowDays <= 7) {
    return {
      minIntervalMs: 2 * DAY * 1000,
      splitNumber: 4,
      formatter: formatTickDate,
    };
  }
  if (windowDays <= 30) {
    return {
      minIntervalMs: 7 * DAY * 1000,
      splitNumber: 5,
      formatter: formatTickDate,
    };
  }
  if (windowDays <= 90) {
    return {
      minIntervalMs: 21 * DAY * 1000,
      splitNumber: 5,
      formatter: formatTickDate,
    };
  }
  if (windowDays <= 180) {
    return {
      minIntervalMs: 45 * DAY * 1000,
      splitNumber: 5,
      formatter: formatTickMonth,
    };
  }
  if (windowDays <= 365) {
    return {
      minIntervalMs: 75 * DAY * 1000,
      splitNumber: 5,
      formatter: formatTickMonth,
    };
  }
  if (windowDays <= 730) {
    return {
      minIntervalMs: 120 * DAY * 1000,
      splitNumber: 5,
      formatter: formatTickMonthYearNumeric,
    };
  }
  return {
    minIntervalMs: 180 * DAY * 1000,
    splitNumber: 5,
    formatter: formatTickMonthYearNumeric,
  };
}

function formatHoverWhen(tSec: number): string {
  return new Date(tSec * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTooltipUsd(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v >= 100 ? `$${v.toFixed(0)}` : `$${v.toFixed(2)}`;
}

function computeSmartTimeDomain(
  plat: CollectionUsdPoint[],
  nowSec: number,
  wideWindowSec: number,
): { tMin: number; tMax: number } {
  if (plat.length === 0) return { tMin: nowSec - 7 * DAY, tMax: nowSec };

  const ts = plat.map((p) => p.t);
  const dataTMin = Math.min(...ts);
  const dataTMax = Math.max(...ts);
  const dataSpan = Math.max(dataTMax - dataTMin, 1);
  const windowLo = nowSec - wideWindowSec;
  const windowSpan = Math.max(nowSec - windowLo, DAY);

  if (dataSpan < 0.14 * windowSpan) {
    const pad = Math.max(2 * HOUR, Math.min(3 * DAY, Math.max(dataSpan * 0.12, 4 * HOUR)));
    let lo = dataTMin - pad;
    let hi = Math.max(dataTMax + pad, nowSec + 2 * HOUR);
    const minDur = plat.length <= 2 ? 4 * DAY : 36 * HOUR;
    if (hi - lo < minDur) {
      const c = (lo + hi) / 2;
      lo = c - minDur / 2;
      hi = c + minDur / 2;
    }
    return { tMin: lo, tMax: Math.max(hi, nowSec + HOUR) };
  }

  const padWide = Math.max(DAY, dataSpan * 0.02);
  return {
    tMin: Math.min(dataTMin - padWide, windowLo),
    tMax: Math.max(dataTMax + padWide, nowSec),
  };
}

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
  footnote = null,
  emptyStateMessage,
  isLoading,
  errorMessage,
  variant = "default",
  collectionOverviewMat = false,
}: {
  /** On-platform trade points; not drawn in the chart (live market / external only). */
  platformUsd: CollectionUsdPoint[];
  externalMarketUsd?: number | null;
  externalWindowDays?: number | null;
  externalRollingUsd?: CollectionUsdPoint[] | null;
  externalRollingKind?: "history" | "snapshot" | "synthetic";
  externalLegendLabel?: string;
  externalSeriesShortLabel?: string;
  externalRefLineTag?: string;
  chartTitle?: string;
  controls?: ReactNode;
  /** Optional muted note rendered under chart range controls */
  footnote?: ReactNode;
  emptyStateMessage?: string;
  isLoading?: boolean;
  errorMessage?: string | null;
  variant?: "default" | "exchange";
  /** When `variant` is exchange and true, shell matches collection cover mat tones. */
  collectionOverviewMat?: boolean;
}) {
  const exchange = variant === "exchange";
  const chartShellDefault = `rounded-2xl ${COLLECTION_DETAILS_BORDER_ALL} ${COLLECTION_DETAILS_BG_CLASS} shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]`;
  const exchangeChrome =
    exchange && collectionOverviewMat
      ? COLLECTION_CHART_SURFACE
      : chartShellDefault;
  const nowSec = Math.floor(Date.now() / 1000);

  const merged = useMemo(() => {
    const extRolling = externalRollingUsd?.length
      ? [...externalRollingUsd].sort((a, b) => a.t - b.t)
      : [];

    const hasExtSignal =
      extRolling.length > 0 ||
      (externalMarketUsd != null && Number.isFinite(externalMarketUsd) && externalMarketUsd > 0);

    const useFixedWindow =
      hasExtSignal &&
      externalWindowDays != null &&
      Number.isFinite(externalWindowDays) &&
      externalWindowDays > 0;

    let tMin: number;
    let tMax: number;

    if (useFixedWindow) {
      const windowTMin = nowSec - externalWindowDays! * DAY;
      let windowTMax = nowSec + 6 * HOUR;

      const relevantTimes: number[] = [];
      for (const p of extRolling) {
        if (Number.isFinite(p.t)) relevantTimes.push(p.t);
      }

      /**
       * Keep the x-axis within the user-selected window (`externalWindowDays`). Points older than
       * `windowTMin` are intentionally clipped by `extInWindow`; expanding
       * `tMin` to `dataMin` made 7D/30D/90D show the same full-year Cardhedger curve.
       */
      if (relevantTimes.length > 0) {
        const dataMin = Math.min(...relevantTimes);
        const dataMax = Math.max(...relevantTimes);
        const dataSpan = Math.max(dataMax - dataMin, DAY);
        const leftPad = Math.min(14 * DAY, Math.max(2 * DAY, Math.floor(dataSpan * 0.04)));
        const maxTrailingVoid = Math.min(120 * DAY, Math.max(10 * DAY, Math.floor(dataSpan * 0.12)));

        const baseLeft = Math.max(windowTMin, dataMin - maxTrailingVoid);
        tMin = baseLeft - leftPad;
        tMax = Math.max(windowTMax, dataMax + leftPad);
      } else {
        tMin = windowTMin;
        tMax = windowTMax;
      }
    } else {
      const extForSmart = extRolling.length > 0 ? extRolling : [];
      const smart = computeSmartTimeDomain(extForSmart, nowSec, 180 * DAY);
      tMin = smart.tMin;
      tMax = Math.max(smart.tMax, tMin + 60);
    }

    const extInWindow = extRolling.filter((p) => p.t >= tMin && p.t <= tMax);
    let extForChart = buildPlatformUtcDayStaticPoints(extInWindow, nowSec).map((p) => ({
      ...p,
      t: Math.min(Math.max(p.t, tMin), tMax),
    }));

    /** If UTC-day bucketing collapses a multi-point window to <2 samples, plot raw timestamps. */
    if (extForChart.length < 2) {
      const rawFit = extInWindow.filter(
        (p) => Number.isFinite(p.t) && typeof p.v === "number" && Number.isFinite(p.v) && p.v > 0,
      );
      if (rawFit.length >= 2) {
        extForChart = [...rawFit]
          .sort((a, b) => a.t - b.t)
          .map((p) => ({ ...p, t: Math.min(Math.max(p.t, tMin), tMax) }));
      }
    }

    const extIsPolyline = extForChart.length >= 2;

    const allV = [
      ...extForChart.map((p) => p.v),
      ...(extIsPolyline || externalMarketUsd == null ? [] : [externalMarketUsd]),
    ];

    if (allV.length === 0) {
      return {
        tMin,
        tMax,
        vMin: 0,
        vMax: 1,
        extIsPolyline: false,
        hasExtSignal,
        externalSeries: [] as Array<[number, number]>,
      };
    }

    const vMinD = Math.min(...allV);
    const vMaxD = Math.max(...allV);
    const vPad = Math.max((vMaxD - vMinD) * 0.08, vMaxD * 0.04, 0.5);

    return {
      tMin,
      tMax,
      vMin: Math.max(0, vMinD - vPad),
      vMax: vMaxD + vPad,
      extIsPolyline,
      hasExtSignal,
      externalSeries: extForChart.map((p) => [p.t * 1000, p.v] as [number, number]),
    };
  }, [externalRollingUsd, externalMarketUsd, externalWindowDays, nowSec]);

  const chartOption = useMemo<EChartsOption>(() => {
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
      merged.tMax > merged.tMin
        ? Math.ceil((merged.tMax - merged.tMin) / DAY)
        : null;
    const roughTickDays =
      externalWindowDays != null &&
      extentDaysCeil != null &&
      extentDaysCeil > 0
        ? Math.max(externalWindowDays, extentDaysCeil)
        : externalWindowDays ?? extentDaysCeil;
    const roughTick = roughTickConfigByWindowDays(roughTickDays ?? null);

    /** Coarse ticks for any meaningful span — keeps x-axis readable (fewer labels, wider spacing). */
    const axisSpanDays =
      merged.tMax > merged.tMin ? (merged.tMax - merged.tMin) / DAY : 0;
    const useCoarseTimeTicks = axisSpanDays > 1;

    return {
      backgroundColor: "transparent",
      animationDuration: 250,
      textStyle: { color: AXIS_LABEL, fontFamily: "ui-sans-serif, system-ui, sans-serif" },
      grid: { left: 52, right: 14, top: 10, bottom: 34, containLabel: false },
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
          fontSize: 13,
          hideOverlap: true,
          formatter: (value: number) => {
            const tSec = Math.floor(value / 1000);
            if (!useCoarseTimeTicks) return formatTickDate(tSec);
            return roughTick.formatter(tSec);
          },
        },
      },
      yAxis: (() => {
        const { min, max, interval } = niceScale(merged.vMin, merged.vMax, 5);
        return {
          type: "value",
          min,
          max,
          interval,
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: {
            color: AXIS_LABEL,
            fontSize: 11,
            formatter: (value: number) => {
              if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
              if (value >= 1_000) return `$${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}K`;
              if (value >= 10) return `$${Math.round(value)}`;
              return `$${value.toFixed(value === 0 ? 0 : 2)}`;
            },
          },
        };
      })(),
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
  }, [
    merged,
    externalMarketUsd,
    externalSeriesShortLabel,
    externalRefLineTag,
    externalWindowDays,
  ]);

  if (isLoading) {
    return (
      <div
        className={
          exchange
            ? `${exchangeChrome} flex min-h-[120px] flex-col items-center justify-center gap-3 px-4 max-xl:min-h-[min(140px,20svh)] xl:h-full xl:min-h-0`
            : `${chartShellDefault} flex min-h-[260px] flex-col items-center justify-center gap-3 px-4`
        }
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-solid border-t-transparent"
          style={{ borderColor: `${LIVE_MARKET_LINE}40`, borderTopColor: "transparent" }}
        />
        <p className="text-xs text-zinc-600 text-center">Loading chart…</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div
        className={
          exchange
            ? `${exchangeChrome} flex min-h-[110px] flex-col items-center justify-center px-4 py-6 text-center text-sm text-rose-200/90 max-xl:min-h-[min(128px,18svh)] xl:h-full xl:min-h-0`
            : "rounded-2xl border border-rose-500/20 bg-[rgba(11,13,16,1)] px-4 py-6 text-center text-sm text-rose-200/90"
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
          exchange
            ? `${exchangeChrome} flex min-h-[110px] flex-col items-center justify-center px-4 py-8 text-center text-sm text-zinc-600 max-xl:min-h-[min(128px,18svh)] xl:h-full xl:min-h-0`
            : `${chartShellDefault} flex min-h-[110px] flex-col items-center justify-center px-4 py-8 text-center text-sm text-zinc-600`
        }
      >
        {emptyStateMessage ??
          "No live market price series yet — external NM history will appear here when available."}
      </div>
    );
  }

  return (
    <div
      className={
        exchange
          ? `${exchangeChrome} flex min-h-[134px] flex-col overflow-hidden text-white max-xl:min-h-[min(154px,21svh)] xl:h-full xl:min-h-0`
          : `${chartShellDefault} text-white`
      }
    >
      {/* Top bar: range controls (left) + legend (right) — single row */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-3 pt-2.5 pb-1.5 sm:px-4">
        {/* Range buttons */}
        {controls ? <div className="flex items-center">{controls}</div> : null}

        {/* Legend */}
        <div className="flex items-center gap-3 text-[10px] font-medium sm:text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: LIVE_MARKET_LINE }} aria-hidden />
            <span className={merged.hasExtSignal ? "text-white/90" : "text-white/35"}>
              Live Market Price
            </span>
          </div>
          {footnote ? <div className="text-zinc-500">{footnote}</div> : null}
        </div>
      </div>

      {/* Chart */}
      <div className={exchange ? "flex min-h-0 flex-1 flex-col px-2 pb-1.5 pt-0 sm:px-3 sm:pb-2" : "px-2 pb-3 pt-0 sm:px-4"}>
        <ReactECharts
          option={chartOption}
          notMerge
          lazyUpdate
          style={{
            width: "100%",
            height: exchange ? "100%" : "300px",
            minHeight: exchange ? 110 : 200,
          }}
          className={exchange ? "min-h-[110px] xl:min-h-[136px]" : "min-h-[200px]"}
        />
      </div>
    </div>
  );
}
