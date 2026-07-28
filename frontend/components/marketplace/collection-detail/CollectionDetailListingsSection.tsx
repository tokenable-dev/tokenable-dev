"use client";

import type { ReactNode } from "react";
import { CollectionListingsSectionHeader } from "./CollectionListingsSectionHeader";
import { CollectionPlaceBidBanner } from "./CollectionPlaceBidBanner";

/** Desktop listings band — visually separated from chart / order book cluster. */
export function CollectionDetailListingsSection({
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
      className="w-full min-w-0 max-lg:hidden"
      aria-labelledby="collection-listings-heading"
    >
      <CollectionListingsSectionHeader activeCount={listingCount} />
      {onPlaceBid ? (
        <CollectionPlaceBidBanner
          highestBidUsd={highestBidUsd}
          lowestAskUsd={lowestAskUsd}
          onPlaceBid={onPlaceBid}
          disabled={placeBidDisabled}
        />
      ) : null}
      <div className="min-w-0">{children}</div>
    </section>
  );
}
