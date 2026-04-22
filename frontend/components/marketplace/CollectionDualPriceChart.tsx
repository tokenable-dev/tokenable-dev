"use client";

import {
  useCallback,
  useId,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import type { CollectionUsdPoint } from "@/lib/api";

/** Fintech-style neon: external = teal, platform = magenta (reference-aligned) */
const EXTERNAL_REF_STROKE = "#2EE6D0";
const PLATFORM_STROKE = "#D946EF";
const AXIS_STROKE = "rgba(255,255,255,0.16)";
const LABEL_FILL = "rgba(255,255,255,0.82)";
/** Plot field — near-black, no grid lines */
const PLOT_BG = "#060708";
const PLOT_STROKE = "rgba(255,255,255,0.06)";

function LegendHollowDot({ stroke }: { stroke: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0" aria-hidden>
      <circle cx="7" cy="7" r="4.5" fill="none" stroke={stroke} strokeWidth="1.5" />
    </svg>
  );
}

const VB_W = 560;
const VB_H = 340;
const mL = 52;
const mR = 14;
const mT = 14;
const mB = 38;
const plotW = VB_W - mL - mR;
const plotH = VB_H - mT - mB;
const plotX = mL;
const plotY = mT;

const SEC = 1;
const HOUR = 3600;
const DAY = 86400;

function linspace(a: number, b: number, n: number): number[] {
  if (n < 2) return [a];
  return Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
}

function pickNiceUsdTicks(vMin: number, vMax: number, target = 5): number[] {
  if (!(vMax > vMin)) return [vMin];
  const span = vMax - vMin;
  const step0 = span / Math.max(target - 1, 1);
  const pow = 10 ** Math.floor(Math.log10(step0));
  const frac = step0 / pow;
  const mult = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  const step = mult * pow;
  const t0 = Math.ceil(vMin / step) * step;
  const out: number[] = [];
  for (let t = t0; t <= vMax + step * 1e-9; t += step) {
    out.push(Math.round(t * 1000) / 1000);
    if (out.length > 12) break;
  }
  if (out.length < 2) return linspace(vMin, vMax, target);
  return out;
}

function formatUsdTick(v: number): string {
  if (Math.abs(v) >= 1000) return `$${Math.round(v).toLocaleString("en-US")}`;
  if (Number.isInteger(v)) return `$${v}`;
  return `$${v.toFixed(v >= 10 ? 0 : 2)}`;
}

function formatTickDate(tSec: number): string {
  return new Date(tSec * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
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

/** Linear interpolate v at time t along sorted series (for hover readout). */
function sampleSeriesAtT(points: CollectionUsdPoint[], t: number): number | null {
  const p = [...points].sort((a, b) => a.t - b.t);
  if (p.length === 0) return null;
  if (t <= p[0].t) return p[0].v;
  if (t >= p[p.length - 1].t) return p[p.length - 1].v;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i];
    const b = p[i + 1];
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t;
      const u = span > 0 ? (t - a.t) / span : 0;
      return a.v + u * (b.v - a.v);
    }
  }
  return null;
}

function formatTooltipUsd(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v >= 100 ? `$${v.toFixed(0)}` : `$${v.toFixed(2)}`;
}

