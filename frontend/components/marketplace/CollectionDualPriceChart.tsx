"use client";

import { useMemo } from "react";
import type { CollectionUsdPoint } from "@/lib/api";

/** Reference palette — mint dashed = external, magenta solid = platform fills */
const MARKET_STROKE = "#50E3C2";
const ACTUAL_STROKE = "#BD10E0";
const SNAPSHOT_STROKE = "rgba(80, 227, 194, 0.45)";
const EXTERNAL_DASH = "5 4";
const AXIS_STROKE = "rgba(255,255,255,0.28)";
const GRID_STROKE = "rgba(255,255,255,0.06)";
const LABEL_FILL = "rgba(255,255,255,0.88)";
const PLOT_BG = "rgba(255,255,255,0.03)";

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

/** ~4–6 “nice” USD ticks between min and max (reference-style $25, $50, …). */
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

/** Same-timestamp fills: keep last print for step path (DB rounds to seconds). */
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

/** One sample per UTC calendar day: last fill that day (reduces clutter when many trades/day). */
function utcDayKey(tSec: number): string {
  const d = new Date(tSec * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function aggregatePlatformByUtcDayLastFill(points: CollectionUsdPoint[]): CollectionUsdPoint[] {
  if (points.length === 0) return [];
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const byDay = new Map<string, CollectionUsdPoint>();
  for (const p of sorted) {
    const k = utcDayKey(p.t);
    const prev = byDay.get(k);
    if (!prev || p.t >= prev.t) byDay.set(k, p);
  }
  return [...byDay.values()].sort((a, b) => a.t - b.t);
}

/**
 * When fills cluster in time vs a 6M window, zoom the x-axis so the chart reads as a chart, not a spike.
 */
function computeSmartTimeDomain(
  ext: CollectionUsdPoint[],
  plat: CollectionUsdPoint[],
  nowSec: number,
  wideWindowSec: number,
): { tMin: number; tMax: number } {
  const all = [...ext, ...plat];
  if (all.length === 0) {
    return { tMin: nowSec - 7 * DAY, tMax: nowSec };
  }
  const ts = all.map((p) => p.t);
  const dataTMin = Math.min(...ts);
  const dataTMax = Math.max(...ts);
  const dataSpan = Math.max(dataTMax - dataTMin, SEC);
  const windowLo = nowSec - wideWindowSec;
  const windowSpan = Math.max(nowSec - windowLo, DAY);

  const sparseVsWideWindow = dataSpan < 0.14 * windowSpan;
  const onlyPlatformOrThinExternal = ext.length === 0 || sparseVsWideWindow;

  if (onlyPlatformOrThinExternal && plat.length > 0) {
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

function buildStepPathAfterPlot(
  points: CollectionUsdPoint[],
  tMin: number,
  tMax: number,
  vMin: number,
  vMax: number,
): string {
  if (points.length === 0) return "";
  const tr = Math.max(tMax - tMin, 1);
  const vr = Math.max(vMax - vMin, 1e-6);
  const xy = (t: number, v: number) => ({
    x: plotX + ((t - tMin) / tr) * plotW,
    y: plotY + (1 - (v - vMin) / vr) * plotH,
  });
  const p = dedupeTimeKeepLast(points);
  if (p.length === 1) {
    const { x, y } = xy(p[0].t, p[0].v);
    const dx = Math.max(plotW * 0.04, 8);
    return `M ${(x - dx).toFixed(1)} ${y.toFixed(1)} L ${(x + dx).toFixed(1)} ${y.toFixed(1)}`;
  }
  let d = "";
  for (let i = 0; i < p.length; i++) {
    const { x, y } = xy(p[i].t, p[i].v);
    if (i === 0) {
      d += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    } else {
      const prev = xy(p[i - 1].t, p[i - 1].v);
      d += ` L ${x.toFixed(1)} ${prev.y.toFixed(1)} L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
  }
  const last = p[p.length - 1];
  const { y: yLast } = xy(last.t, last.v);
  const xEnd = plotX + plotW;
  d += ` L ${xEnd.toFixed(1)} ${yLast.toFixed(1)}`;
  return d;
}

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
  const xy = (pt: CollectionUsdPoint) => ({
    x: plotX + ((pt.t - tMin) / tr) * plotW,
    y: plotY + (1 - (pt.v - vMin) / vr) * plotH,
  });
  if (points.length === 1) {
    const { x, y } = xy(points[0]);
    const dx = Math.max(plotW * 0.04, 8);
    return `M ${(x - dx).toFixed(1)} ${y.toFixed(1)} L ${(x + dx).toFixed(1)} ${y.toFixed(1)}`;
  }
  return points
    .map((pt, i) => {
      const { x, y } = xy(pt);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export function CollectionDualPriceChart({
  externalUsd,
  platformUsd,
  externalSnapshotUsd = null,
  gradeLabel,
  isLoading,
  errorMessage,
  variant = "default",
}: {
  externalUsd: CollectionUsdPoint[];
  platformUsd: CollectionUsdPoint[];
  /** JustTCG grade strip when time series is empty (horizontal reference). */
  externalSnapshotUsd?: number | null;
  gradeLabel?: string | null;
  isLoading?: boolean;
  errorMessage?: string | null;
  variant?: "default" | "exchange";
}) {
  const exchange = variant === "exchange";
  const nowSec = Math.floor(Date.now() / 1000);
  const wideWindowSec = 180 * DAY;

  const ext = useMemo(
    () => [...externalUsd].sort((a, b) => a.t - b.t),
    [externalUsd],
  );
  const platRaw = useMemo(
    () => [...platformUsd].sort((a, b) => a.t - b.t),
    [platformUsd],
  );

  /** Draw the step line from daily last fills — not every trade (avoids noisy dots). */
  const platDaily = useMemo(() => aggregatePlatformByUtcDayLastFill(platRaw), [platRaw]);

  const merged = useMemo(() => {
    const hasSnap =
      externalSnapshotUsd != null &&
      Number.isFinite(externalSnapshotUsd) &&
      externalSnapshotUsd > 0;

    const { tMin: t0, tMax: t1 } = computeSmartTimeDomain(ext, platRaw, nowSec, wideWindowSec);
    const tMin = t0;
    const tMax = Math.max(t1, tMin + 60 * SEC);

    const allV: number[] = [...ext.map((p) => p.v), ...platRaw.map((p) => p.v)];
    if (hasSnap) allV.push(externalSnapshotUsd!);

    if (allV.length === 0) {
      return {
        tMin,
        tMax,
        vMin: 0,
        vMax: 1,
        extPath: "",
        platPath: "",
        lastPrintDot: null as { cx: number; cy: number } | null,
        snapY: null as number | null,
        yTicks: [] as number[],
        xTicks: [] as number[],
      };
    }

    const vMinD = Math.min(...allV);
    const vMaxD = Math.max(...allV);
    const vPad = Math.max((vMaxD - vMinD) * 0.08, vMaxD * 0.04, 0.5);
    const vLo = Math.max(0, vMinD - vPad);
    const vHi = vMaxD + vPad;
    const yTicks = pickNiceUsdTicks(vLo, vHi, 5);
    const xTicks = linspace(tMin, tMax, 5);
    const tr = Math.max(tMax - tMin, 1);
    const vr = Math.max(vHi - vLo, 1e-6);

    const snapY =
      hasSnap && vHi > vLo ? plotY + (1 - (externalSnapshotUsd! - vLo) / vr) * plotH : null;

    const linePts = dedupeTimeKeepLast(platDaily);
    let lastPrintDot: { cx: number; cy: number } | null = null;
    if (platRaw.length > 0) {
      const last = platRaw[platRaw.length - 1];
      lastPrintDot = {
        cx: plotX + ((last.t - tMin) / tr) * plotW,
        cy: plotY + (1 - (last.v - vLo) / vr) * plotH,
      };
    }

    return {
      tMin,
      tMax,
      vMin: vLo,
      vMax: vHi,
      extPath: buildLinePathPlot(ext, tMin, tMax, vLo, vHi),
      platPath: buildStepPathAfterPlot(linePts, tMin, tMax, vLo, vHi),
      lastPrintDot,
      snapY,
      yTicks,
      xTicks,
    };
  }, [ext, platRaw, platDaily, externalSnapshotUsd, nowSec]);

  const hasExternal = ext.length > 0;
  const hasPlatform = platRaw.length > 0;
  const hasSnapshot =
    externalSnapshotUsd != null &&
    Number.isFinite(externalSnapshotUsd) &&
    externalSnapshotUsd > 0;

  const title =
    gradeLabel && String(gradeLabel).trim().length > 0
      ? `Price Chart (${String(gradeLabel).trim()})`
      : "Price Chart";

  const subtitle = (() => {
    if (hasExternal) {
      return "Purple line = Tokenable (last fill per UTC day). Ring = latest trade.";
    }
    if (hasSnapshot) {
      return "No JustTCG series — mint = PSA 10 ref. Purple = daily last fill; ring = latest trade.";
    }
    return "Purple = daily last fill on Tokenable; ring = most recent trade.";
  })();

  if (isLoading) {
    return (
      <div
        className={
          exchange
            ? "flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-zinc-800/90 bg-zinc-950/90 max-xl:min-h-[min(360px,44svh)] xl:h-full xl:min-h-0"
            : "flex min-h-[260px] items-center justify-center rounded-xl border border-white/[0.08] bg-[#111113]"
        }
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#50E3C2] border-t-transparent" />
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div
        className={
          exchange
            ? "flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-zinc-800/90 bg-zinc-950/90 px-4 py-6 text-center text-sm text-rose-200/90 max-xl:min-h-[min(320px,40svh)] xl:h-full xl:min-h-0"
            : "rounded-xl border border-rose-500/25 bg-rose-500/[0.06] px-4 py-6 text-center text-sm text-rose-200/90"
        }
      >
        {errorMessage}
      </div>
    );
  }

  if (!hasExternal && !hasPlatform && !hasSnapshot) {
    return (
      <div
        className={
          exchange
            ? "flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-zinc-800/90 bg-zinc-950/90 px-4 py-8 text-center text-sm text-gray-500 max-xl:min-h-[min(320px,40svh)] xl:h-full xl:min-h-0"
            : "rounded-xl border border-white/[0.08] bg-[#111113] px-4 py-8 text-center text-sm text-gray-500"
        }
      >
        No price data yet — trades and JustTCG history will appear here.
      </div>
    );
  }

  return (
    <div
      className={
        exchange
          ? "flex min-h-[320px] flex-col overflow-hidden rounded-xl border border-zinc-800/90 bg-zinc-950/90 text-white max-xl:min-h-[min(380px,48svh)] xl:h-full xl:min-h-0"
          : "rounded-xl border border-white/[0.08] bg-[#111113] text-white"
      }
    >
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 px-4 pt-3 pb-2 sm:px-5 sm:pt-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="text-sm font-medium tracking-tight text-white">{title}</h3>
          <p className="text-[10px] leading-snug text-zinc-500">{subtitle}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 text-[11px]">
          <div className="flex items-center gap-2 text-white/90">
            <span
              className="inline-block h-0 w-6 shrink-0 border-b-2 border-dashed border-[#50E3C2]"
              aria-hidden
            />
            <span className={hasExternal ? "" : "text-white/40"}>JustTCG</span>
          </div>
          {hasSnapshot && !hasExternal ? (
            <div className="flex items-center gap-2 text-white/70">
              <span className="h-px w-6 shrink-0 bg-[#50E3C2]/50" aria-hidden />
              <span className="text-[10px]">PSA 10 ref.</span>
            </div>
          ) : null}
          <div className="flex items-center gap-2 text-white/90">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: ACTUAL_STROKE }}
              aria-hidden
            />
            <span className={hasPlatform ? "" : "text-white/40"}>Tokenable</span>
          </div>
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
            aria-label="Price chart: JustTCG reference and Tokenable fill prices"
          >
            <rect
              x={plotX}
              y={plotY}
              width={plotW}
              height={plotH}
              rx={6}
              fill={PLOT_BG}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={1}
            />

            {merged.yTicks.map((yv) => {
              const vr = Math.max(merged.vMax - merged.vMin, 1e-6);
              const py = plotY + (1 - (yv - merged.vMin) / vr) * plotH;
              return (
                <line
                  key={`gy-${yv}`}
                  x1={plotX}
                  y1={py}
                  x2={plotX + plotW}
                  y2={py}
                  stroke={GRID_STROKE}
                  strokeWidth={1}
                />
              );
            })}

            {merged.xTicks.map((tv) => {
              const tr = Math.max(merged.tMax - merged.tMin, 1);
              const px = plotX + ((tv - merged.tMin) / tr) * plotW;
              return (
                <line
                  key={`gx-${tv}`}
                  x1={px}
                  y1={plotY}
                  x2={px}
                  y2={plotY + plotH}
                  stroke={GRID_STROKE}
                  strokeWidth={1}
                />
              );
            })}

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
                  x={plotX - 8}
                  y={py + 3}
                  textAnchor="end"
                  fill={LABEL_FILL}
                  fontSize={10}
                  fontFamily="system-ui, sans-serif"
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
                  fontSize={10}
                  fontFamily="system-ui, sans-serif"
                >
                  {formatTickDate(tv)}
                </text>
              );
            })}

            {merged.snapY != null && hasSnapshot && !hasExternal ? (
              <g aria-label="PSA 10 snapshot reference">
                <line
                  x1={plotX}
                  y1={merged.snapY}
                  x2={plotX + plotW}
                  y2={merged.snapY}
                  stroke={SNAPSHOT_STROKE}
                  strokeWidth={1.25}
                  strokeDasharray="4 6"
                />
                <text
                  x={plotX + plotW - 4}
                  y={merged.snapY - 4}
                  textAnchor="end"
                  fill={MARKET_STROKE}
                  fontSize={9}
                  opacity={0.85}
                  fontFamily="system-ui, sans-serif"
                >
                  {`PSA 10 · $${externalSnapshotUsd!.toFixed(2)}`}
                </text>
              </g>
            ) : null}

            <g aria-label="Market price (external)">
              {merged.extPath ? (
                <path
                  d={merged.extPath}
                  fill="none"
                  stroke={MARKET_STROKE}
                  strokeWidth={2}
                  strokeDasharray={EXTERNAL_DASH}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
            </g>

            <g aria-label="Tokenable price">
              {merged.platPath ? (
                <path
                  d={merged.platPath}
                  fill="none"
                  stroke={ACTUAL_STROKE}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
              {merged.lastPrintDot ? (
                <g aria-label="Most recent on-chain fill">
                  <circle
                    cx={merged.lastPrintDot.cx}
                    cy={merged.lastPrintDot.cy}
                    r={7}
                    fill="none"
                    stroke={ACTUAL_STROKE}
                    strokeWidth={1.5}
                    opacity={0.55}
                  />
                  <circle
                    cx={merged.lastPrintDot.cx}
                    cy={merged.lastPrintDot.cy}
                    r={3.5}
                    fill={ACTUAL_STROKE}
                    stroke="rgba(0,0,0,0.45)"
                    strokeWidth={1}
                  />
                </g>
              ) : null}
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
