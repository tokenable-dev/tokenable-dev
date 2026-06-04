"use client";

import { orderBookTabLabelCls } from "@/components/marketplace/price-metrics-strip/theme";
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
  const tabBase = `${orderBookTabLabelCls} rounded-md px-2.5 py-1 transition-colors`;
  const tabActive = "bg-white/[0.08] text-white";
  const tabInactive = "text-zinc-500 hover:text-zinc-300";

  return (
    <div
      className={`relative flex shrink-0 items-center px-2.5 pt-2 pb-1.5 sm:px-3 ${
        flush ? "justify-stretch" : "justify-end gap-2 max-lg:justify-between max-lg:px-2.5 max-lg:pt-1.5 max-lg:pb-1"
      }`}
    >
      <div
        className={`flex gap-1 ${flush ? "w-full" : "max-lg:ml-0 lg:ml-auto"}`}
      >
        <button
          type="button"
          onClick={() => setTab("trades")}
          className={`${tabBase} ${flush ? "flex-1 text-center" : ""} ${
            tab === "trades" ? tabActive : tabInactive
          }`}
        >
          Trades
        </button>
        <button
          type="button"
          onClick={() => setTab("book")}
          className={`${tabBase} ${flush ? "flex-1 text-center" : ""} ${
            tab === "book" ? tabActive : tabInactive
          }`}
        >
          Order book
        </button>
      </div>
    </div>
  );
}
