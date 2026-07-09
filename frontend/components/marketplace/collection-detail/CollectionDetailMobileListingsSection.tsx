"use client";

import type { ReactNode } from "react";
import { CollectionListingsSectionHeader } from "./CollectionListingsSectionHeader";

/** Mobile listings band — Card.html orderbook rows below chart. */
export function CollectionDetailMobileListingsSection({
  children,
  listingCount,
}: {
  children: ReactNode;
  listingCount?: number;
}) {
  return (
    <section
      className="w-full min-w-0 lg:hidden"
      aria-labelledby="collection-listings-heading"
    >
      <CollectionListingsSectionHeader compact activeCount={listingCount} />
      {children}
    </section>
  );
}
