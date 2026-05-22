"use client";

import { formatUsdCompact, NO_EXTERNAL_PRICE } from "@/lib/market";

export function CollectionMobileCurrentPriceRow({
  priceUsd,
  loading = false,
  label = "Current Price",
}: {
  priceUsd: number | null | undefined;
  loading?: boolean;
  label?: string;
}) {
  const showPrice =
    priceUsd != null && Number.isFinite(priceUsd) && priceUsd > 0;

  return (
    <div className="flex w-full min-w-0 items-center justify-between gap-3 border-b border-zinc-800/80 py-3 xl:hidden">
      <span className="text-[13px] font-medium text-zinc-500">{label}</span>
      {loading && !showPrice ? (
        <span
          className="inline-block h-7 w-24 animate-pulse rounded bg-zinc-800/80"
          aria-hidden
        />
      ) : showPrice ? (
        <span className="text-[1.35rem] font-bold tabular-nums tracking-tight text-white">
          {formatUsdCompact(priceUsd)}
        </span>
      ) : (
        <span className="text-[1.1rem] font-semibold text-zinc-500">
          {NO_EXTERNAL_PRICE}
        </span>
      )}
    </div>
  );
}
