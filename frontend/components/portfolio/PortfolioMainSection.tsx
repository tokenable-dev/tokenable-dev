"use client";

import type { ReactNode } from "react";

export type PortfolioMainTab = "collectibles" | "bids";

/** Segmented tab bar — equal halves, compact height and horizontal inset. */
const TAB_SHELL =
  "flex w-full gap-1 rounded-[10px] border border-zinc-800/90 bg-black p-1 sm:max-w-[18rem] sm:p-1.5 lg:max-w-[19rem]";
const TAB_BASE =
  "min-w-0 flex-1 basis-0 rounded-md px-4 py-1.5 text-center text-sm font-medium transition-colors sm:px-6 sm:py-1.5 lg:px-7";
const TAB_ACTIVE = "border border-white bg-black text-white";
const TAB_INACTIVE =
  "border border-transparent bg-transparent text-[#8E9BAE] hover:text-[#A8B8C8]";

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
