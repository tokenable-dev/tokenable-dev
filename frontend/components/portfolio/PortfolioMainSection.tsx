"use client";

import type { ReactNode } from "react";
import { TkTab, TkTabs } from "@/components/ds/Tabs";

export type PortfolioMainTab =
  | "collectibles"
  | "redeem"
  | "bids"
  | "history";

function TabCount({ value }: { value: number | undefined }) {
  if (value === undefined) return null;
  return <span className="pf-tab-n">{value}</span>;
}

export function PortfolioMainSection({
  activeTab,
  onTabChange,
  counts,
  variant = "default",
  collectiblesPanel,
  redeemPanel: _redeemPanel,
  bidsPanel,
  historyPanel,
}: {
  activeTab: PortfolioMainTab;
  onTabChange: (tab: PortfolioMainTab) => void;
  counts: {
    assets: number;
    redeem: number;
    bids: number | undefined;
    history: number;
  };
  variant?: "default" | "partner";
  collectiblesPanel: ReactNode;
  redeemPanel: ReactNode;
  bidsPanel: ReactNode;
  historyPanel: ReactNode;
}) {
  const isPartner = variant === "partner";

  return (
    <section className="pf-main-section" aria-label="Portfolio holdings">
      <TkTabs
        className={`portfolio-page__tabs${isPartner ? " portfolio-page__tabs--partner" : ""}`}
        aria-label="Portfolio sections"
      >
        <TkTab
          id="portfolio-tab-collectibles"
          className="pf-tab"
          active={activeTab === "collectibles"}
          aria-controls="portfolio-panel-collectibles"
          aria-label="Items"
          onClick={() => onTabChange("collectibles")}
        >
          Items
          <TabCount value={counts.assets} />
        </TkTab>
        <TkTab
          id="portfolio-tab-bids"
          className="pf-tab"
          active={activeTab === "bids"}
          aria-controls="portfolio-panel-bids"
          aria-label="Bids"
          onClick={() => onTabChange("bids")}
        >
          Bids
          <TabCount value={counts.bids} />
        </TkTab>
        <TkTab
          id="portfolio-tab-history"
          className="pf-tab"
          active={activeTab === "history"}
          aria-controls="portfolio-panel-history"
          aria-label="Transactions"
          onClick={() => onTabChange("history")}
        >
          Transactions
          <TabCount value={counts.history} />
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
      ) : activeTab === "redeem" ? (
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
