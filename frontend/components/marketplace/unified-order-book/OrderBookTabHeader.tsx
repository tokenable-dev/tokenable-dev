"use client";

import { orderBookTabLabelCls } from "@/components/marketplace/price-metrics-strip/theme";
import type { OrderBookTab } from "@/lib/marketplace/unified-order-book";

const TABS: {
  id: OrderBookTab;
  label: string;
  title?: string;
  flexClass: string;
}[] = [
  { id: "trades", label: "Trades", flexClass: "min-w-0 flex-1" },
  { id: "book", label: "Order book", flexClass: "min-w-0 flex-[1.45]" },
  {
    id: "orders",
    label: "Orders",
    title: "Your active listings and collection bids",
    flexClass: "min-w-0 flex-1",
  },
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
  const tabBase = `${orderBookTabLabelCls} px-2 py-1.5 text-center transition-colors duration-200`;
  const tabActive = "text-white";
  const tabInactive = "text-zinc-500 hover:text-zinc-300";

  return (
    <div
      className={`relative flex w-full shrink-0 items-center px-2.5 pt-2 pb-1.5 sm:px-3 ${
        flush ? "" : "max-lg:px-2.5 max-lg:pt-1.5 max-lg:pb-1"
      }`}
    >
      <div className="flex min-w-0 w-full gap-0.5 sm:gap-1" role="tablist">
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
