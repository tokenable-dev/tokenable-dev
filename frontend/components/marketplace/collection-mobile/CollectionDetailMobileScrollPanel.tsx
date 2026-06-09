"use client";

import type { ReactNode } from "react";
import {
  COLLECTION_MARKETS_CHART_HEIGHT_MOBILE_CLASS,
} from "@/components/marketplace/collectionOverviewChrome";

/**
 * Collection detail mobile — single scroll column: chart → listings → order book tabs.
 */
export function CollectionDetailMobileScrollPanel({
  chartPanel,
  listingsPanel,
  orderBookStack,
}: {
  chartPanel: ReactNode;
  listingsPanel: ReactNode;
  orderBookStack: ReactNode;
}) {
  return (
    <div className="flex w-full min-w-0 flex-col lg:hidden">
      <section className="w-full min-w-0 pt-1" aria-label="Price chart">
        <div
          className={`w-full min-w-0 overflow-hidden ${COLLECTION_MARKETS_CHART_HEIGHT_MOBILE_CLASS}`}
        >
          {chartPanel}
        </div>
      </section>

      <section
        className="mt-4 w-full min-w-0 border-t border-zinc-800/40 pt-4"
        aria-labelledby="collection-listings-heading"
      >
        {listingsPanel}
      </section>

      <div className="mt-4 w-full min-w-0 border-t border-zinc-800/40 pt-4">
        {orderBookStack}
      </div>
    </div>
  );
}
