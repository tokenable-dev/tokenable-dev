"use client";

import { COLLECTION_ORDER_BOOK_FLUSH_INSET } from "@/components/marketplace/collectionOverviewChrome";
import { orderBookTabLabelCls } from "@/components/marketplace/price-metrics-strip/theme";
import type { OrderBookTab } from "@/lib/marketplace/unified-order-book";

export function OrderBookTabHeader({
  tab,
  setTab,
  flush,
  collectionDetail = false,
}: {
  tab: OrderBookTab;
  setTab: (tab: OrderBookTab) => void;
  flush?: boolean;
  collectionDetail?: boolean;
}) {
  const tabs = [
    { id: "trades" as const, label: "Trades" },
    {
      id: "book" as const,
      label: collectionDetail ? "Listings" : "Offers",
    },
  ];
  const tabBase = collectionDetail
    ? "cd-ob-tab shrink-0 px-4 py-4 text-[15px] transition-colors duration-200"
    : flush
      ? `${orderBookTabLabelCls} min-w-0 flex-1 border-b-2 border-transparent pb-1.5 text-center transition-colors duration-200`
      : `${orderBookTabLabelCls} min-w-0 flex-1 border-b-2 border-transparent px-2 pb-2.5 pt-2 text-center transition-colors duration-200`;
  const tabActive = collectionDetail
    ? "cd-ob-tab--active"
    : "border-white text-white";
  const tabInactive = collectionDetail
    ? ""
    : "font-medium text-zinc-500 hover:border-zinc-700 hover:text-zinc-300";

  return (
    <div
      className={`relative flex w-full shrink-0 items-end border-b ${
        collectionDetail
          ? "cd-ob-tabs border-white/[0.08] bg-transparent px-4"
          : `border-zinc-800/70 bg-black ${
              flush
                ? `${COLLECTION_ORDER_BOOK_FLUSH_INSET} pb-0`
                : "px-2.5 sm:px-3 max-lg:px-2.5 max-lg:pb-0 max-lg:pt-2"
            }`
      }`}
    >
      <div
        className={`flex shrink-0 ${collectionDetail ? "justify-start gap-0" : "min-w-0 w-full gap-3 sm:gap-4"}`}
        role="tablist"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            onClick={() => setTab(t.id)}
            title={t.label}
            aria-selected={tab === t.id}
            className={`${tabBase} ${tab === t.id ? tabActive : tabInactive}`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
