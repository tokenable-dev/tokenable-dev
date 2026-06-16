"use client";

import { COLLECTION_ORDER_BOOK_FLUSH_INSET } from "@/components/marketplace/collectionOverviewChrome";
import { orderBookTabLabelCls } from "@/components/marketplace/price-metrics-strip/theme";
import type { OrderBookTab } from "@/lib/marketplace/unified-order-book";

const TABS: {
  id: OrderBookTab;
  label: string;
  title?: string;
  flexClass: string;
}[] = [
  { id: "trades", label: "Trades", flexClass: "min-w-0 flex-1" },
  { id: "book", label: "Offers", flexClass: "min-w-0 flex-1" },
];

export function OrderBookTabHeader({
  tab,
  setTab,
  flush,
}: {
  tab: OrderBookTab;
  setTab: (tab: OrderBookTab) => void;
  flush?: boolean;
}) {
  const tabBase = flush
    ? `${orderBookTabLabelCls} border-b-2 border-transparent pb-2 text-center transition-colors duration-200`
    : `${orderBookTabLabelCls} border-b-2 border-transparent px-2 pb-2.5 pt-2 text-center transition-colors duration-200`;
  const tabActive = "border-white text-white";
  const tabInactive = "font-medium text-zinc-500 hover:border-zinc-700 hover:text-zinc-300";

  return (
    <div
      className={`relative flex w-full shrink-0 items-end border-b border-zinc-800/70 bg-black ${
        flush
          ? `${COLLECTION_ORDER_BOOK_FLUSH_INSET} pb-0`
          : "px-2.5 sm:px-3 max-lg:px-2.5 max-lg:pb-0 max-lg:pt-2"
      }`}
    >
      <div className="flex min-w-0 w-full gap-3 sm:gap-4" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            onClick={() => setTab(t.id)}
            title={t.title ?? t.label}
            aria-selected={tab === t.id}
            className={`${tabBase} ${t.flexClass} ${tab === t.id ? tabActive : tabInactive}`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
