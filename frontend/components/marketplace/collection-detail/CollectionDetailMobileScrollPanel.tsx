"use client";

import type { ReactNode } from "react";

/**
 * Collection detail mobile — Card.html single column:
 * stat block → chart → listings → order book → Details / PSA Population.
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
    <div className="cd-mobile-scroll flex w-full min-w-0 flex-col lg:hidden">
      <section className="cd-mobile-scroll__stat w-full min-w-0" aria-label="Market summary">
        {statBlock}
      </section>

      <section className="cd-mobile-scroll__chart w-full min-w-0" aria-label="Price chart">
        {chartPanel}
      </section>

      <section
        className="cd-mobile-scroll__listings w-full min-w-0"
        aria-labelledby="collection-listings-heading"
      >
        {listingsPanel}
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
    </div>
  );
}
