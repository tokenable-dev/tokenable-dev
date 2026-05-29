"use client";

import { useMemo, useRef, useState } from "react";
import { formatUsdCompact } from "@/lib/market";

function formatSnapshotAxisLabel(snapshotDateKst: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(snapshotDateKst.trim());
  if (m) return `${Number(m[2])}/${Number(m[3])}`;
  return snapshotDateKst;
}

function niceYTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (max < min) [min, max] = [max, min];
  if (max <= min) return [min];
  const range = max - min;
  const parts = Math.max(2, Math.min(12, Math.floor(Number(count)) || 5));
  let rough = range / (parts - 1);
  if (!Number.isFinite(rough) || rough <= 0) return [min, max];

  const log10 = Math.log10(rough);
  if (!Number.isFinite(log10)) return [min, max];
  const mag = Math.pow(10, Math.floor(log10));
  if (!Number.isFinite(mag) || mag <= 0) return [min, max];

  const mult = [1, 2, 5, 10].find((n) => n * mag >= rough);
  if (mult == null) return [min, max];
  let nice = mult * mag;
  if (!Number.isFinite(nice) || nice <= 0) return [min, max];

  /** When the chart span is tiny, avoid microscopic `nice` (millions of iterations / browser hang). */
  const minStep = range / 80;
  if (nice < minStep) nice = minStep;

  const lo = Math.floor(min / nice) * nice;
  if (!Number.isFinite(lo)) return [min, max];
  const hi = max + nice * 0.01;
  const ticks: number[] = [];
  const maxTicks = 64;
  for (let i = 0; i < maxTicks; i++) {
    const v = lo + i * nice;
    if (v > hi) break;
    ticks.push(v);
  }
  return ticks.length > 0 ? ticks : [min, max];
}

/** Collapse duplicate Y values (float noise / step overlap) so list keys and SVG lines stay unique. */
function uniqChartTicks(ticks: number[]): number[] {
  const out: number[] = [];
  for (const t of ticks) {
    if (!Number.isFinite(t)) continue;
    const prev = out[out.length - 1];
    if (
      prev != null &&
      Math.abs(t - prev) <= 1e-6 * Math.max(1, Math.abs(t), Math.abs(prev))
    ) {
      continue;
    }
    out.push(t);
  }
  return out;
}

