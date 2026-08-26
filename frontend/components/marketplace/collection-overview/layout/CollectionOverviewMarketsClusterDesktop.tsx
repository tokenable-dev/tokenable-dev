"use client";

import type { ReactNode } from "react";
import { withFlushProp } from "../utils/withFlushProp";

/**
 * Collection detail desktop — two independent columns:
 *
 *   [ Chart ]              [ Trades + Order book ]
 *   [ Similar items ]      [ Details + Pop ]
 *
 * Columns stack separately so the right column (Trades → Details) does not
 * reflow the left column (Chart → Similar).
 *
 * Sticky `#hero-bar` must sit in a tall parent that also includes this grid.
 */
export function CollectionOverviewMarketsClusterDesktop({
  chartMetricsRow,
  priceChart,
  orderBookNextToChart,
  marketsDockTradePanel,
  tradePanel,
  marketsBelowChart,
  belowCover,
}: {
  chartMetricsRow?: ReactNode;
  priceChart?: ReactNode;
  orderBookNextToChart: ReactNode;
  marketsDockTradePanel: boolean;
  tradePanel?: ReactNode;
  marketsBelowChart?: ReactNode;
  belowCover?: ReactNode;
}) {
  const hasMetrics = chartMetricsRow != null;

  return (
    <div className="relative hidden w-full min-w-0 max-w-full overflow-visible lg:block cd-markets-cluster">
      <div className="cd-markets-cluster__inner w-full min-w-0 overflow-visible">
        <div className="cd-markets-cluster__mat cd-hero-sticky-scope w-full min-w-0 overflow-visible">
          {hasMetrics ? chartMetricsRow : null}

          <div className="cd-detail-grid min-w-0">
            <div className="cd-detail-grid__col cd-detail-grid__col--left min-w-0">
              <div className="cd-detail-grid__chart min-w-0">
                <div className="h-full w-full min-w-0">{priceChart}</div>
              </div>

              {marketsBelowChart != null ? (
                <div
                  className="cd-detail-grid__listings min-w-0"
                  id="collection-listings"
                  aria-label="Individual listings"
                >
                  {marketsBelowChart}
                </div>
              ) : null}
            </div>

            <div className="cd-detail-grid__col cd-detail-grid__col--right rail-slot min-w-0">
              <div className="cd-detail-grid__orderbook min-w-0">
                <div className="cd-sidebar-orderbook flex h-full min-h-0 w-full flex-col overflow-hidden">
                  <div className="flex h-full min-h-0 w-full flex-col">
                    {withFlushProp(orderBookNextToChart)}
                  </div>
                </div>
              </div>

              {belowCover != null || marketsDockTradePanel ? (
                <div
                  className="cd-detail-grid__details min-w-0"
                  aria-label="Collection details"
                >
                  {belowCover != null ? (
                    <div className="cd-sidebar-details flex min-w-0 flex-col">
                      {belowCover}
                    </div>
                  ) : null}
                  {marketsDockTradePanel ? (
                    <div className="cd-sidebar-trade min-w-0 shrink-0">
                      {withFlushProp(tradePanel)}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
