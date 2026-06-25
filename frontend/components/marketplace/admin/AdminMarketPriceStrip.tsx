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
  const chips = [
    askUsd !== undefined ? { label: "Ask", value: askUsd } : null,
    { label: "Ref", value: refUsd },
    { label: "Floor", value: floorUsd },
  ].filter((c): c is { label: string; value: number | null | undefined } => c != null);

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {chips.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-lg border border-zinc-800/80 bg-zinc-900/50 px-3 py-2"
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {label}
            </span>
            <p className="text-sm font-bold text-white">{formatUsdCompact(value)}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      {chips.map(({ label, value }) => (
        <div
          key={label}
          className="min-w-[5.5rem] rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-4 py-3"
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {label}
          </span>
          <p className="mt-0.5 text-lg font-bold text-white sm:text-xl">
            {formatUsdCompact(value)}
          </p>
        </div>
      ))}
    </div>
  );
}
