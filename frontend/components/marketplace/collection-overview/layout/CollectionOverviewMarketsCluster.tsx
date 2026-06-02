"use client";

import type { ReactNode } from "react";
import { CollectionPriceHistoryPlaceholder } from "@/components/marketplace/markets-ui";
import { CollectionOrderBookVisibilityToggle } from "@/components/marketplace/markets-ui";
import {
  COLLECTION_MARKETS_ORDER_BOOK_FRAME,
  COLLECTION_MARKET_CLUSTER_BEZEL,
  COLLECTION_MARKET_CLUSTER_MAT,
} from "@/components/marketplace/collectionOverviewChrome";
import { withFlushProp } from "../utils/withFlushProp";

export function CollectionOverviewMarketsCluster({
  orderBookToggleEnabled,
  showOrderBook,
  onShowOrderBookChange,
  chartMetricsRow,
  orderBookColumnVisible,
  useMobileTabbedMarket,
  priceChart,
  orderBookNextToChart,
  marketsRightStackTop,
  marketsDockTradePanel,
  tradePanel,
  marketsChartFooter,
  marketsBelowChart,
  belowCover,
}: {
  orderBookToggleEnabled: boolean;
  showOrderBook: boolean;
  onShowOrderBookChange?: (next: boolean) => void;
  chartMetricsRow?: ReactNode;
  orderBookColumnVisible: boolean;
  useMobileTabbedMarket: boolean;
  priceChart?: ReactNode;
  orderBookNextToChart: ReactNode;
  marketsRightStackTop?: ReactNode;
  marketsDockTradePanel: boolean;
  tradePanel?: ReactNode;
  marketsChartFooter?: ReactNode;
  marketsBelowChart?: ReactNode;
  belowCover?: ReactNode;
}) {
  return (
    <div className="relative w-full min-w-0 max-w-full">
      {orderBookToggleEnabled ? (
        <div className="pointer-events-none absolute right-[calc(0.75rem+1px)] top-[-1px] z-[8] max-lg:hidden sm:right-[calc(1rem+1px)]">
          <div className="pointer-events-auto">
            <CollectionOrderBookVisibilityToggle
              checked={showOrderBook}
              onChange={onShowOrderBookChange!}
              rowJustify="end"
              contentWidth
              variant="inline"
            />
          </div>
        </div>
      ) : null}
      <div className={`${COLLECTION_MARKET_CLUSTER_BEZEL} w-full min-w-0 max-w-full`}>
        <div className={`${COLLECTION_MARKET_CLUSTER_MAT} w-full min-w-0`}>
          {chartMetricsRow != null ? (
            <div
              className={`hidden w-full min-w-0 lg:block ${
                orderBookToggleEnabled
                  ? "max-lg:pt-0 pt-[calc(1.25rem-5px)] sm:pt-[calc(1.5rem-5px)] lg:pt-[calc(1.25rem-5px)]"
                  : ""
              }`}
            >
              {chartMetricsRow}
            </div>
          ) : null}

          <div
            className={[
              chartMetricsRow != null ? "max-lg:mt-2 mt-3" : "",
              "flex min-w-0 w-full max-w-full flex-col gap-3 max-lg:gap-2 max-lg:items-stretch",
              "lg:grid lg:min-h-0 lg:gap-x-3 lg:gap-y-3",
              orderBookColumnVisible
                ? "lg:grid-cols-[minmax(0,1fr)_221px]"
                : "lg:grid-cols-[minmax(0,1fr)]",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div
              className={`flex min-h-0 min-w-0 flex-col lg:col-start-1 lg:row-start-1 lg:h-[409px] lg:max-h-[409px] ${
                useMobileTabbedMarket
                  ? "max-lg:hidden"
                  : "max-lg:h-[min(340px,44svh)] max-lg:shrink-0"
              }`}
            >
              <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col lg:h-full">
                {priceChart ?? (
                  <CollectionPriceHistoryPlaceholder className="h-full w-full min-h-0 max-lg:min-h-0 lg:h-full lg:min-h-0" />
                )}
              </div>
            </div>

            {orderBookToggleEnabled && !useMobileTabbedMarket ? (
              <div className="w-full min-w-0 shrink-0 lg:hidden">
                <CollectionOrderBookVisibilityToggle
                  checked={showOrderBook}
                  onChange={onShowOrderBookChange!}
                  variant="bar"
                />
              </div>
            ) : null}

            {orderBookColumnVisible ? (
              <div
                className={`flex min-h-0 w-full min-w-0 max-w-full flex-col items-stretch gap-2 self-stretch lg:col-start-2 lg:row-start-1 lg:w-[221px] lg:shrink-0 ${
                  useMobileTabbedMarket ? "max-lg:hidden" : ""
                }`}
              >
                {marketsRightStackTop ? (
                  <div className="min-h-0 w-full min-w-0 shrink-0 overflow-y-auto">
                    {marketsRightStackTop}
                  </div>
                ) : null}
                <div
                  className={`mx-auto w-full min-w-0 overflow-hidden ${COLLECTION_MARKETS_ORDER_BOOK_FRAME} max-lg:max-w-full lg:mx-0`}
                >
                  <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
                    {withFlushProp(orderBookNextToChart)}
                  </div>
                </div>
                {marketsDockTradePanel ? withFlushProp(tradePanel) : null}
              </div>
            ) : null}

            {marketsChartFooter != null ? (
              <div
                className={`min-w-0 shrink-0 max-lg:pt-1.5 pt-2.5 sm:pt-3 lg:row-start-2 ${
                  orderBookColumnVisible ? "lg:col-span-2" : ""
                }`}
              >
                {marketsChartFooter}
              </div>
            ) : null}
            {marketsBelowChart != null ? (
              <div
                className={[
                  "min-w-0 w-full max-w-full",
                  useMobileTabbedMarket ? "max-lg:hidden" : "",
                  orderBookColumnVisible ? "max-lg:mt-2 mt-1" : "max-lg:mt-1 mt-1",
                  "lg:col-start-1",
                  orderBookColumnVisible ? "lg:col-span-2" : "lg:col-span-1",
                  marketsChartFooter != null ? "lg:row-start-3" : "lg:row-start-2",
                ].join(" ")}
                id="collection-listings"
                aria-label="Individual listings"
              >
                {marketsBelowChart}
              </div>
            ) : null}
            {belowCover != null && !useMobileTabbedMarket ? (
              <div
                className={[
                  "min-w-0 w-full max-w-full max-lg:mt-4 max-lg:block lg:hidden",
                  orderBookColumnVisible ? "lg:col-span-2" : "lg:col-span-1",
                  "max-lg:row-start-auto",
                ].join(" ")}
                aria-label="Collection details"
              >
                {belowCover}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
