"use client";

import type { ReactNode } from "react";
import { TkTab, TkTabs } from "@/components/ds/Tabs";

export type PortfolioMainTab = "collectibles" | "bids" | "history";

function CollectiblesTabIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

function BidsTabIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

function HistoryTabIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export function PortfolioMainSection({
  activeTab,
  onTabChange,
  collectiblesPanel,
  bidsPanel,
  historyPanel,
}: {
  activeTab: PortfolioMainTab;
  onTabChange: (tab: PortfolioMainTab) => void;
  collectiblesPanel: ReactNode;
  bidsPanel: ReactNode;
  historyPanel: ReactNode;
}) {
  return (
    <section className="pf-main-section" aria-label="Portfolio holdings">
      <TkTabs className="portfolio-page__tabs" aria-label="Portfolio sections">
        <TkTab
          id="portfolio-tab-collectibles"
          active={activeTab === "collectibles"}
          aria-controls="portfolio-panel-collectibles"
          onClick={() => onTabChange("collectibles")}
        >
          <CollectiblesTabIcon />
          My Assets
        </TkTab>
        <TkTab
          id="portfolio-tab-bids"
          active={activeTab === "bids"}
          aria-controls="portfolio-panel-bids"
          onClick={() => onTabChange("bids")}
        >
          <BidsTabIcon />
          Active Bids
        </TkTab>
        <TkTab
          id="portfolio-tab-history"
          active={activeTab === "history"}
          aria-controls="portfolio-panel-history"
          onClick={() => onTabChange("history")}
        >
          <HistoryTabIcon />
          Transaction History
        </TkTab>
      </TkTabs>

      {activeTab === "collectibles" ? (
        <div
          role="tabpanel"
          id="portfolio-panel-collectibles"
          aria-labelledby="portfolio-tab-collectibles"
          className="portfolio-page__tab-panel"
        >
          {collectiblesPanel}
        </div>
      ) : activeTab === "bids" ? (
        <div
          role="tabpanel"
          id="portfolio-panel-bids"
          aria-labelledby="portfolio-tab-bids"
          className="portfolio-page__tab-panel"
        >
          {bidsPanel}
        </div>
      ) : (
        <div
          role="tabpanel"
          id="portfolio-panel-history"
          aria-labelledby="portfolio-tab-history"
          className="portfolio-page__tab-panel"
        >
          {historyPanel}
        </div>
      )}
    </section>
  );
}
