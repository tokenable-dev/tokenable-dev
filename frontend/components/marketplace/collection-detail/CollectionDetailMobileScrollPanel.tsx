"use client";

import type { ReactNode } from "react";

/**
 * Collection detail mobile — Card.html column order:
 * hero → chart → rail (book + details) → similar (listings removed).
 */
export function CollectionDetailMobileScrollPanel({
  statBlock,
  chartPanel,
  similarPanel,
  orderBookStack,
  detailsPanel,
}: {
  statBlock: ReactNode;
  chartPanel: ReactNode;
  similarPanel?: ReactNode;
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

      {similarPanel != null ? (
        <section
          className="cd-mobile-scroll__similar w-full min-w-0"
          aria-label="Similar items"
        >
          {similarPanel}
        </section>
      ) : null}
    </div>
  );
}
