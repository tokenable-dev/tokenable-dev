"use client";

import type { ReactNode } from "react";
import { CollectionListingsSectionHeader } from "./CollectionListingsSectionHeader";

/** Desktop listings band — visually separated from chart / order book cluster. */
export function CollectionDetailListingsSection({
  children,
  count,
}: {
  children: ReactNode;
  count?: number;
}) {
  return (
    <section
      className="w-full min-w-0 max-lg:hidden"
      aria-labelledby="collection-listings-heading"
    >
      <CollectionListingsSectionHeader count={count} />
      <div className="min-w-0">{children}</div>
    </section>
  );
}
