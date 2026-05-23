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
import { useCollectionDetailMobile } from "@/components/marketplace/useCollectionDetailMobile";

const LIVE_MARKET_LINE = "rgba(16, 211, 51, 1)";

export type ChartRangeOption = {
  id: string;
  label: string;
};

/** In-chart segmented range control — floats over plot area. */
export function CollectionChartRangeToolbar({
  options,
  value,
  onChange,
  className = "",
}: {
  options: readonly ChartRangeOption[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Chart time range"
      className={[
        "inline-flex max-w-full items-center gap-0.5 rounded-md bg-white/[0.04] p-0.5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={active}
            className={`touch-manipulation rounded-md px-2 py-1 text-[10px] font-semibold tracking-wide transition-colors sm:px-2.5 sm:text-[11px] ${
              active
                ? "bg-mint/15 text-mint shadow-[inset_0_0_0_1px_rgba(16,211,51,0.35)]"
                : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** Area under line — light mint wash; keep low alpha so panel reads as one surface. */
const LIVE_MARKET_AREA_GRADIENT = {
  type: "linear" as const,
  x: 0,
  y: 0,
  x2: 0,
  y2: 1,
  colorStops: [
    { offset: 0, color: "rgba(16, 211, 51, 0.14)" },
    { offset: 0.55, color: "rgba(16, 211, 51, 0.04)" },
    { offset: 1, color: "rgba(16, 211, 51, 0)" },
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

function validUsdPoints(points: CollectionUsdPoint[]): CollectionUsdPoint[] {
  return points.filter(
    (p) =>
      Number.isFinite(p.t) &&
      typeof p.v === "number" &&
      Number.isFinite(p.v) &&
      p.v > 0,
  );
}

/** Latest in-window price, else headline spot fallback. */
function resolveExternalReferencePrice(
  points: CollectionUsdPoint[],
  fallbackUsd: number | null | undefined,
): number | null {
  const valid = validUsdPoints(points);
  if (valid.length > 0) return valid[valid.length - 1]!.v;
  if (fallbackUsd != null && Number.isFinite(fallbackUsd) && fallbackUsd > 0) {
    return fallbackUsd;
  }
  return null;
}

function isUniformPrice(points: CollectionUsdPoint[]): boolean {
  const valid = validUsdPoints(points);
  if (valid.length <= 1) return valid.length === 1;
  const v0 = valid[0]!.v;
  const tol = Math.max(v0 * 1e-4, 0.01);
  return valid.every((p) => Math.abs(p.v - v0) <= tol);
}

function buildFullWindowFlatSeries(
  tMin: number,
  tMax: number,
  price: number,
): CollectionUsdPoint[] {
  return [
    { t: tMin, v: price },
    { t: tMax, v: price },
  ];
}

/** Carry first/last known prices to the UI window edges (sparse Cardhedger history). */
function extendSeriesToWindowEdges(
  points: CollectionUsdPoint[],
  tMin: number,
  tMax: number,
): CollectionUsdPoint[] {
  const valid = validUsdPoints(points).sort((a, b) => a.t - b.t);
  if (valid.length === 0) return [];
  if (valid.length === 1) {
    return buildFullWindowFlatSeries(tMin, tMax, valid[0]!.v);
  }

  const first = valid[0]!;
  const last = valid[valid.length - 1]!;
  const merged: CollectionUsdPoint[] = [];

  if (first.t > tMin + 60) merged.push({ t: tMin, v: first.v });
  for (const p of valid) {
    merged.push({ t: Math.min(Math.max(p.t, tMin), tMax), v: p.v });
  }
  if (last.t < tMax - 60) merged.push({ t: tMax, v: last.v });

  const deduped: CollectionUsdPoint[] = [];
  for (const p of merged) {
    if (deduped.length && deduped[deduped.length - 1]!.t === p.t) {
      deduped[deduped.length - 1] = p;
    } else {
      deduped.push(p);
    }
  }
  return deduped.length >= 2 ? deduped : buildFullWindowFlatSeries(tMin, tMax, last.v);
}

/** Few samples or short span vs 90D+ window — extend edges instead of a tight cluster. */
function shouldAnchorSparseWindow(
  points: CollectionUsdPoint[],
  tMin: number,
  tMax: number,
  windowDays: number,
): boolean {
  const valid = validUsdPoints(points);
  if (valid.length <= 1) return true;
  const windowSpan = Math.max(tMax - tMin, 1);
  const dataSpan = Math.max(valid[valid.length - 1]!.t - valid[0]!.t, 0);
  if (dataSpan / windowSpan < 0.55) return true;
  if (windowDays >= 90 && valid.length < Math.max(4, Math.ceil(windowDays / 14))) {
    return true;
  }
  return false;
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

function formatYAxisLabelCompact(value: number): string {
  if (value >= 1_000_000) return `$${Math.round(value / 1_000_000)}M`;
  if (value >= 10_000) return `$${Math.round(value / 1_000)}k`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  if (value >= 10) return `$${Math.round(value)}`;
  return `$${value.toFixed(value === 0 ? 0 : 1)}`;
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
  /** @deprecated Prefer rangeOptions + chartRange + onChartRangeChange (in-chart toolbar). */
  controls = null,
  rangeOptions,
  chartRange,
  onChartRangeChange,
  footnote = null,
  emptyStateMessage,
  isLoading,
  errorMessage,
  variant = "default",
  collectionOverviewMat = false,
  embedInMobileTab = false,
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
  rangeOptions?: readonly ChartRangeOption[];
  chartRange?: string;
  onChartRangeChange?: (id: string) => void;
  footnote?: ReactNode;
  emptyStateMessage?: string;
  isLoading?: boolean;
  errorMessage?: string | null;
  variant?: "default" | "exchange";
  /** When `variant` is exchange and true, shell matches collection cover mat tones. */
  collectionOverviewMat?: boolean;
  /** Fixed-height mobile tab panel — do not stretch to fill viewport. */
  embedInMobileTab?: boolean;
}) {
  const exchange = variant === "exchange";
  const isMobileChart = useCollectionDetailMobile();
  const compactTab = embedInMobileTab && exchange;
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
      /** Lock x-axis to the UI range (7D / 30D / …). Do not expand to dataMin/dataMax — that made every range look like ~1Y. */
      tMin = nowSec - externalWindowDays! * DAY;
      tMax = nowSec + 6 * HOUR;
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
      const rawFit = validUsdPoints(extInWindow);
      if (rawFit.length >= 2) {
        extForChart = [...rawFit]
          .sort((a, b) => a.t - b.t)
          .map((p) => ({ ...p, t: Math.min(Math.max(p.t, tMin), tMax) }));
      }
    }

    /**
     * Sparse / flat external history (common on rare slabs): fill the selected 90D–1Y window using
     * first & last known prices so the line spans the chart instead of a dot or short cluster.
     */
    if (useFixedWindow) {
      const refPrice = resolveExternalReferencePrice(extInWindow, externalMarketUsd);
      const seriesProbe =
        validUsdPoints(extForChart).length > 0
          ? extForChart
          : validUsdPoints(extInWindow).length > 0
            ? extInWindow
            : extRolling;
      const windowDays = externalWindowDays!;

      if (seriesProbe.length === 0) {
        if (refPrice != null) {
          extForChart = buildFullWindowFlatSeries(tMin, tMax, refPrice);
        }
      } else if (isUniformPrice(seriesProbe)) {
        const flatV = refPrice ?? seriesProbe[seriesProbe.length - 1]!.v;
        extForChart = buildFullWindowFlatSeries(tMin, tMax, flatV);
      } else if (
        shouldAnchorSparseWindow(seriesProbe, tMin, tMax, windowDays) ||
        windowDays >= 180
      ) {
        extForChart = extendSeriesToWindowEdges(
          validUsdPoints(extForChart).length > 0 ? extForChart : seriesProbe,
          tMin,
          tMax,
        );
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
        fixedWindowDays: useFixedWindow ? externalWindowDays! : null,
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
      fixedWindowDays: useFixedWindow ? externalWindowDays! : null,
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
    const roughTickDays = merged.fixedWindowDays ?? extentDaysCeil;
    const roughTick = roughTickConfigByWindowDays(roughTickDays ?? null);

    /** Coarse ticks for any meaningful span — keeps x-axis readable (fewer labels, wider spacing). */
    const axisSpanDays =
      merged.tMax > merged.tMin ? (merged.tMax - merged.tMin) / DAY : 0;
    const useCoarseTimeTicks = axisSpanDays > 1;

    const yTickCount = isMobileChart ? 3 : 5;
    const { min, max, interval } = niceScale(merged.vMin, merged.vMax, yTickCount);

    return {
      backgroundColor: "transparent",
      animation: !compactTab,
      animationDuration: compactTab ? 0 : 250,
      textStyle: { color: AXIS_LABEL, fontFamily: "ui-sans-serif, system-ui, sans-serif" },
      grid: isMobileChart
        ? { left: 32, right: 6, top: 14, bottom: 28, containLabel: false }
        : { left: 52, right: 14, top: 8, bottom: 32, containLabel: false },
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
            isMobileChart ? formatYAxisLabelCompact(value) : (() => {
              if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
              if (value >= 1_000) return `$${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}K`;
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
  }, [
    merged,
    externalMarketUsd,
    externalSeriesShortLabel,
    externalRefLineTag,
    externalWindowDays,
    isMobileChart,
    compactTab,
  ]);

  if (isLoading) {
    return (
      <div
        className={
          exchange
            ? `${exchangeChrome} flex min-h-[120px] flex-col items-center justify-center gap-3 px-4 ${
                compactTab
                  ? "h-full min-h-0"
                  : "max-lg:min-h-[min(140px,20svh)] max-lg:h-full max-lg:min-h-0 lg:h-full lg:min-h-0"
              }`
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
            ? `${exchangeChrome} flex min-h-[110px] flex-col items-center justify-center px-4 py-6 text-center text-sm text-rose-200/90 ${
                compactTab
                  ? "h-full min-h-0"
                  : "max-lg:min-h-[min(128px,18svh)] max-lg:h-full max-lg:min-h-0 lg:h-full lg:min-h-0"
              }`
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
            ? `${exchangeChrome} flex min-h-[110px] flex-col items-center justify-center px-4 py-8 text-center text-sm text-zinc-600 ${
                compactTab
                  ? "h-full min-h-0"
                  : "max-lg:min-h-[min(128px,18svh)] max-lg:h-full max-lg:min-h-0 lg:h-full lg:min-h-0"
              }`
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
          ? `${exchangeChrome} flex h-full min-h-0 flex-col overflow-hidden text-white ${
              compactTab ? "min-h-0" : "max-lg:min-h-0 lg:min-h-[134px] lg:h-full"
            }`
          : `${chartShellDefault} text-white`
      }
    >
      {rangeToolbar || (controls && !useIntegratedRange) ? (
        <div className="flex shrink-0 items-center border-b border-[rgba(38,39,45,0.5)] px-2 py-1.5 sm:px-3 sm:py-2">
          <div className="flex min-w-0 flex-1 items-center justify-center overflow-x-auto sm:justify-start">
            {rangeToolbar ?? controls}
          </div>
        </div>
      ) : null}

      <div
        className={
          exchange
            ? "relative flex min-h-0 flex-1 flex-col px-1 pb-1 pt-0 max-lg:min-h-0 sm:px-2 sm:pb-1.5"
            : "relative min-h-[200px] px-2 pb-3 pt-0 sm:px-4"
        }
      >
        {footnote ? (
          <div className="pointer-events-none absolute left-2 top-1 z-10 max-w-[45%] truncate text-[8px] leading-none text-zinc-500">
            {footnote}
          </div>
        ) : null}
        <ReactECharts
          key={merged.fixedWindowDays ?? "auto"}
          option={chartOption}
          notMerge
          lazyUpdate
          style={{
            width: "100%",
            height: exchange ? "100%" : "300px",
            minHeight: compactTab ? 100 : exchange ? 110 : 200,
          }}
          className={
            exchange
              ? compactTab
                ? "h-full min-h-0 w-full"
                : "h-full min-h-[110px] w-full max-lg:min-h-0 lg:min-h-[136px]"
              : "min-h-[200px] w-full"
          }
        />
      </div>
    </div>
  );
}
