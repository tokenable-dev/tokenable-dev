"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption, LineSeriesOption } from "echarts";
import type { CollectionUsdPoint } from "@/lib/api";

const EXTERNAL_REF_STROKE = "#2EE6D0";
const PLATFORM_STROKE = "#D946EF";
const AXIS_LABEL = "rgba(255,255,255,0.72)";
const AXIS_LINE = "rgba(255,255,255,0.16)";
const SPLIT_LINE = "rgba(255,255,255,0.06)";

const DAY = 86400;
const HOUR = 3600;

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
  platformUsd,
  externalMarketUsd = null,
  externalWindowDays = null,
  externalRollingUsd = null,
  externalRollingKind = "snapshot",
  externalLegendLabel = "External market (NM)",
  externalSeriesShortLabel = "External NM",
  externalRefLineTag = "External NM",
  chartTitle = "External market vs on-platform trades",
  emptyStateMessage,
  isLoading,
  errorMessage,
  variant = "default",
}: {
  platformUsd: CollectionUsdPoint[];
  externalMarketUsd?: number | null;
  externalWindowDays?: number | null;
  externalRollingUsd?: CollectionUsdPoint[] | null;
  externalRollingKind?: "history" | "snapshot" | "synthetic";
  externalLegendLabel?: string;
  externalSeriesShortLabel?: string;
  externalRefLineTag?: string;
  chartTitle?: string;
  emptyStateMessage?: string;
  isLoading?: boolean;
  errorMessage?: string | null;
  variant?: "default" | "exchange";
}) {
  const exchange = variant === "exchange";
  const nowSec = Math.floor(Date.now() / 1000);

  const merged = useMemo(() => {
    const platRaw = [...platformUsd].sort((a, b) => a.t - b.t);
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
    let platForChart: CollectionUsdPoint[];

    if (useFixedWindow) {
      tMax = nowSec + 6 * HOUR;
      tMin = nowSec - externalWindowDays! * DAY;
      platForChart = platRaw.filter((p) => p.t >= tMin && p.t <= tMax);
    } else {
      const smart = computeSmartTimeDomain(platRaw, nowSec, 180 * DAY);
      tMin = smart.tMin;
      tMax = Math.max(smart.tMax, tMin + 60);
      platForChart = platRaw;
    }

    const platStatic = buildPlatformUtcDayStaticPoints(platForChart, nowSec).map((p) => ({
      ...p,
      t: Math.min(Math.max(p.t, tMin), tMax),
    }));

    const extForChart = buildPlatformUtcDayStaticPoints(
      extRolling.filter((p) => p.t >= tMin && p.t <= tMax),
      nowSec,
    ).map((p) => ({ ...p, t: Math.min(Math.max(p.t, tMin), tMax) }));

    const extIsPolyline = extForChart.length >= 2;

    const allV = [
      ...platStatic.map((p) => p.v),
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
        hasPlatform: platRaw.length > 0,
        hasExtSignal,
        hasPlatformInView: false,
        platformSeries: [] as Array<[number, number]>,
        externalSeries: [] as Array<[number, number]>,
      };
    }

    const vMinD = Math.min(...allV);
    const vMaxD = Math.max(...allV);
    const vPad = Math.max((vMaxD - vMinD) * 0.08, vMaxD * 0.04, 0.5);

    const hasPlatformInView = useFixedWindow
      ? platRaw.some((p) => p.t >= tMin && p.t <= tMax)
      : platRaw.length > 0;

    return {
      tMin,
      tMax,
      vMin: Math.max(0, vMinD - vPad),
      vMax: vMaxD + vPad,
      extIsPolyline,
      hasPlatform: platRaw.length > 0,
      hasExtSignal,
      hasPlatformInView,
      platformSeries: platStatic.map((p) => [p.t * 1000, p.v] as [number, number]),
      externalSeries: extForChart.map((p) => [p.t * 1000, p.v] as [number, number]),
    };
  }, [platformUsd, externalRollingUsd, externalMarketUsd, externalWindowDays, nowSec]);

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
        lineStyle: { color: EXTERNAL_REF_STROKE, width: 1.75 },
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
        lineStyle: { color: EXTERNAL_REF_STROKE, width: 1.25, type: "solid", opacity: 0.85 },
        emphasis: { focus: "series" },
      });
    }
    series.push({
      name: "Tokenable price",
      type: "line",
      data: merged.platformSeries,
      showSymbol: merged.platformSeries.length <= 2,
      symbolSize: 6,
      smooth: false,
      connectNulls: true,
      lineStyle: { color: PLATFORM_STROKE, width: 1.75 },
      itemStyle: { color: PLATFORM_STROKE },
      emphasis: { focus: "series" },
    });

    const monthMs = 30 * DAY * 1000;

    return {
      backgroundColor: "#060708",
      animationDuration: 250,
      textStyle: { color: AXIS_LABEL, fontFamily: "ui-sans-serif, system-ui, sans-serif" },
      grid: { left: 52, right: 14, top: 14, bottom: 38, containLabel: false },
      dataZoom: [
        { type: "inside", xAxisIndex: 0, filterMode: "none" },
        { type: "slider", xAxisIndex: 0, height: 16, bottom: 0, show: false },
      ],
      xAxis: {
        type: "time",
        min: merged.tMin * 1000,
        max: merged.tMax * 1000,
        ...(exchange ? { minInterval: monthMs } : {}),
        axisLine: { lineStyle: { color: AXIS_LINE } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: {
          color: AXIS_LABEL,
          fontSize: 11,
          formatter: (value: number) =>
            exchange
              ? formatTickMonth(Math.floor(value / 1000))
              : formatTickDate(Math.floor(value / 1000)),
        },
      },
      yAxis: {
        type: "value",
        min: merged.vMin,
        max: merged.vMax,
        axisLine: { show: true, lineStyle: { color: AXIS_LINE } },
        axisTick: { show: false },
        splitLine: { show: true, lineStyle: { color: SPLIT_LINE } },
        axisLabel: {
          color: AXIS_LABEL,
          fontSize: 11,
          formatter: (value: number) =>
            Math.abs(value) >= 1000
              ? `$${Math.round(value).toLocaleString("en-US")}`
              : value >= 10
                ? `$${value.toFixed(0)}`
                : `$${value.toFixed(2)}`,
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

          const p = pick("Tokenable price")?.value?.[1] ?? null;
          const e =
            pick(externalSeriesShortLabel)?.value?.[1] ??
            pick(externalRefLineTag)?.value?.[1] ??
            null;

          const when = t != null ? formatHoverWhen(t) : "";
          return [
            `<div style="color:#a1a1aa;font-size:10px;margin-bottom:6px">${when}</div>`,
            `<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:#71717a">Tokenable price</span><span style="color:${PLATFORM_STROKE};font-weight:600">${formatTooltipUsd(
              p as number | null,
            )}</span></div>`,
            `<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:#71717a">${externalSeriesShortLabel}</span><span style="color:${EXTERNAL_REF_STROKE};font-weight:600">${formatTooltipUsd(
              e as number | null,
            )}</span></div>`,
          ].join("");
        },
      },
      series,
    };
  }, [merged, externalMarketUsd, externalSeriesShortLabel, externalRefLineTag, externalRollingKind]);

  if (isLoading) {
    return (
      <div
        className={
          exchange
            ? "flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-2xl border border-white/[0.07] bg-[#030304] px-4 max-xl:min-h-[min(360px,44svh)] xl:h-full xl:min-h-0"
            : "flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-2xl border border-white/[0.07] bg-[#030304] px-4"
        }
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-solid border-t-transparent"
          style={{ borderColor: `${EXTERNAL_REF_STROKE}40`, borderTopColor: "transparent" }}
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
            ? "flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-white/[0.07] bg-[#030304] px-4 py-6 text-center text-sm text-rose-200/90 max-xl:min-h-[min(320px,40svh)] xl:h-full xl:min-h-0"
            : "rounded-2xl border border-rose-500/20 bg-[#030304] px-4 py-6 text-center text-sm text-rose-200/90"
        }
      >
        {errorMessage}
      </div>
    );
  }

  if (!merged.hasPlatform && !merged.hasExtSignal) {
    return (
      <div
        className={
          exchange
            ? "flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-white/[0.07] bg-[#030304] px-4 py-8 text-center text-sm text-zinc-600 max-xl:min-h-[min(320px,40svh)] xl:h-full xl:min-h-0"
            : "rounded-2xl border border-white/[0.07] bg-[#030304] px-4 py-8 text-center text-sm text-zinc-600"
        }
      >
        {emptyStateMessage ??
          "No chart data yet — on-platform trades and an external NM series will appear here."}
      </div>
    );
  }

  return (
    <div
      className={
        exchange
          ? "flex min-h-[320px] flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#030304] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] max-xl:min-h-[min(380px,48svh)] xl:h-full xl:min-h-0"
          : "rounded-2xl border border-white/[0.07] bg-[#030304] text-white"
      }
    >
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-4 px-4 pt-4 pb-2 sm:px-5 sm:pt-5">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="text-[15px] font-semibold tracking-tight text-white">{chartTitle}</h3>
        </div>
        <div className="grid shrink-0 grid-cols-[14px_auto] items-center gap-x-2 gap-y-2.5 text-[11px] font-medium leading-tight text-white/90">
          <span className="inline-block h-[10px] w-[10px] rounded-full" style={{ background: EXTERNAL_REF_STROKE }} aria-hidden />
          <span className={merged.hasExtSignal ? "whitespace-nowrap" : "whitespace-nowrap text-white/35"}>
            {externalLegendLabel}
          </span>
          <span className="inline-block h-[10px] w-[10px] rounded-full" style={{ background: PLATFORM_STROKE }} aria-hidden />
          <span className={merged.hasPlatformInView ? "whitespace-nowrap" : "whitespace-nowrap text-white/35"}>
            Tokenable price
          </span>
        </div>
      </div>

      <div className={exchange ? "flex min-h-0 flex-1 flex-col px-2 pb-2 pt-0 sm:px-4 sm:pb-3" : "px-2 pb-3 pt-0 sm:px-4"}>
        <ReactECharts
          option={chartOption}
          notMerge
          lazyUpdate
          style={{
            width: "100%",
            height: exchange ? "100%" : "340px",
            minHeight: exchange ? 260 : 220,
          }}
          className={exchange ? "min-h-[260px] xl:min-h-[320px]" : "min-h-[220px]"}
        />
      </div>
    </div>
  );
}
