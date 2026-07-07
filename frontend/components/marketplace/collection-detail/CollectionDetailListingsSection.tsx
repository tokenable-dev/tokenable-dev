"use client";

import type { ReactNode } from "react";
import { CollectionListingsSectionHeader } from "./CollectionListingsSectionHeader";

/** Desktop listings band — visually separated from chart / order book cluster. */
export function CollectionDetailListingsSection({
  children,
  listingCount,
}: {
  children: ReactNode;
  listingCount?: number;
}) {
  return (
    <section
      className="w-full min-w-0 max-lg:hidden"
      aria-labelledby="collection-listings-heading"
    >
      <CollectionListingsSectionHeader activeCount={listingCount} />
      <div className="min-w-0">{children}</div>
    </section>
  );
}
