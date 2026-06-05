"use client";

import type { ReactNode } from "react";
import { CollectionListingsSectionHeader } from "@/components/marketplace/collection-detail/CollectionListingsSectionHeader";

/** Mobile collection detail — listings below market tabs. */
export function CollectionMobileListingsSection({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <section
      className="w-full min-w-0 lg:hidden"
      aria-labelledby="collection-listings-heading"
    >
      <CollectionListingsSectionHeader compact />
      {children}
    </section>
  );
}