function fmtAxisVal(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/** Keep value callout inside chart viewBox (last point sits on the right edge). */
function chartValueCalloutBox(
  anchorX: number,
  label: string,
  fontSize: number,
  bounds: { left: number; right: number },
): { rectX: number; rectW: number; textX: number } {
  const padX = 10;
  const charW = fontSize * 0.62;
  const rectW = Math.ceil(Math.max(56, label.length * charW + padX * 2));
  const minX = bounds.left;
  const maxX = bounds.right - rectW;
  let rectX = anchorX - rectW / 2;
  if (rectX < minX) rectX = minX;
  if (rectX > maxX) rectX = maxX;
  return { rectX, rectW, textX: rectX + rectW / 2 };
}

export function PortfolioValueChart({
  points,
  xLabels,
  compact = false,
}: {
  points: number[];
  /** Daily snapshot dates (same length as `points` when provided). */
  xLabels?: string[];
  /** Mobile: fill container, hide volume bars, larger stroke/dots. */
  compact?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ idx: number; x: number; y: number } | null>(null);
  const dotR = compact ? 6 : 5;
  const lastDotR = compact ? 7 : 5;
  const lastDotRingR = compact ? 11 : 9;
  const lineStroke = compact ? 2.75 : 2;

  const volumeBars = useMemo(() => {
    if (points.length < 2) return [] as number[];
    const bars: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const diff = i > 0 ? Math.abs(points[i] - points[i - 1]) : 0;
      bars.push(diff);
    }
    const bMax = Math.max(...bars) || 1;
    return bars.map((b) => b / bMax);
  }, [points]);

  if (points.length < 1)
    return (
      <div className="flex items-center justify-center text-gray-600 text-sm h-full">
        Not enough data
      </div>
    );

  const W = compact ? 400 : 800;
  const H = compact ? 228 : 260;
  const LEFT = compact ? 44 : 54;
  const RIGHT = compact ? 12 : 16;
  const TOP = compact ? 16 : 20;
  const BOT = compact ? 32 : 48;
  const showVolumeBars = !compact;
  const chartW = W - LEFT - RIGHT;
  const chartH = H - TOP - BOT;

  const dataMin = Math.min(...points);
  const dataMax = Math.max(...points);
  const pad = (dataMax - dataMin) * 0.1 || Math.max(dataMax * 0.05, 1);
  const yMin = dataMin - pad;
  const yMax = dataMax + pad;

  const ticks = uniqChartTicks(niceYTicks(yMin, yMax, 5));
  const timeLabels =
    xLabels && xLabels.length === points.length
      ? xLabels
      : points.map((_, i) => String(i + 1));

  const xOf = (i: number) => {
    if (points.length <= 1) return LEFT + chartW / 2;
    return LEFT + (i / (points.length - 1)) * chartW;
  };
  const yOf = (v: number) => TOP + (1 - (v - yMin) / (yMax - yMin)) * chartH;

  const linePath =
    points.length >= 2
      ? points
          .map((v, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(2)},${yOf(v).toFixed(2)}`)
          .join(" ")
      : "";
  const areaPath =
    points.length >= 2
      ? `${linePath} L${xOf(points.length - 1).toFixed(2)},${(TOP + chartH).toFixed(2)} L${xOf(0).toFixed(2)},${(TOP + chartH).toFixed(2)} Z`
      : "";

  const barH = 20;
  const barY = TOP + chartH + 2;
  const barW = Math.max(2, chartW / Math.max(points.length, 1) - 1);

  const labelStep = Math.max(1, Math.floor(points.length / 6));

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    const idx =
      points.length <= 1
        ? 0
        : Math.round(((mx - LEFT) / chartW) * (points.length - 1));
    if (idx < 0 || idx >= points.length) {
      setHover(null);
      return;
    }
    setHover({ idx, x: xOf(idx), y: yOf(points[idx]) });
  }

  const lastIdx = points.length - 1;
  const lastX = xOf(lastIdx);
  const lastY = yOf(points[lastIdx]);
  const displayValue = points[lastIdx];
  const lastTooltipBelow = lastY < TOP + 38;
  const lastTooltipRectY = lastTooltipBelow ? lastY + 8 : lastY - 30;
  const lastTooltipTextY = lastTooltipBelow ? lastY + 22 : lastY - 16;
  const chartBounds = { left: LEFT, right: W - RIGHT };
  const lastValueLabel = formatUsdCompact(displayValue);
  const lastCallout = chartValueCalloutBox(lastX, lastValueLabel, 11, chartBounds);

  return (
    <div ref={containerRef} className="w-full h-full min-h-[200px]">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-full w-full"
        overflow="visible"
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="portfolio-value-area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(16,211,51,0.15)" />
            <stop offset="80%" stopColor="rgba(16,211,51,0.02)" />
            <stop offset="100%" stopColor="rgba(16,211,51,0)" />
          </linearGradient>
          <filter id="portfolio-value-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid lines */}
        {ticks.map((t, i) => {
          const y = yOf(t);
          if (y < TOP - 2 || y > TOP + chartH + 2) return null;
          return (
            <g key={`y-grid-${i}`}>
              <line
                x1={LEFT}
                x2={W - RIGHT}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.04)"
                strokeWidth="1"
              />
              <text
                x={LEFT - 8}
                y={y + 3.5}
                textAnchor="end"
                className="fill-gray-600"
                fontSize="9"
                fontFamily="monospace"
              >
                {fmtAxisVal(t)}
              </text>
            </g>
          );
        })}

        {/* X-axis labels */}
        {timeLabels.map((label, i) => {
          if (i % labelStep !== 0 && i !== points.length - 1) return null;
          return (
            <text
              key={i}
              x={xOf(i)}
              y={H - 4}
              textAnchor="middle"
              className="fill-gray-600"
              fontSize="9"
              fontFamily="monospace"
            >
              {label}
            </text>
          );
        })}

        {/* Volume bars (desktop only — frees vertical space on mobile) */}
        {showVolumeBars &&
          volumeBars.map((v, i) => (
            <rect
              key={i}
              x={xOf(i) - barW / 2}
              y={barY + barH * (1 - v)}
              width={barW}
              height={barH * v}
              rx="1"
              fill={
                hover?.idx === i
                  ? "rgba(16,211,51,0.5)"
                  : "rgba(16,211,51,0.12)"
              }
            />
          ))}

        {/* Area fill + line (2+ daily snapshots) */}
        {points.length >= 2 && (
          <>
            <path d={areaPath} fill="url(#portfolio-value-area-grad)" />
            <path
              d={linePath}
              fill="none"
              stroke="#87FF48"
              strokeWidth={lineStroke}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        )}

        {/* Hover crosshair */}
        {hover && (
          <>
            <line
              x1={hover.x}
              x2={hover.x}
              y1={TOP}
              y2={TOP + chartH}
              stroke="rgba(16,211,51,0.2)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle
              cx={hover.x}
              cy={hover.y}
              r={dotR}
              fill="#87FF48"
              stroke="#030712"
              strokeWidth="2"
            />
            {/* Tooltip */}
            {(() => {
              const hoverLabel = formatUsdCompact(points[hover.idx]);
              const hoverTip = chartValueCalloutBox(hover.x, hoverLabel, 10, chartBounds);
              const hoverBelow = hover.y < TOP + 32;
              return (
                <g>
                  <rect
                    x={hoverTip.rectX}
                    y={hoverBelow ? hover.y + 10 : hover.y - 28}
                    width={hoverTip.rectW}
                    height="20"
                    rx="6"
                    fill="#1a2332"
                    stroke="rgba(16,211,51,0.3)"
                    strokeWidth="1"
                  />
                  <text
                    x={hoverTip.textX}
                    y={hoverBelow ? hover.y + 24 : hover.y - 15}
                    textAnchor="middle"
                    fill="white"
                    fontSize="10"
                    fontWeight="600"
                  >
                    {hoverLabel}
                  </text>
                </g>
              );
            })()}
          </>
        )}

        {/* Current value dot + tooltip (when not hovering) */}
        {!hover && (
          <>
            <circle
              cx={lastX}
              cy={lastY}
              r={lastDotR}
              fill="#87FF48"
              stroke="#030712"
              strokeWidth="2.5"
              filter="url(#portfolio-value-glow)"
            />
            <circle
              cx={lastX}
              cy={lastY}
              r={lastDotRingR}
              fill="none"
              stroke="rgba(16,211,51,0.25)"
              strokeWidth="1.5"
            />
            <g>
              <rect
                x={lastCallout.rectX}
                y={lastTooltipRectY}
                width={lastCallout.rectW}
                height="22"
                rx="6"
                fill="#1a2332"
                stroke="rgba(16,211,51,0.3)"
                strokeWidth="1"
              />
              <text
                x={lastCallout.textX}
                y={lastTooltipTextY}
                textAnchor="middle"
                fill="white"
                fontSize="11"
                fontWeight="700"
              >
                {lastValueLabel}
              </text>
            </g>
          </>
        )}
      </svg>
    </div>
  );
}
