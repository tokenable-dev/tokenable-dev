"use client";

import type { Address } from "viem";
import type { BookRowSelection } from "@/lib/marketplace/marketplaceTradingTypes";
import { CollectionTradeTicketBuy } from "./CollectionTradeTicketBuy";
import { CollectionTradeTicketSell } from "./CollectionTradeTicketSell";

interface CollectionTradeTicketProps {
  selection: BookRowSelection | null;
  address: Address | undefined;
  onBuySuccess?: () => void;
  onOpenSellModal: () => void;
  flow: "buy" | "sell";
  collectionLabel?: string;
  listingCount?: number;
  showSellListingCount?: boolean;
}

export function CollectionTradeTicket({
  selection,
  address,
  onBuySuccess,
  onOpenSellModal,
  flow,
  listingCount = 0,
  showSellListingCount = true,
}: CollectionTradeTicketProps) {
  if (flow === "sell") {
    return (
      <CollectionTradeTicketSell
        selection={selection}
        onOpenSellModal={onOpenSellModal}
        listingCount={listingCount}
        showSellListingCount={showSellListingCount}
      />
    );
  }

  return (
    <CollectionTradeTicketBuy
      selection={selection}
      address={address}
      onBuySuccess={onBuySuccess}
    />
  );
}
