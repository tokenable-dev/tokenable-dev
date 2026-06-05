"use client";

import type { ReactNode } from "react";

export type PortfolioMainTab = "collectibles" | "bids";

function tabButtonClass(active: boolean, variant: "primary" | "secondary"): string {
  const base = "rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-colors sm:px-4 sm:py-1.5 sm:text-xs";
  if (!active) return `${base} text-gray-400 hover:text-white`;
  if (variant === "primary") return `${base} bg-mint text-[#061018]`;
  return `${base} bg-zinc-600/90 text-white`;
}

export function PortfolioMainSection({
  activeTab,
  onTabChange,
  collectiblesPanel,
  bidsPanel,
}: {
  activeTab: PortfolioMainTab;
  onTabChange: (tab: PortfolioMainTab) => void;
  collectiblesPanel: ReactNode;
  bidsPanel: ReactNode;
}) {
  return (
    <div className="mb-6 rounded-2xl border border-gray-800 bg-[#0b1118] p-4 sm:p-6">
      <div
        className="mb-4 flex flex-wrap items-center gap-3"
        role="tablist"
        aria-label="Portfolio sections"
      >
        <div className="inline-flex rounded-full border border-gray-700/80 bg-gray-900/70 p-1">
          <button
            type="button"
            role="tab"
            id="portfolio-tab-collectibles"
            aria-selected={activeTab === "collectibles"}
            aria-controls="portfolio-panel-collectibles"
            onClick={() => onTabChange("collectibles")}
            className={tabButtonClass(activeTab === "collectibles", "primary")}
          >
            My Collectibles
          </button>
          <button
            type="button"
            role="tab"
            id="portfolio-tab-bids"
            aria-selected={activeTab === "bids"}
            aria-controls="portfolio-panel-bids"
            onClick={() => onTabChange("bids")}
            className={tabButtonClass(activeTab === "bids", "secondary")}
          >
            Collection Bids
          </button>
        </div>
      </div>

      {activeTab === "collectibles" ? (
        <div
          role="tabpanel"
          id="portfolio-panel-collectibles"
          aria-labelledby="portfolio-tab-collectibles"
        >
          {collectiblesPanel}
        </div>
      ) : (
        <div
          role="tabpanel"
          id="portfolio-panel-bids"
          aria-labelledby="portfolio-tab-bids"
          className="min-w-0 overflow-x-hidden"
        >
          {bidsPanel}
        </div>
      )}
    </div>
  );
}
