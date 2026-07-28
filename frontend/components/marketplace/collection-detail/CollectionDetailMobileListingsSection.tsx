"use client";

import type { ReactNode } from "react";
import { CollectionListingsSectionHeader } from "./CollectionListingsSectionHeader";
import { CollectionPlaceBidBanner } from "./CollectionPlaceBidBanner";

/** Mobile listings band — Card.html orderbook rows below chart. */
export function CollectionDetailMobileListingsSection({
  children,
  listingCount,
  highestBidUsd,
  lowestAskUsd,
  onPlaceBid,
  placeBidDisabled,
}: {
  children: ReactNode;
  listingCount?: number;
  highestBidUsd?: number | null;
  lowestAskUsd?: number | null;
  onPlaceBid?: () => void;
  placeBidDisabled?: boolean;
}) {
  return (
    <section
      className="w-full min-w-0 lg:hidden"
      aria-labelledby="collection-listings-heading"
    >
      <CollectionListingsSectionHeader compact activeCount={listingCount} />
      {onPlaceBid ? (
        <CollectionPlaceBidBanner
          highestBidUsd={highestBidUsd}
          lowestAskUsd={lowestAskUsd}
          onPlaceBid={onPlaceBid}
          disabled={placeBidDisabled}
        />
      ) : null}
      {children}
    </section>
  );
}
