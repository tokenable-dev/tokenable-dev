"use client";

import { formatUsdCompact } from "@/lib/market";
import { RWA_DETAIL_SLAB_TITLE_MUTED_COLOR_CLASS, rwaDetailRightFont } from "../theme";

/** Card detail — labeled listing price (buyer / owner listing header). */
export function RwaDetailAskPriceDisplay({ priceUsd }: { priceUsd: number }) {
  return (
    <div className="min-w-0">
      <p className={`text-lg font-medium sm:text-xl ${RWA_DETAIL_SLAB_TITLE_MUTED_COLOR_CLASS}`}>
        Price
      </p>
      <p
        className={`${rwaDetailRightFont.className} mt-2 text-[1.125rem] font-semibold leading-none tabular-nums text-white sm:text-[1.25rem]`}
      >
        {formatUsdCompact(priceUsd)}
      </p>
    </div>
  );
}

/** @deprecated Use RwaDetailAskPriceDisplay */
export const RwaDetailListPriceDisplay = RwaDetailAskPriceDisplay;
