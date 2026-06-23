"use client";

import type { ReactNode } from "react";

export type PortfolioMainTab = "collectibles" | "bids" | "watchlist";

const TAB_SHELL =
  "flex w-full gap-1 rounded-[10px] border border-zinc-800/90 bg-black p-1 sm:max-w-[22rem] sm:p-1.5 lg:max-w-[24rem]";
const TAB_BASE =
  "min-w-0 flex-1 basis-0 rounded-md px-2 py-1.5 text-center text-xs font-medium transition-colors sm:px-3 sm:text-sm lg:px-4";
const TAB_ACTIVE = "border border-mint/40 bg-mint/10 text-mint";
const TAB_INACTIVE =
  "border border-transparent bg-transparent text-[#8E9BAE] hover:text-[#A8B8C8]";

export function PortfolioMainSection({
  activeTab,
  onTabChange,
  collectiblesPanel,
  bidsPanel,
  watchlistPanel,
}: {
  activeTab: PortfolioMainTab;
  onTabChange: (tab: PortfolioMainTab) => void;
  collectiblesPanel: ReactNode;
  bidsPanel: ReactNode;
  watchlistPanel: ReactNode;
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
            Listings
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
            Bids
          </button>
          <button
            type="button"
            role="tab"
            id="portfolio-tab-watchlist"
            aria-selected={activeTab === "watchlist"}
            aria-controls="portfolio-panel-watchlist"
            onClick={() => onTabChange("watchlist")}
            className={`${TAB_BASE} ${activeTab === "watchlist" ? TAB_ACTIVE : TAB_INACTIVE}`}
          >
            Watchlist
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
      ) : activeTab === "bids" ? (
        <div
          role="tabpanel"
          id="portfolio-panel-bids"
          aria-labelledby="portfolio-tab-bids"
          className="min-w-0 overflow-x-hidden"
        >
          {bidsPanel}
        </div>
      ) : (
        <div
          role="tabpanel"
          id="portfolio-panel-watchlist"
          aria-labelledby="portfolio-tab-watchlist"
          className="min-w-0 overflow-x-hidden"
        >
          {watchlistPanel}
        </div>
      )}
    </div>
  );
}
