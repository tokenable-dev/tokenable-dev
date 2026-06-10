"use client";

import { type ReactNode, useState } from "react";
import type { Address } from "viem";
import type { Order } from "@/lib/core";
import type { CollectionTradeTab } from "@/lib/marketplace/collection-trading";
import type { BookRowSelection } from "@/lib/marketplace/marketplaceTradingTypes";
import { CollectionTradingBuySellTablist } from "./CollectionTradingBuySellTablist";
import { CollectionTradingDockBackdrop } from "./CollectionTradingDockBackdrop";
import { collectionTradingSectionClassName } from "./collectionTradingTabsChrome";
import { CollectionTradingTabsFlowPanel } from "./CollectionTradingTabsFlowPanel";
import { CollectionTradingTabsHeader } from "./CollectionTradingTabsHeader";

export type { CollectionTradeTab } from "@/lib/marketplace/collection-trading";

export function CollectionTradingTabs({
  orderBook,
  bookSelection,
  address,
  onBuySuccess,
  onOpenSellModal,
  collectionKey,
  collectionLabel,
  asks,
  collectionBids,
  connectedAddress,
  onInvalidate,
  onInstantBuyFillUsdc,
  onPurchaseFilled,
  presetPriceFromBook,
  listingCount,
  showSellListingCount = true,
  flush = false,
  marketsDock = false,
  dockOpen = false,
  onDockOpenChange,
  tradeFlow: tradeFlowProp,
  onTradeFlowChange,
}: {
  orderBook?: ReactNode;
  bookSelection: BookRowSelection | null;
  address: Address | undefined;
  onBuySuccess: () => void;
  onOpenSellModal: () => void;
  collectionKey: string;
  collectionLabel: string;
  asks: Order[];
  collectionBids: Order[];
  connectedAddress?: string;
  onInvalidate: () => void;
  onInstantBuyFillUsdc?: (usdc: number) => void;
  onPurchaseFilled?: () => void;
  presetPriceFromBook?: string | null;
  listingCount: number;
  showSellListingCount?: boolean;
  flush?: boolean;
  marketsDock?: boolean;
  dockOpen?: boolean;
  onDockOpenChange?: (open: boolean) => void;
  tradeFlow?: CollectionTradeTab;
  onTradeFlowChange?: (tab: CollectionTradeTab) => void;
}) {
  const [internalFlow, setInternalFlow] = useState<CollectionTradeTab>("buy");
  const controlled = tradeFlowProp !== undefined && onTradeFlowChange !== undefined;
  const flow = controlled ? tradeFlowProp! : internalFlow;
  const setFlow = (f: CollectionTradeTab) => {
    if (controlled) onTradeFlowChange!(f);
    else setInternalFlow(f);
  };

  const docked = Boolean(flush && marketsDock);
  const dockControlled = onDockOpenChange != null;
  const dockVisible = docked ? (dockControlled ? dockOpen : true) : true;

  return (
    <>
      <CollectionTradingDockBackdrop
        visible={docked && dockVisible && dockControlled}
        onClose={() => onDockOpenChange?.(false)}
      />
      <section
        className={collectionTradingSectionClassName({ docked, dockVisible, flush })}
        id="collection-trading"
        aria-label="Trade"
        aria-hidden={docked && !dockVisible ? true : undefined}
      >
        <CollectionTradingTabsHeader
          collectionLabel={collectionLabel}
          flush={flush}
          docked={docked}
          dockControlled={dockControlled}
          onCloseDock={() => onDockOpenChange?.(false)}
        />

        {!flush ? (
          <CollectionTradingBuySellTablist
            flow={flow}
            onSelectBuy={() => setFlow("buy")}
            onSelectSell={() => setFlow("sell")}
          />
        ) : null}

        <div
          className={
            flush
              ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-auto"
              : "contents"
          }
        >
          <CollectionTradingTabsFlowPanel
            flow={flow}
            flush={flush}
            orderBook={orderBook}
            asks={asks}
            collectionBids={collectionBids}
            connectedAddress={connectedAddress}
            onInvalidate={onInvalidate}
            collectionLabel={collectionLabel}
            collectionKey={collectionKey}
            bookSelection={bookSelection}
            address={address}
            onBuySuccess={onBuySuccess}
            onOpenSellModal={onOpenSellModal}
            onInstantBuyFillUsdc={onInstantBuyFillUsdc}
            onPurchaseFilled={onPurchaseFilled}
            presetPriceFromBook={presetPriceFromBook}
            listingCount={listingCount}
            showSellListingCount={showSellListingCount}
          />
        </div>
      </section>
    </>
  );
}
