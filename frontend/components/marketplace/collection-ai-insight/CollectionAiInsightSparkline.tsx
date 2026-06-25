"use client";

import { useMemo } from "react";
import type { CollectionUsdPoint } from "@/lib/core";

function normalizeSeries(values: number[]): { path: string; area: string } | null {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 400;
  const h = 120;
  const padY = 12;
  const innerH = h - padY * 2;

  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = padY + innerH - ((v - min) / span) * innerH;
    return [x, y] as const;
  });

  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  return { path: line, area };
}

export function CollectionAiInsightSparkline({
  sparklineUsd,
  miniSeries,
  className = "",
}: {
  sparklineUsd?: CollectionUsdPoint[];
  miniSeries?: number[];
  className?: string;
}) {
  const paths = useMemo(() => {
    if (sparklineUsd && sparklineUsd.length >= 2) {
      return normalizeSeries(sparklineUsd.map((p) => p.v));
    }
    if (miniSeries && miniSeries.length >= 2) {
      return normalizeSeries(miniSeries);
    }
    return null;
  }, [sparklineUsd, miniSeries]);

  const gradId = useMemo(
    () => `ai-insight-chart-${Math.random().toString(36).slice(2, 9)}`,
    [],
  );

  if (!paths) {
    return (
      <div
        className={`flex h-[140px] items-center justify-center rounded-xl border border-zinc-800/80 bg-zinc-950/40 text-[11px] text-zinc-500 ${className}`}
      >
        Chart data unavailable
      </div>
    );
  }

  return (
    <div className={`relative h-[140px] w-full ${className}`}>
      <svg
        viewBox="0 0 400 120"
        className="h-full w-full"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id={`${gradId}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(16, 211, 51)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="rgb(16, 211, 51)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${gradId}-line`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgb(63, 143, 24)" />
            <stop offset="100%" stopColor="rgb(16, 211, 51)" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={i}
            x1="0"
            y1={20 + i * 20}
            x2="400"
            y2={20 + i * 20}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="1"
          />
        ))}
        <path d={paths.area} fill={`url(#${gradId}-fill)`} />
        <path
          d={paths.path}
          fill="none"
          stroke={`url(#${gradId}-line)`}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
