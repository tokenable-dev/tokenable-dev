"use client";

import {
  COLLECTION_DETAILS_BG_CLASS,
  COLLECTION_DETAILS_BORDER_ALL,
  COLLECTION_DETAILS_BORDER_B,
} from "@/components/marketplace/collectionOverviewChrome";
import type { CollectionTradeTab } from "@/lib/marketplace/collection-trading";

export function CollectionTradingBuySellTablist({
  flow,
  onSelectBuy,
  onSelectSell,
}: {
  flow: CollectionTradeTab;
  onSelectBuy: () => void;
  onSelectSell: () => void;
}) {
  return (
    <div
      className={`shrink-0 px-2.5 pb-2 pt-1 sm:px-3 ${COLLECTION_DETAILS_BORDER_B} ${COLLECTION_DETAILS_BG_CLASS}`}
    >
      <div
        className={`relative flex gap-1 rounded-xl ${COLLECTION_DETAILS_BORDER_ALL} p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${COLLECTION_DETAILS_BG_CLASS}`}
        role="tablist"
        aria-label="Buy or sell"
      >
        <span
          aria-hidden
          className={`pointer-events-none absolute top-1 bottom-1 left-1 w-[calc((100%-0.5rem-0.25rem)/2)] rounded-lg shadow-[0_1px_0_rgba(255,255,255,0.05)] transition-[transform,background-color,box-shadow] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] ${
            flow === "buy"
              ? "translate-x-0 bg-pos/[0.18] ring-1 ring-pos/35"
              : "translate-x-[calc(100%+0.25rem)] bg-neg/[0.18] ring-1 ring-neg/35"
          }`}
        />
        <button
          type="button"
          role="tab"
          aria-selected={flow === "buy"}
          onClick={onSelectBuy}
          className={`relative z-10 flex-1 rounded-lg py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide transition-colors ${
            flow === "buy" ? "text-white" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Buy
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={flow === "sell"}
          onClick={onSelectSell}
          className={`relative z-10 flex-1 rounded-lg py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide transition-colors ${
            flow === "sell" ? "text-neg" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Sell
        </button>
      </div>
    </div>
  );
}
