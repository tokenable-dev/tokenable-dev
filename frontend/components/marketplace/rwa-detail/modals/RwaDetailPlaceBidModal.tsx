"use client";

import { TkActionSheet } from "@/components/ds";
import type { Order } from "@/lib/core";
import { CollectionListingBidCheckout } from "@/components/marketplace/collection-detail/CollectionListingBidCheckout";
import { formatListingUsdc } from "@/lib/marketplace/collectionListingModalHelpers";

function stubListingForOffer(tokenId: number, collectionKey: string): Order {
  return {
    id: 0,
    orderHash: "0x",
    offerer: "0x0000000000000000000000000000000000000000",
    side: "ask",
    collectionKey,
    tokenContract: "0x0000000000000000000000000000000000000000",
    tokenId: String(tokenId),
    considerationToken: "0x0000000000000000000000000000000000000000",
    considerationAmount: "0",
    parameters: {
      offerer: "0x0000000000000000000000000000000000000000",
      zone: "0x0000000000000000000000000000000000000000",
      zoneHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
      startTime: "0",
      endTime: "0",
      orderType: 0,
      offer: [],
      consideration: [],
      totalOriginalConsiderationItems: 0,
      salt: "0",
      conduitKey: "0x0000000000000000000000000000000000000000000000000000000000000000",
      counter: "0",
    },
    signature: "0x",
    status: "active",
    startTime: new Date(0).toISOString(),
    endTime: new Date(0).toISOString(),
    createdAt: new Date(0).toISOString(),
  };
}

export function RwaDetailPlaceBidModal({
  open,
  assetTitle,
  tokenId,
  collectionKey,
  listing,
  collectionBids,
  connectedAddress,
  onClose,
  onPlaced,
  onPurchaseFilled,
}: {
  open: boolean;
  assetTitle: string;
  tokenId: number;
  collectionKey: string;
  listing: Order | null;
  collectionBids: Order[];
  connectedAddress?: string;
  onClose: () => void;
  onPlaced?: () => void;
  onPurchaseFilled?: () => void;
}) {
  const floorListing = listing ?? stubListingForOffer(tokenId, collectionKey);
  const listedLabel =
    listing != null ? `${formatListingUsdc(listing.considerationAmount)}.00` : "—";

  return (
    <TkActionSheet open={open} onClose={onClose} aria-label="Place bid">
      <header className="rd-bid-sheet__header">
        <h2 id="rwa-place-bid-title" className="rd-bid-sheet__title">
          Place bid
        </h2>
        <p className="rd-bid-sheet__subtitle line-clamp-2">{assetTitle}</p>
      </header>

      <CollectionListingBidCheckout
        collectionKey={collectionKey}
        tokenId={tokenId}
        listing={floorListing}
        collectionBids={collectionBids}
        listedPriceLabel={listedLabel}
        connectedAddress={connectedAddress}
        onPlaced={() => onPlaced?.()}
        onPurchaseFilled={() => onPurchaseFilled?.()}
        onDone={onClose}
      />
    </TkActionSheet>
  );
}
