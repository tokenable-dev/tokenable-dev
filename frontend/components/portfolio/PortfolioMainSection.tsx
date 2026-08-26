"use client";

import type { ReactNode } from "react";
import { TkButton } from "@/components/ds";
import { TkTab, TkTabs } from "@/components/ds/Tabs";

export type PortfolioMainTab =
  | "collectibles"
  | "redeem"
  | "bids"
  | "history";

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

function RedeemTabIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="7.5 4.21 12 6.81 16.5 4.21" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
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

function TabCount({ value }: { value: number }) {
  return <span className="pf-tab-n tkl-mono">{value}</span>;
}

/** Full tab names (desktop and phone). */
function TabLabel({ full }: { full: string }) {
  return <span className="pf-tab-label">{full}</span>;
}

export function PortfolioMainSection({
  activeTab,
  onTabChange,
  counts,
  variant = "default",
  showRedeemButton = false,
  onEnterRedeemSelect,
  collectiblesPanel,
  redeemPanel: _redeemPanel,
  bidsPanel,
  historyPanel,
}: {
  activeTab: PortfolioMainTab;
  onTabChange: (tab: PortfolioMainTab) => void;
  counts: { assets: number; redeem: number; bids: number; history: number };
  variant?: "default" | "partner";
  showRedeemButton?: boolean;
  onEnterRedeemSelect?: () => void;
  collectiblesPanel: ReactNode;
  redeemPanel: ReactNode;
  bidsPanel: ReactNode;
  historyPanel: ReactNode;
}) {
  const isPartner = variant === "partner";

  function renderShipFromVaultBtn() {
    if (!showRedeemButton || !onEnterRedeemSelect) return null;
    return (
      <TkButton
        type="button"
        variant="ghost"
        size="sm"
        className="pf-redeem-toolbar-btn"
        onClick={onEnterRedeemSelect}
      >
        <RedeemTabIcon />
        Redeem
      </TkButton>
    );
  }

  return (
    <section className="pf-main-section" aria-label="Portfolio holdings">
      <TkTabs
        className={`portfolio-page__tabs${isPartner ? " portfolio-page__tabs--partner" : ""}`}
        aria-label="Portfolio sections"
      >
        <TkTab
          id="portfolio-tab-collectibles"
          active={activeTab === "collectibles"}
          aria-controls="portfolio-panel-collectibles"
          aria-label="My Assets"
          onClick={() => onTabChange("collectibles")}
        >
          <CollectiblesTabIcon />
          <TabLabel full="My Assets" />
          <TabCount value={counts.assets} />
        </TkTab>
        <TkTab
          id="portfolio-tab-bids"
          active={activeTab === "bids"}
          aria-controls="portfolio-panel-bids"
          aria-label="Active Bids"
          onClick={() => onTabChange("bids")}
        >
          <BidsTabIcon />
          <TabLabel full="Active Bids" />
          <TabCount value={counts.bids} />
        </TkTab>
        <TkTab
          id="portfolio-tab-history"
          active={activeTab === "history"}
          aria-controls="portfolio-panel-history"
          aria-label="TX History"
          onClick={() => onTabChange("history")}
        >
          <HistoryTabIcon />
          <TabLabel full="TX History" />
          <TabCount value={counts.history} />
        </TkTab>

        {renderShipFromVaultBtn()}
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
