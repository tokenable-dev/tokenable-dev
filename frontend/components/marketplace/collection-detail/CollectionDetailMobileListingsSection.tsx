"use client";

import type { ReactNode } from "react";
import { CollectionListingsSectionHeader } from "./CollectionListingsSectionHeader";

/** Mobile listings band — Card.html `#listings-section` (last in the mobile column). */
export function CollectionDetailMobileListingsSection({
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
      className="w-full min-w-0 lg:hidden"
      aria-labelledby="collection-listings-heading"
    >
      <CollectionListingsSectionHeader
        compact
        activeCount={listingCount}
        highestBidUsd={highestBidUsd}
        bidCount={bidCount}
      />
      {children}
    </section>
  );
}
