"use client";

import { useMemo } from "react";
import { IBM_Plex_Sans } from "next/font/google";
import type { BookRowSelection } from "@/components/marketplace/CollectionTradeTicket";
import {
  formatExchangeTradePriceLabel,
  type CollectionTradeTab,
} from "@/components/marketplace/CollectionTradingTabs";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["500"],
  display: "swap",
});

/** Buy — 2px gradient frame (avoids `border-image` + `border-radius` clipping). */
const BUY_FRAME_GRADIENT =
  "bg-[linear-gradient(90deg,#1D4A4D_9%,#1DFF67_53.81%,#1D4A4D_97.14%)]";

/** Sell — same pattern as buy with red gradient stops. */
const SELL_FRAME_GRADIENT =
  "bg-[linear-gradient(90deg,#610609_0%,#DC0002_53.85%,#7C0001_100%)]";

/** Figma padding: 12px vertical, 10px horizontal. */
const BTN_INNER =
  "flex h-full w-full min-h-0 items-center justify-center rounded-[6px] bg-black px-[10px] py-[12px] text-sm font-semibold text-white transition-transform focus:outline-none active:scale-[0.99]";

export function CollectionHeroTradeControls({
  bookSelection,
  presetPriceFromBook,
  tradeFlow,
  onTradeFlowChange,
  onRequestTradeDock,
}: {
  bookSelection: BookRowSelection | null;
  presetPriceFromBook: string | null;
  tradeFlow: CollectionTradeTab;
  onTradeFlowChange: (tab: Exclude<CollectionTradeTab, "orders">) => void;
  onRequestTradeDock?: () => void;
}) {
  const rawLabel = useMemo(
    () => formatExchangeTradePriceLabel(bookSelection, presetPriceFromBook),
    [bookSelection, presetPriceFromBook],
  );

  // Default to "15$" when no price is selected
  const priceLabel = rawLabel === "—" ? "15$" : rawLabel;

  const buyActive = tradeFlow === "buy";
  const sellActive = tradeFlow === "sell";

  return (
    <div className="flex w-full min-w-0 flex-col gap-2.5">
      <div
        className="flex h-12 w-full shrink-0 items-center rounded-lg border border-[rgba(52,52,52,1)] bg-[rgba(17,17,17,1)] px-3"
        aria-label="Selected price"
      >
        <span className={`${ibmPlexSans.className} shrink-0 text-[20px] font-medium leading-[150%] tracking-[0px] text-zinc-400`}>
          Price :&nbsp;
        </span>
        <span
          className={`${ibmPlexSans.className} min-w-0 truncate tabular-nums text-[20px] font-medium leading-[150%] tracking-[0px] text-white`}
        >
          {priceLabel}
        </span>
      </div>

      {/* Always side-by-side regardless of viewport width or order book visibility */}
      <div className="flex w-full flex-row items-stretch gap-[10px]">
        <div className={`h-12 min-w-0 flex-1 rounded-lg p-[2px] ${BUY_FRAME_GRADIENT}`}>
          <button
            type="button"
            disabled
            aria-pressed={buyActive}
            className={`${BTN_INNER} cursor-not-allowed`}
          >
            Buy
          </button>
        </div>
        <div className={`h-12 min-w-0 flex-1 rounded-lg p-[2px] ${SELL_FRAME_GRADIENT}`}>
          <button
            type="button"
            disabled
            aria-pressed={sellActive}
            className={`${BTN_INNER} cursor-not-allowed`}
          >
            Sell
          </button>
        </div>
      </div>
    </div>
  );
}
