"use client";

import type { ReactNode } from "react";
import { CollectionListingsSectionHeader } from "@/components/marketplace/collection-detail/CollectionListingsSectionHeader";

/** Mobile collection detail — listings below market tabs. */
export function CollectionMobileListingsSection({
  children,
  count,
}: {
  children: ReactNode;
  count?: number;
}) {
  return (
    <section
      className="w-full min-w-0 lg:hidden"
      aria-labelledby="collection-listings-heading"
    >
      <CollectionListingsSectionHeader count={count} compact />
      {children}
    </section>
  );
}
