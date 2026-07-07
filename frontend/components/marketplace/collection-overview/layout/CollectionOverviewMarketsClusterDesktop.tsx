"use client";

import type { ReactNode } from "react";
import { withFlushProp } from "../utils/withFlushProp";

/**
 * Collection detail desktop — Card.html card-detail-grid:
 * left (1.7fr): stat block → chart → listings; right (1fr, sticky): order book → details → trade dock.
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
    <div className="relative hidden w-full min-w-0 max-w-full lg:block cd-markets-cluster">
      <div className="cd-markets-cluster__inner w-full min-w-0 max-w-full">
        <div className="cd-markets-cluster__mat w-full min-w-0">
          <div className="cd-detail-grid grid min-w-0 items-start gap-x-[clamp(20px,3vw,40px)] gap-y-[26px]">
            {hasMetrics ? (
              <div className="cd-detail-grid__left cd-detail-grid__metrics min-w-0">
                {chartMetricsRow}
              </div>
            ) : null}

            <div
              className="cd-detail-grid__left cd-detail-grid__chart min-h-0 min-w-0 overflow-hidden"
            >
              <div className="flex h-full min-h-0 w-full flex-col [&>*]:min-h-0 [&>*]:flex-1">
                {priceChart}
              </div>
            </div>

            {marketsBelowChart != null ? (
              <div
                className="cd-detail-grid__left cd-detail-grid__listings min-w-0"
                id="collection-listings"
                aria-label="Individual listings"
              >
                {marketsBelowChart}
              </div>
            ) : null}

            <div className="cd-detail-grid__sidebar">
              <div className="cd-sidebar-sticky flex flex-col gap-5">
                <div className="cd-sidebar-orderbook flex min-h-0 flex-col overflow-hidden">
                  <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
                    {withFlushProp(orderBookNextToChart)}
                  </div>
                </div>

                {belowCover != null ? (
                  <div className="cd-sidebar-details flex min-w-0 flex-col" aria-label="Collection details">
                    {belowCover}
                  </div>
                ) : null}

                {marketsDockTradePanel ? (
                  <div className="cd-sidebar-trade min-w-0 shrink-0">
                    {withFlushProp(tradePanel)}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
