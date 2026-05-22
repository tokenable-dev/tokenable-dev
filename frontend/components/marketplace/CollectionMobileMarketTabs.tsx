"use client";

import { useState, type ReactNode } from "react";
export type CollectionMobileMarketTabId = "information" | "chart" | "orderbook";

const TABS: { id: CollectionMobileMarketTabId; label: string }[] = [
  { id: "information", label: "Information" },
  { id: "chart", label: "Chart" },
  { id: "orderbook", label: "Order book" },
];

export function CollectionMobileMarketTabs({
  informationPanel,
  chartPanel,
  orderBookPanel,
  defaultTab = "information",
}: {
  informationPanel: ReactNode;
  chartPanel: ReactNode;
  orderBookPanel: ReactNode;
  defaultTab?: CollectionMobileMarketTabId;
}) {
  const [tab, setTab] = useState<CollectionMobileMarketTabId>(defaultTab);

  let panel: ReactNode = informationPanel;
  if (tab === "chart") panel = chartPanel;
  if (tab === "orderbook") panel = orderBookPanel;

  return (
    <div className="flex w-full min-w-0 shrink-0 flex-col lg:hidden">
      <div className="shrink-0" role="tablist" aria-label="Collection market views">
        <div className="flex min-w-0 gap-1.5">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`relative min-h-[34px] min-w-0 flex-1 touch-manipulation rounded-[8px] border px-1 py-1.5 text-center text-[11px] font-semibold tracking-tight transition-[color,background-color,border-color] duration-150 ${
                  active
                    ? "border-zinc-600/80 bg-black text-mint"
                    : "border-transparent bg-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 pt-2.5" role="tabpanel">
        {panel}
      </div>
    </div>
  );
}
