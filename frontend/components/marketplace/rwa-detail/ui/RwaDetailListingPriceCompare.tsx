"use client";

import { formatUsdCompact } from "@/lib/market";
import { RWA_DETAIL_SLAB_TITLE_MUTED_COLOR_CLASS, rwaDetailRightFont } from "../theme";

/** Side-by-side listing / ask and collection market price. */
export function RwaDetailListingPriceCompare({
  listingPriceUsd,
  marketPriceUsd,
  compact = false,
  listingLabel = "Price",
  marketLabel = "Market Price",
}: {
  listingPriceUsd: number | null;
  marketPriceUsd: number | null;
  compact?: boolean;
  listingLabel?: string;
  marketLabel?: string;
}) {
  if (
    listingPriceUsd == null ||
    marketPriceUsd == null ||
    !Number.isFinite(listingPriceUsd) ||
    !Number.isFinite(marketPriceUsd) ||
    listingPriceUsd <= 0 ||
    marketPriceUsd <= 0
  ) {
    return null;
  }

  return (
    <div className={`grid gap-4 ${compact ? "grid-cols-1" : "grid-cols-2 sm:gap-5"}`}>
      <div className="min-w-0">
        <p className={`text-lg font-medium sm:text-xl ${RWA_DETAIL_SLAB_TITLE_MUTED_COLOR_CLASS}`}>
          {listingLabel}
        </p>
        <p
          className={`${rwaDetailRightFont.className} mt-2 text-[clamp(2.25rem,8vw,3.25rem)] font-bold tabular-nums text-mint sm:text-[2.75rem]`}
        >
          {formatUsdCompact(listingPriceUsd)}
        </p>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-zinc-400 sm:text-sm">{marketLabel}</p>
        <p
          className={`${rwaDetailRightFont.className} mt-1.5 text-2xl font-bold tabular-nums text-white sm:text-3xl`}
        >
          {formatUsdCompact(marketPriceUsd)}
        </p>
      </div>
    </div>
  );
}
