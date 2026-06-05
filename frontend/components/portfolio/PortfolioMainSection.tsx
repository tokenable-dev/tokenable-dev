"use client";

import type { ReactNode } from "react";

export type PortfolioMainTab = "collectibles" | "bids";

const TAB_SHELL =
  "flex w-full gap-1 rounded-full border border-gray-700/80 bg-gray-900/70 p-1 sm:inline-flex sm:w-auto sm:gap-0.5";
const TAB_BASE =
  "min-w-0 flex-1 rounded-full px-3 py-2 text-center text-[11px] font-semibold transition-colors sm:flex-none sm:px-3.5 sm:py-1";
const TAB_ACTIVE = "bg-mint text-[#061018]";
const TAB_INACTIVE = "text-gray-400 hover:text-white";

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
    <div className="mb-6 rounded-2xl border border-gray-800 bg-[#0b1118] p-3 sm:p-5">
      <div className="mb-3 sm:mb-4" role="tablist" aria-label="Portfolio sections">
        <div className={TAB_SHELL}>
          <button
            type="button"
            role="tab"
            id="portfolio-tab-collectibles"
            aria-selected={activeTab === "collectibles"}
            aria-controls="portfolio-panel-collectibles"
            onClick={() => onTabChange("collectibles")}
            className={`${TAB_BASE} ${activeTab === "collectibles" ? TAB_ACTIVE : TAB_INACTIVE}`}
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
            className={`${TAB_BASE} ${activeTab === "bids" ? TAB_ACTIVE : TAB_INACTIVE}`}
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
