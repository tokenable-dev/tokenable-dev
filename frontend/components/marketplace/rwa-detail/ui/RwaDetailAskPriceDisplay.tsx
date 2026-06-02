"use client";

import { formatUsdCompact } from "@/lib/market";
import { rwaDetailRightFont } from "../theme";

/** Card detail — labeled ask price (buyer / owner listing header). */
export function RwaDetailAskPriceDisplay({ priceUsd }: { priceUsd: number }) {
  return (
    <div className="min-w-0">
      <p className="text-lg font-medium text-white sm:text-xl">Ask Price</p>
      <p
        className={`${rwaDetailRightFont.className} mt-2 text-[clamp(2.5rem,9vw,3.75rem)] font-bold leading-none tabular-nums text-mint sm:text-[3.25rem]`}
      >
        {formatUsdCompact(priceUsd)}
      </p>
    </div>
  );
}

/** @deprecated Use RwaDetailAskPriceDisplay */
export const RwaDetailListPriceDisplay = RwaDetailAskPriceDisplay;
