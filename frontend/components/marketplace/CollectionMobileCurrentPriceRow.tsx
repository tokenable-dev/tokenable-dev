"use client";

import { formatUsdCompact, NO_EXTERNAL_PRICE } from "@/lib/market";

/**
 * Mobile collection hero — market price grouped with identity copy (left column).
 * Label + value stay together; sits under title/badges beside the cover image.
 */
export function CollectionMobileCurrentPriceRow({
  priceUsd,
  loading = false,
  label = "Market Price",
}: {
  /** Cardhedger catalog reference (not Tokenable listing / floor). */
  priceUsd: number | null | undefined;
  loading?: boolean;
  label?: string;
}) {
  const showPrice =
    priceUsd != null && Number.isFinite(priceUsd) && priceUsd > 0;

  return (
    <div
      className="min-w-0 border-t border-zinc-800/40 pt-2.5"
      title="External market reference from Cardhedger (eBay strip), not Tokenable list prices"
    >
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
          {label}
        </span>
        {loading && !showPrice ? (
          <span
            className="inline-block h-[1.25rem] w-[5rem] max-w-full animate-pulse rounded bg-zinc-800/80"
            aria-hidden
          />
        ) : showPrice ? (
          <>
            <span className="text-[1.125rem] font-semibold leading-none tabular-nums tracking-tight text-mint">
              {formatUsdCompact(priceUsd)}
            </span>
            <span className="shrink-0 text-[9px] font-medium uppercase tracking-[0.04em] text-white">
              USDC
            </span>
          </>
        ) : (
          <span className="text-[1rem] font-medium leading-none tabular-nums text-zinc-500">
            {NO_EXTERNAL_PRICE}
          </span>
        )}
      </div>
    </div>
  );
}
