"use client";

import { useMemo } from "react";

export function PortfolioTrendSparkline({
  values,
  width = 80,
  height = 28,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  const { points, stroke } = useMemo(() => {
    if (values.length < 2) {
      return { points: "", stroke: "rgba(255,255,255,0.35)" };
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const pts = values
      .map((v, i) => {
        const x = (i / (values.length - 1)) * (width - 4) + 2;
        const y = height - 2 - ((v - min) / range) * (height - 4);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    const up = values[values.length - 1]! >= values[0]!;
    return { points: pts, stroke: up ? "#00C350" : "#E4374A" };
  }, [values, width, height]);

  if (!points) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
        <line
          x1={2}
          y1={height / 2}
          x2={width - 2}
          y2={height / 2}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={1.5}
        />
      </svg>
    );
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