function tooltipFixedPosition(clientX: number, clientY: number): CSSProperties {
  if (typeof window === "undefined") {
    return { position: "fixed", left: 0, top: 0, visibility: "hidden" };
  }
  const tw = 220;
  const th = 96;
  const pad = 12;
  let left = clientX + pad;
  let top = clientY + pad;
  left = Math.min(left, window.innerWidth - tw - 8);
  top = Math.min(top, window.innerHeight - th - 8);
  left = Math.max(8, left);
  top = Math.max(8, top);
  return { position: "fixed", left, top };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function dedupeTimeKeepLast(points: CollectionUsdPoint[]): CollectionUsdPoint[] {
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const out: CollectionUsdPoint[] = [];
  for (const p of sorted) {
    if (out.length && out[out.length - 1].t === p.t) {
      out[out.length - 1] = p;
    } else {
      out.push(p);
    }
  }
  return out;
}

function utcDayKey(tSec: number): string {
  const d = new Date(tSec * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * One sample per UTC calendar day: keep the **last** trade/marker that day, plot **x** at 12:00 UTC
 * (clamped to `nowSec`). Used for **both** Tokenable platform trades and PokéTrace external daily
 * series so the two lines share the same day bucket and do not look time-shifted.
 */
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
  const keys = [...byDay.keys()].sort();
  const out: CollectionUsdPoint[] = [];
  for (const k of keys) {
    const last = byDay.get(k)!;
    const parts = k.split("-").map(Number);
    const y = parts[0]!;
    const mo = parts[1]!;
    const d = parts[2]!;
    const tNoon = Math.floor(Date.UTC(y, mo - 1, d, 12, 0, 0) / 1000);
    const t = Math.min(tNoon, nowSec);
    out.push({ t, v: last.v });
  }
  return out;
}

function computeSmartTimeDomain(
  plat: CollectionUsdPoint[],
  nowSec: number,
  wideWindowSec: number,
): { tMin: number; tMax: number } {
  if (plat.length === 0) {
    return { tMin: nowSec - 7 * DAY, tMax: nowSec };
  }
  const ts = plat.map((p) => p.t);
  const dataTMin = Math.min(...ts);
  const dataTMax = Math.max(...ts);
  const dataSpan = Math.max(dataTMax - dataTMin, SEC);
  const windowLo = nowSec - wideWindowSec;
  const windowSpan = Math.max(nowSec - windowLo, DAY);
  const sparseVsWideWindow = dataSpan < 0.14 * windowSpan;

  if (sparseVsWideWindow) {
    const pad = Math.max(2 * HOUR, Math.min(3 * DAY, Math.max(dataSpan * 0.12, 4 * HOUR)));
    let lo = dataTMin - pad;
    let hi = Math.max(dataTMax + pad, nowSec + 2 * HOUR);
    const minDur = plat.length <= 2 ? 4 * DAY : 36 * HOUR;
    if (hi - lo < minDur) {
      const c = (lo + hi) / 2;
      lo = c - minDur / 2;
      hi = c + minDur / 2;
    }
    hi = Math.max(hi, nowSec + HOUR);
    return { tMin: lo, tMax: hi };
  }

  const padWide = Math.max(DAY, dataSpan * 0.02);
  return {
    tMin: Math.min(dataTMin - padWide, windowLo),
    tMax: Math.max(dataTMax + padWide, nowSec, dataTMax + HOUR),
  };
}

/**
 * Straight polyline through (t,v) points — platform daily series + external curves.
 * All x/y are clamped to the plot rect so single-point “stub” lines never extend past the frame.
 */
function buildLinePathPlot(
  points: CollectionUsdPoint[],
  tMin: number,
  tMax: number,
  vMin: number,
  vMax: number,
): string {
  if (points.length === 0) return "";
  const tr = Math.max(tMax - tMin, 1);
  const vr = Math.max(vMax - vMin, 1e-6);
  const xMax = plotX + plotW;
  const yMax = plotY + plotH;
  const xy = (pt: CollectionUsdPoint) => ({
    x: clamp(plotX + ((pt.t - tMin) / tr) * plotW, plotX, xMax),
    y: clamp(plotY + (1 - (pt.v - vMin) / vr) * plotH, plotY, yMax),
  });
  if (points.length === 1) {
    const { x, y } = xy(points[0]);
    const dx = Math.max(plotW * 0.04, 8);
    let x0 = x - dx;
    let x1 = x + dx;
    x0 = clamp(x0, plotX, xMax);
    x1 = clamp(x1, plotX, xMax);
    if (x1 - x0 < 6) {
      const mid = clamp(x, plotX + 3, xMax - 3);
      x0 = mid - 4;
      x1 = mid + 4;
      x0 = clamp(x0, plotX, xMax);
      x1 = clamp(x1, plotX, xMax);
    }
    return `M ${x0.toFixed(1)} ${y.toFixed(1)} L ${x1.toFixed(1)} ${y.toFixed(1)}`;
  }
  return points
    .map((pt, i) => {
      const { x, y } = xy(pt);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

/**
 * On-platform trades (magenta) vs external NM reference (teal): PokéTrace history / bundle series,
 * or a horizontal spot when only a single external level exists.
 */
export function CollectionDualPriceChart({
  platformUsd,
  externalMarketUsd = null,
  /** When set with external ref, x-axis is fixed to [now − N days, now] (matches PokeTrace rolling). */
  externalWindowDays = null,
  /**
   * Optional polyline: API daily/history points or rolling snapshot fields (x ≈ lookback).
   * When length ≥ 2, draws instead of a flat horizontal ref.
   */
  externalRollingUsd = null,
  /** `synthetic` = illustrative curve from one anchor (no extra API history) */
  externalRollingKind = "snapshot",
  /** Legend copy for the teal series (external NM path). */
  externalLegendLabel = "External market (NM)",
  /** Shorter label for hover tooltip row */
  externalSeriesShortLabel = "External NM",
  /** Right-edge tag when drawing a horizontal external ref line (no polyline). */
  externalRefLineTag = "External NM",
  chartTitle = "External market vs on-platform trades",
  emptyStateMessage,
  isLoading,
  errorMessage,
  variant = "default",
}: {
  platformUsd: CollectionUsdPoint[];
  /** Optional horizontal ref when no polyline (USDC). */
  externalMarketUsd?: number | null;
  externalWindowDays?: number | null;
  externalRollingUsd?: CollectionUsdPoint[] | null;
  externalRollingKind?: "history" | "snapshot" | "synthetic";
  externalLegendLabel?: string;
  externalSeriesShortLabel?: string;
  externalRefLineTag?: string;
  chartTitle?: string;
  /** Shown when there is no platform series and no external signal */
  emptyStateMessage?: string;
  isLoading?: boolean;
  errorMessage?: string | null;
  variant?: "default" | "exchange";
}) {
  const plotClipId = useId().replace(/:/g, "");
  const exchange = variant === "exchange";
  const nowSec = Math.floor(Date.now() / 1000);
  const wideWindowSec = 180 * DAY;

  const platRaw = useMemo(
    () => [...platformUsd].sort((a, b) => a.t - b.t),
    [platformUsd],
  );

  const extRolling = useMemo(
    () =>
      externalRollingUsd && externalRollingUsd.length > 0
        ? [...externalRollingUsd].sort((a, b) => a.t - b.t)
        : [],
    [externalRollingUsd],
  );

  const hasExtSignal =
    extRolling.length > 0 ||
    (externalMarketUsd != null &&
      Number.isFinite(externalMarketUsd) &&
      externalMarketUsd > 0);

  const usePoketraceFixedWindow =
    hasExtSignal &&
    externalWindowDays != null &&
    Number.isFinite(externalWindowDays) &&
    externalWindowDays > 0;

  const merged = useMemo(() => {
    let tMin: number;
    let tMax: number;
    let platForChart: CollectionUsdPoint[];

    if (usePoketraceFixedWindow) {
      const w = externalWindowDays!;
      tMax = nowSec + 6 * HOUR;
      tMin = nowSec - w * DAY;
      platForChart = platRaw.filter((p) => p.t >= tMin && p.t <= tMax);
    } else {
      const { tMin: t0, tMax: t1 } = computeSmartTimeDomain(platRaw, nowSec, wideWindowSec);
      tMin = t0;
      tMax = Math.max(t1, tMin + 60 * SEC);
      platForChart = platRaw;
    }

    const platStaticRaw = buildPlatformUtcDayStaticPoints(platForChart, nowSec);
    const platStatic = platStaticRaw.map((p) => ({
      ...p,
      t: Math.min(Math.max(p.t, tMin), tMax),
    }));

    const extFiltered = extRolling.filter((p) => p.t >= tMin && p.t <= tMax);
    /** Same UTC-day + noon-x as `platStatic` so PokeTrace and Tokenable points align on the x-axis. */
    const extForChart = buildPlatformUtcDayStaticPoints(extFiltered, nowSec).map((p) => ({
      ...p,
      t: Math.min(Math.max(p.t, tMin), tMax),
    }));
    const useExtPolyline = extForChart.length >= 2;

    const allV: number[] = [
      ...platStatic.map((p) => p.v),
      ...platForChart.map((p) => p.v),
      ...extForChart.map((p) => p.v),
    ];
    if (!useExtPolyline && externalMarketUsd != null && Number.isFinite(externalMarketUsd)) {
      allV.push(externalMarketUsd);
    }

    if (allV.length === 0) {
      return {
        tMin,
        tMax,
        vMin: 0,
        vMax: 1,
        platPath: "",
        extPath: "",
        extRefY: null as number | null,
        yTicks: [] as number[],
        xTicks: [] as number[],
        platLinePts: [] as CollectionUsdPoint[],
        extLinePts: [] as CollectionUsdPoint[],
        extIsPolyline: false,
      };
    }

    const vMinD = Math.min(...allV);
    const vMaxD = Math.max(...allV);
    const vPad = Math.max((vMaxD - vMinD) * 0.08, vMaxD * 0.04, 0.5);
    const vLo = Math.max(0, vMinD - vPad);
    const vHi = vMaxD + vPad;
    const yTicks = pickNiceUsdTicks(vLo, vHi, 5);
    const xTicks = linspace(tMin, tMax, 6);
    const tr = Math.max(tMax - tMin, 1);
    const vr = Math.max(vHi - vLo, 1e-6);

    const showHoriz =
      !useExtPolyline &&
      externalMarketUsd != null &&
      Number.isFinite(externalMarketUsd) &&
      externalMarketUsd > 0;

    const extRefY =
      showHoriz && vHi > vLo
        ? plotY + (1 - (externalMarketUsd! - vLo) / vr) * plotH
        : null;

    const extPath = useExtPolyline
      ? buildLinePathPlot(extForChart, tMin, tMax, vLo, vHi)
      : "";

    const linePts = dedupeTimeKeepLast(platStatic);

    return {
      tMin,
      tMax,
      vMin: vLo,
      vMax: vHi,
      platPath: buildLinePathPlot(linePts, tMin, tMax, vLo, vHi),
      extPath,
      extRefY,
      yTicks,
      xTicks,
      platLinePts: linePts,
      extLinePts: extForChart,
      extIsPolyline: useExtPolyline,
    };
  }, [
    platRaw,
    externalMarketUsd,
    externalWindowDays,
    usePoketraceFixedWindow,
    extRolling,
    nowSec,
  ]);

  const [hover, setHover] = useState<{
    tSec: number;
    xSvg: number;
    clientX: number;
    clientY: number;
  } | null>(null);

  const hoverSample = useMemo(() => {
    if (hover == null) return null;
    const t = hover.tSec;
    const vr = Math.max(merged.vMax - merged.vMin, 1e-6);
    const platV = sampleSeriesAtT(merged.platLinePts, t);
    let extV: number | null = null;
    if (merged.extIsPolyline) {
      extV = sampleSeriesAtT(merged.extLinePts, t);
    } else if (
      externalMarketUsd != null &&
      Number.isFinite(externalMarketUsd) &&
      externalMarketUsd > 0
    ) {
      extV = externalMarketUsd;
    }
    const yPlat =
      platV != null
        ? plotY + (1 - (platV - merged.vMin) / vr) * plotH
        : null;
    const yExt =
      extV != null
        ? plotY + (1 - (extV - merged.vMin) / vr) * plotH
        : null;
    return { platV, extV, yPlat, yExt, t };
  }, [hover, merged, externalMarketUsd]);

  const onPlotPointerMove = useCallback(
    (e: MouseEvent<SVGRectElement>) => {
      const svg = e.currentTarget.ownerSVGElement;
      if (!svg) return;
      const r = svg.getBoundingClientRect();
      const x = ((e.clientX - r.left) / Math.max(r.width, 1e-6)) * VB_W;
      if (x < plotX || x > plotX + plotW) {
        setHover(null);
        return;
      }
      const tr = merged.tMax - merged.tMin;
      const tSec = merged.tMin + ((x - plotX) / plotW) * tr;
      setHover({
        tSec,
        xSvg: x,
        clientX: e.clientX,
        clientY: e.clientY,
      });
    },
    [merged.tMin, merged.tMax],
  );

  const onPlotPointerLeave = useCallback(() => setHover(null), []);

  const hasPlatform = platRaw.length > 0;
  const hasPlatformInView = useMemo(() => {
    if (!usePoketraceFixedWindow || !externalWindowDays) {
      return platRaw.length > 0;
    }
    const tMax = nowSec + 6 * HOUR;
    const tMin = nowSec - externalWindowDays * DAY;
    return platRaw.some((p) => p.t >= tMin && p.t <= tMax);
  }, [platRaw, usePoketraceFixedWindow, externalWindowDays, nowSec]);

  const title = chartTitle;

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
          style={{
            borderColor: `${EXTERNAL_REF_STROKE}40`,
            borderTopColor: "transparent",
          }}
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

  if (!hasPlatform && !hasExtSignal) {
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
          <h3 className="text-[15px] font-semibold tracking-tight text-white">{title}</h3>
        </div>
        <div className="grid shrink-0 grid-cols-[14px_auto] items-center gap-x-2 gap-y-2.5 text-[11px] font-medium leading-tight text-white/90">
          <span className="flex h-[14px] w-[14px] items-center justify-center" aria-hidden>
            <LegendHollowDot stroke={EXTERNAL_REF_STROKE} />
          </span>
          <span className={hasExtSignal ? "whitespace-nowrap" : "whitespace-nowrap text-white/35"}>
            {externalLegendLabel}
          </span>
          <span className="flex h-[14px] w-[14px] items-center justify-center" aria-hidden>
            <LegendHollowDot stroke={PLATFORM_STROKE} />
          </span>
          <span className={hasPlatformInView ? "whitespace-nowrap" : "whitespace-nowrap text-white/35"}>
            Tokenable price
          </span>
        </div>
      </div>

      <div
        className={
          exchange
            ? "flex min-h-0 flex-1 flex-col px-2 pb-2 pt-0 sm:px-4 sm:pb-3 max-xl:min-h-[min(320px,42svh)]"
            : "px-2 pb-3 pt-0 sm:px-4"
        }
      >
        <div
          className={
            exchange
              ? "flex min-h-0 min-w-0 flex-1 items-stretch max-xl:min-h-[min(280px,38svh)]"
              : "block w-full"
          }
        >
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            className={
              exchange
                ? "mx-auto block h-auto w-full max-w-full min-h-[260px] max-xl:aspect-[560/340] max-xl:max-h-[min(520px,55svh)] xl:h-full xl:min-h-[320px] xl:max-h-none"
                : "mx-auto h-auto w-full min-h-[220px] max-h-[min(640px,58vh)] aspect-[560/340] sm:max-h-[min(560px,52vh)] lg:max-h-[min(520px,50vh)] xl:max-h-[min(580px,54vh)]"
            }
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={`Chart: on-platform trades and ${externalLegendLabel}`}
          >
            <defs>
              <clipPath id={plotClipId}>
                <rect x={plotX} y={plotY} width={plotW} height={plotH} />
              </clipPath>
            </defs>
            <rect
              x={plotX}
              y={plotY}
              width={plotW}
              height={plotH}
              rx={4}
              fill={PLOT_BG}
              stroke={PLOT_STROKE}
              strokeWidth={1}
            />

            <line
              x1={plotX}
              y1={plotY}
              x2={plotX}
              y2={plotY + plotH}
              stroke={AXIS_STROKE}
              strokeWidth={1}
            />
            <line
              x1={plotX}
              y1={plotY + plotH}
              x2={plotX + plotW}
              y2={plotY + plotH}
              stroke={AXIS_STROKE}
              strokeWidth={1}
            />

            {merged.yTicks.map((yv) => {
              const vr = Math.max(merged.vMax - merged.vMin, 1e-6);
              const py = plotY + (1 - (yv - merged.vMin) / vr) * plotH;
              return (
                <text
                  key={`y-${yv}`}
                  x={plotX - 10}
                  y={py + 3}
                  textAnchor="end"
                  fill={LABEL_FILL}
                  fontSize={11}
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                  style={{ fontFeatureSettings: '"tnum"' }}
                >
                  {formatUsdTick(yv)}
                </text>
              );
            })}

            {merged.xTicks.map((tv) => {
              const tr = Math.max(merged.tMax - merged.tMin, 1);
              const px = plotX + ((tv - merged.tMin) / tr) * plotW;
              return (
                <text
                  key={`x-${tv}`}
                  x={px}
                  y={VB_H - 10}
                  textAnchor="middle"
                  fill={LABEL_FILL}
                  fontSize={11}
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                  opacity={0.9}
                >
                  {formatTickDate(tv)}
                </text>
              );
            })}

            <g clipPath={`url(#${plotClipId})`}>
              {merged.extPath ? (
                <g aria-label={externalLegendLabel}>
                  <path
                    d={merged.extPath}
                    fill="none"
                    stroke={EXTERNAL_REF_STROKE}
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              ) : null}

              {merged.extRefY != null &&
              externalMarketUsd != null &&
              Number.isFinite(externalMarketUsd) ? (
                <g aria-label={`${externalLegendLabel} reference line`}>
                  <line
                    x1={plotX}
                    y1={merged.extRefY}
                    x2={plotX + plotW}
                    y2={merged.extRefY}
                    stroke={EXTERNAL_REF_STROKE}
                    strokeWidth={1.25}
                    opacity={0.85}
                  />
                </g>
              ) : null}

              <g aria-label="Tokenable price series">
                {merged.platPath ? (
                  <path
                    d={merged.platPath}
                    fill="none"
                    stroke={PLATFORM_STROKE}
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}
              </g>

              {hoverSample && hover ? (
                <g pointerEvents="none" aria-hidden>
                  <line
                    x1={hover.xSvg}
                    y1={plotY}
                    x2={hover.xSvg}
                    y2={plotY + plotH}
                    stroke="rgba(255,255,255,0.22)"
                    strokeWidth={1}
                    strokeDasharray="3 4"
                  />
                  {hoverSample.yPlat != null ? (
                    <circle
                      cx={hover.xSvg}
                      cy={hoverSample.yPlat}
                      r={4}
                      fill={PLATFORM_STROKE}
                      stroke="rgba(0,0,0,0.35)"
                      strokeWidth={1}
                    />
                  ) : null}
                  {hoverSample.yExt != null ? (
                    <circle
                      cx={hover.xSvg}
                      cy={hoverSample.yExt}
                      r={4}
                      fill={EXTERNAL_REF_STROKE}
                      stroke="rgba(0,0,0,0.35)"
                      strokeWidth={1}
                    />
                  ) : null}
                </g>
              ) : null}
            </g>

            {merged.extRefY != null &&
            externalMarketUsd != null &&
            Number.isFinite(externalMarketUsd) ? (
              <text
                x={plotX + plotW - 4}
                y={merged.extRefY - 4}
                textAnchor="end"
                fill={EXTERNAL_REF_STROKE}
                fontSize={9}
                opacity={0.9}
                fontFamily="system-ui, sans-serif"
              >
                {`${externalRefLineTag} · $${externalMarketUsd.toFixed(2)}`}
              </text>
            ) : null}

            <rect
              x={plotX}
              y={plotY}
              width={plotW}
              height={plotH}
              fill="transparent"
              style={{ cursor: "crosshair" }}
              onMouseMove={onPlotPointerMove}
              onMouseLeave={onPlotPointerLeave}
            />
          </svg>
        </div>
        {hoverSample && hover ? (
          <div
            className="pointer-events-none fixed z-[80] max-w-[220px] rounded-xl border border-white/10 bg-[#0a0a0c]/95 px-3 py-2 text-[11px] leading-snug text-zinc-100 shadow-2xl backdrop-blur-md"
            style={tooltipFixedPosition(hover.clientX, hover.clientY)}
          >
            <div className="text-[10px] font-medium text-zinc-400 tabular-nums">
              {formatHoverWhen(hoverSample.t)}
            </div>
            <div className="mt-1.5 space-y-1">
              <div className="flex justify-between gap-4">
                <span className="text-zinc-500">Tokenable price</span>
                <span
                  className="tabular-nums font-medium"
                  style={{ color: PLATFORM_STROKE }}
                >
                  {formatTooltipUsd(hoverSample.platV)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-zinc-500">{externalSeriesShortLabel}</span>
                <span
                  className="tabular-nums font-medium"
                  style={{ color: EXTERNAL_REF_STROKE }}
                >
                  {formatTooltipUsd(hoverSample.extV)}
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
