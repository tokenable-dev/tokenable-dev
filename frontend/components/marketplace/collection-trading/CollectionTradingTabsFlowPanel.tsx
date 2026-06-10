"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import type { Address } from "viem";
import type { Order } from "@/lib/core";
import { isCriteriaCollectionBid } from "@/lib/seaport/criteria/criteriaMatch";
import { CollectionCriteriaBidPanel } from "@/components/marketplace/collection-criteria-bid";
import type { CollectionTradeTab } from "@/lib/marketplace/collection-trading";
import type { BookRowSelection } from "@/lib/marketplace/marketplaceTradingTypes";
import {
  COLLECTION_DETAILS_BG_CLASS,
  COLLECTION_DETAILS_BORDER_ALL,
} from "@/components/marketplace/collectionOverviewChrome";
import { CollectionTradeTicket } from "./CollectionTradeTicket";

export function CollectionTradingTabsFlowPanel({
  flow,
  flush,
  orderBook,
  asks,
  collectionBids,
  connectedAddress,
  onInvalidate,
  collectionLabel,
  collectionKey,
  bookSelection,
  address,
  onBuySuccess,
  onOpenSellModal,
  onInstantBuyFillUsdc,
  onPurchaseFilled,
  presetPriceFromBook,
  listingCount,
  showSellListingCount,
}: {
  flow: CollectionTradeTab;
  flush: boolean;
  orderBook?: ReactNode;
  asks: Order[];
  collectionBids: Order[];
  connectedAddress?: string;
  onInvalidate: () => void;
  collectionLabel: string;
  collectionKey: string;
  bookSelection: BookRowSelection | null;
  address: Address | undefined;
  onBuySuccess: () => void;
  onOpenSellModal: () => void;
  onInstantBuyFillUsdc?: (usdc: number) => void;
  onPurchaseFilled?: () => void;
  presetPriceFromBook?: string | null;
  listingCount: number;
  showSellListingCount: boolean;
}) {
  const myBidToReplace = useMemo(() => {
    const addr = connectedAddress?.toLowerCase();
    if (!addr) return null;
    const mine = collectionBids.filter(
      (o) =>
        o.offerer.toLowerCase() === addr &&
        o.status === "active" &&
        isCriteriaCollectionBid(o),
    );
    return mine.length === 1 ? mine[0]! : null;
  }, [collectionBids, connectedAddress]);

  return (
    <div
      className={`flex flex-col gap-2 p-2 pb-3 sm:p-3 sm:pb-3 ${flush ? "min-h-0 shrink-0" : ""}`}
      role="tabpanel"
    >
      {orderBook != null ? <div className="min-w-0 w-full">{orderBook}</div> : null}

      <div
        className={`w-full min-w-0 ${flush ? "rounded-none border-0 bg-transparent px-2 py-2 sm:px-2.5 sm:py-2.5" : `rounded-lg ${COLLECTION_DETAILS_BORDER_ALL} ${COLLECTION_DETAILS_BG_CLASS} p-2.5 sm:p-3`}`}
      >
        {flow === "buy" ? (
          <div id="collection-bid-panel" className="min-w-0">
            <CollectionCriteriaBidPanel
              variant="embedded"
              collectionKey={collectionKey}
              activeAsks={asks}
              connectedAddress={connectedAddress}
              bidToReplace={myBidToReplace}
              onPlaced={() => onInvalidate()}
              onInstantBuyFillUsdc={onInstantBuyFillUsdc}
              onOpenSellModal={onOpenSellModal}
              presetPriceFromBook={presetPriceFromBook}
              onPurchaseFilled={onPurchaseFilled}
            />
          </div>
        ) : (
          <CollectionTradeTicket
            flow="sell"
            selection={bookSelection}
            address={address}
            onBuySuccess={onBuySuccess}
            onOpenSellModal={onOpenSellModal}
            collectionLabel={collectionLabel}
            listingCount={listingCount}
            showSellListingCount={showSellListingCount}
          />
        )}
      </div>
    </div>
  );
}
