"use client";

import { useState, type ReactNode } from "react";
export type CollectionMobileMarketTabId = "information" | "chart" | "orderbook";

const TABS: { id: CollectionMobileMarketTabId; label: string }[] = [
  { id: "information", label: "Info" },
  { id: "chart", label: "Chart" },
  { id: "orderbook", label: "Order book" },
];

export function CollectionMobileMarketTabs({
  informationPanel,
  chartPanel,
  orderBookPanel,
  listingsPanel,
  defaultTab = "information",
}: {
  informationPanel: ReactNode;
  chartPanel: ReactNode;
  orderBookPanel: ReactNode;
  /** On Info tab: rendered directly under the information panel (no chart/book height reserve). */
  listingsPanel?: ReactNode;
  defaultTab?: CollectionMobileMarketTabId;
}) {
  const [tab, setTab] = useState<CollectionMobileMarketTabId>(defaultTab);
  const isInfoTab = tab === "information";
  const isChartTab = tab === "chart";
  const isOrderBookTab = tab === "orderbook";
  const listingsBelowPanel = isInfoTab || isChartTab;

  let panel: ReactNode = informationPanel;
  if (isChartTab) panel = chartPanel;
  if (isOrderBookTab) panel = orderBookPanel;

  const tabPanelClass = "shrink-0 pt-2 min-h-0 overflow-visible max-lg:overflow-x-clip";

  return (
    <div className="flex w-full min-w-0 shrink-0 flex-col lg:hidden">
      <div
        className="flex min-w-0 border-b border-zinc-800"
        role="tablist"
        aria-label="Collection market views"
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`relative min-h-[36px] min-w-0 flex-1 touch-manipulation px-2 pb-2.5 pt-1 text-center text-[12px] font-semibold tracking-tight transition-colors ${
                active ? "text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t.label}
              {active ? (
                <span
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-mint"
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className={tabPanelClass} role="tabpanel">
        {panel}
        {listingsBelowPanel && listingsPanel ? (
          <div className="mt-2 min-w-0 shrink-0 pb-1">{listingsPanel}</div>
        ) : null}
      </div>

      {isOrderBookTab && listingsPanel ? (
        <div className="mt-2 min-w-0 shrink-0 pb-4">{listingsPanel}</div>
      ) : null}
    </div>
  );
}
