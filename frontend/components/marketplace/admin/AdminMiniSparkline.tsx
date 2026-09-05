"use client";

/** Tiny polyline for admin review — values are USD points. */
export function AdminMiniSparkline({
  points,
  className = "h-10 w-full max-w-[12rem]",
}: {
  points: { t: number; v: number }[];
  className?: string;
}) {
  if (points.length < 2) {
    return (
      <p className="text-xs text-zinc-500">No price history yet</p>
    );
  }
  const vals = points.map((p) => p.v).filter((v) => Number.isFinite(v));
  if (vals.length < 2) {
    return (
      <p className="text-xs text-zinc-500">No price history yet</p>
    );
  }
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const w = 120;
  const h = 40;
  const pad = 2;
  const d = points
    .map((p, i) => {
      const x = pad + (i / (points.length - 1)) * (w - pad * 2);
      const y = pad + (1 - (p.v - min) / span) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = vals[vals.length - 1]! >= vals[0]!;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      role="img"
      aria-label="Price sparkline"
    >
      <path
        d={d}
        fill="none"
        stroke={up ? "#059669" : "#dc2626"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
