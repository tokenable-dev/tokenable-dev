"use client";

import { formatUsdCompact } from "@/lib/market";

export function AdminMarketPriceStrip({
  askUsd,
  refUsd,
  floorUsd,
  compact,
}: {
  askUsd?: number | null;
  refUsd?: number | null;
  floorUsd?: number | null;
  compact?: boolean;
}) {
  const labelClass = compact
    ? "text-[9px] font-semibold uppercase tracking-wide text-zinc-600"
    : "text-[10px] font-semibold uppercase tracking-wide text-zinc-500";
  const valueClass = compact
    ? "text-[11px] font-semibold text-zinc-200"
    : "text-xs font-semibold text-white";

  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1 ${compact ? "" : "mt-1"}`}>
      {askUsd !== undefined ? (
        <div>
          <span className={labelClass}>Ask</span>
          <p className={valueClass}>{formatUsdCompact(askUsd)}</p>
        </div>
      ) : null}
      <div>
        <span className={labelClass}>Ref</span>
        <p className={valueClass}>{formatUsdCompact(refUsd)}</p>
      </div>
      <div>
        <span className={labelClass}>Floor</span>
        <p className={valueClass}>{formatUsdCompact(floorUsd)}</p>
      </div>
    </div>
  );
}
