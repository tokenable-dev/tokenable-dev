"use client";

import type { ReactNode } from "react";

/**
 * Collection detail mobile — Card.html `@media (max-width:768px)` column order:
 * hero → chart → rail (Trades / Order book + Details) → listings last (`order:99`).
 */
export function CollectionDetailMobileScrollPanel({
  statBlock,
  chartPanel,
  listingsPanel,
  orderBookStack,
  detailsPanel,
}: {
  statBlock: ReactNode;
  chartPanel: ReactNode;
  listingsPanel: ReactNode;
  orderBookStack: ReactNode;
  detailsPanel?: ReactNode;
}) {
  return (
    <div className="cd-mobile-scroll cd-hero-sticky-scope flex w-full min-w-0 flex-col overflow-visible lg:hidden">
      <section className="cd-mobile-scroll__stat w-full min-w-0" aria-label="Market summary">
        {statBlock}
      </section>

      <section className="cd-mobile-scroll__chart w-full min-w-0" aria-label="Price chart">
        {chartPanel}
      </section>

      <section
        className="cd-mobile-scroll__book cd-notch w-full min-w-0 overflow-hidden"
        aria-label="Order book"
      >
        {orderBookStack}
      </section>

      {detailsPanel != null ? (
        <section
          className="cd-mobile-scroll__details cd-sidebar-details cd-notch w-full min-w-0 overflow-hidden"
          aria-label="Collection details"
        >
          {detailsPanel}
        </section>
      ) : null}

      <section
        className="cd-mobile-scroll__listings w-full min-w-0"
        id="listings-section"
        aria-labelledby="collection-listings-heading"
      >
        {listingsPanel}
      </section>
    </div>
  );
}
