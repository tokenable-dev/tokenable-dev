"use client";

import type { ReactNode } from "react";
import { CollectionListingsSectionHeader } from "./CollectionListingsSectionHeader";

/** Desktop listings band — Card.html `#listings-section`. */
export function CollectionDetailListingsSection({
  children,
  listingCount,
  highestBidUsd,
  bidCount,
}: {
  children: ReactNode;
  listingCount?: number;
  highestBidUsd?: number | null;
  bidCount?: number;
}) {
  return (
    <section
      className="w-full min-w-0 max-lg:hidden"
      id="listings-section"
      aria-labelledby="collection-listings-heading"
    >
      <CollectionListingsSectionHeader
        activeCount={listingCount}
        highestBidUsd={highestBidUsd}
        bidCount={bidCount}
      />
      <div className="min-w-0">{children}</div>
    </section>
  );
}
