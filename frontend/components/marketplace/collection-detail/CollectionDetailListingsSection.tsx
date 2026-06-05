"use client";

import type { ReactNode } from "react";
import { CollectionListingsSectionHeader } from "./CollectionListingsSectionHeader";

/** Desktop listings band — visually separated from chart / order book cluster. */
export function CollectionDetailListingsSection({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <section
      className="w-full min-w-0 max-lg:hidden"
      aria-labelledby="collection-listings-heading"
    >
      <CollectionListingsSectionHeader />
      <div className="min-w-0">{children}</div>
    </section>
  );
}
