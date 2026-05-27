"use client";

import { useMemo } from "react";
import type { CollectionUsdPoint } from "@/lib/core";

function buildPath(points: CollectionUsdPoint[], w: number, h: number): string {
  const pad = 2;
  if (points.length === 0) return "";
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const vals = sorted.map((p) => p.v);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = Math.max(maxV - minV, 1e-6);
  const t0 = sorted[0].t;
  const t1 = sorted[sorted.length - 1].t;
  const tr = Math.max(t1 - t0, 1);
  return sorted
    .map((pt, i) => {
      const x = pad + ((pt.t - t0) / tr) * (w - 2 * pad);
      const y = pad + (1 - (pt.v - minV) / range) * (h - 2 * pad);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export function CollectionListSparkline({
  points,
  positive,
  className = "",
}: {
  points: CollectionUsdPoint[] | null | undefined;
  positive?: boolean;
  className?: string;
}) {
  const w = 152;
  const h = 66;
  const { d, up } = useMemo(() => {
    if (!points?.length) return { d: "", up: true };
    const sorted = [...points].sort((a, b) => a.t - b.t);
    const path = buildPath(sorted, w, h);
    const upn = sorted[sorted.length - 1].v >= sorted[0].v;
    return { d: path, up: upn };
  }, [points]);

  const stroke =
    positive !== undefined
      ? positive
        ? "rgba(16, 211, 51, 0.95)"
        : "rgba(248, 113, 113, 0.9)"
      : up
        ? "rgba(16, 211, 51, 0.95)"
        : "rgba(248, 113, 113, 0.9)";

  const trimmed = className.trim();
  const sizeClass = trimmed || "h-20 w-40 shrink-0";

  if (!d) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-gray-800/60 bg-black/40 ${sizeClass}`}
        aria-hidden
      />
    );
  }

  return (
    <svg
      className={`block ${sizeClass}`}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
