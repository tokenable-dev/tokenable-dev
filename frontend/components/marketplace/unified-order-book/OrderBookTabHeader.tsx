"use client";

import {
  COLLECTION_DETAILS_BORDER_B,
} from "@/components/marketplace/collectionOverviewChrome";
import type { OrderBookTab } from "@/lib/marketplace/unified-order-book";

export function OrderBookTabHeader({
  tab,
  setTab,
  flush,
}: {
  tab: OrderBookTab;
  setTab: (tab: OrderBookTab) => void;
  flush?: boolean;
}) {
  return (
    <div
      className={`relative shrink-0 flex items-center justify-end gap-2 max-lg:justify-between max-lg:px-2.5 max-lg:pt-1.5 max-lg:pb-1 px-2.5 pt-2 pb-1 sm:px-3 ${
        flush ? "border-b border-[rgba(38,39,45,1)] max-lg:bg-[rgb(20,20,21)]" : COLLECTION_DETAILS_BORDER_B
      }`}
    >
      {flush ? (
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500 max-lg:inline lg:hidden">
          Depth
        </span>
      ) : null}
      <div
        className={`flex rounded-lg bg-black/30 p-0.5 ring-1 ring-[rgba(11,13,16,1)] ${flush ? "max-lg:ml-0 lg:ml-auto" : ""}`}
      >
        <button
          type="button"
          onClick={() => setTab("book")}
          className={`rounded-md px-2.5 py-1 text-[10px] font-semibold tracking-wide transition-colors ${
            tab === "book"
              ? "bg-white/[0.08] text-white shadow-sm"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          OrderBook
        </button>
        <button
          type="button"
          onClick={() => setTab("trades")}
          className={`rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
            tab === "trades"
              ? "bg-white/[0.08] text-white shadow-sm"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          TRADES
        </button>
      </div>
    </div>
  );
}
