"use client";

import { formatUsdCompact, NO_EXTERNAL_PRICE } from "@/lib/market";

/**
 * Mobile collection hero — market price grouped with identity copy (left column).
 * Label + value stay together; sits under title/badges beside the cover image.
 */
export function CollectionMobileCurrentPriceRow({
  priceUsd,
  loading = false,
  label = "Market price",
}: {
  /** Cardhedger catalog reference (not Tokenable listing / floor). */
  priceUsd: number | null | undefined;
  loading?: boolean;
  label?: string;
}) {
  const showPrice =
    priceUsd != null && Number.isFinite(priceUsd) && priceUsd > 0;

  const labelText = label.endsWith(":") ? label : `${label}:`;

  return (
    <div
      className="min-w-0 pt-2"
      title="External market reference from Cardhedger (eBay strip), not Tokenable list prices"
    >
      <p className="min-w-0 text-[14px] leading-snug">
        <span className="text-[13px] font-medium text-zinc-400">{labelText} </span>
        {loading && !showPrice ? (
          <span
            className="inline-block h-[1.05rem] w-[5rem] max-w-full translate-y-0.5 animate-pulse rounded bg-zinc-800/80 align-middle"
            aria-hidden
          />
        ) : showPrice ? (
          <span className="text-[18px] font-semibold tabular-nums tracking-tight text-mint">
            {formatUsdCompact(priceUsd)}
          </span>
        ) : (
          <span className="text-[13px] font-medium tabular-nums text-zinc-500">
            {NO_EXTERNAL_PRICE}
          </span>
        )}
      </p>
    </div>
  );
}
