"use client";

import type { ReactNode } from "react";
import { CollectionPriceHistoryPlaceholder } from "@/components/marketplace/markets-ui";
import { CollectionOrderBookVisibilityToggle } from "@/components/marketplace/markets-ui";
import {
  COLLECTION_MARKETS_ORDER_BOOK_FRAME,
  COLLECTION_MARKET_CLUSTER_BEZEL,
  COLLECTION_MARKET_CLUSTER_MAT,
  COLLECTION_MARKETS_CHART_HEIGHT_CLASS,
  COLLECTION_MARKETS_CHART_HEIGHT_MOBILE_CLASS,
  COLLECTION_MARKETS_CLUSTER_GRID_COLS_CLASS,
  COLLECTION_MARKETS_ORDER_BOOK_COLUMN_WIDTH_CLASS,
} from "@/components/marketplace/collectionOverviewChrome";
import { withFlushProp } from "../utils/withFlushProp";

export function CollectionOverviewMarketsCluster({
  orderBookToggleEnabled,
  showOrderBook,
  onShowOrderBookChange,
  orderBookColumnVisible,
  useMobileTabbedMarket,
  chartMetricsRow,
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
  orderBookColumnVisible: boolean;
  useMobileTabbedMarket: boolean;
  /** Desktop: metrics row above chart; order book height matches metrics + chart. */
  chartMetricsRow?: ReactNode;
  priceChart?: ReactNode;
  orderBookNextToChart: ReactNode;
  marketsRightStackTop?: ReactNode;
  marketsDockTradePanel: boolean;
  tradePanel?: ReactNode;
  marketsChartFooter?: ReactNode;
  marketsBelowChart?: ReactNode;
  belowCover?: ReactNode;
}) {
  const orderBookDesktopPinned = orderBookToggleEnabled;
  const orderBookSideColumn = orderBookDesktopPinned || orderBookColumnVisible;
  const hideOrderBookOnMobile = orderBookToggleEnabled && !showOrderBook;
  const hasDesktopMetrics = chartMetricsRow != null;
  const chartGridRow = hasDesktopMetrics ? 2 : 1;
  let nextGridRow = chartGridRow + 1;
  const footerGridRow = marketsChartFooter != null ? nextGridRow++ : null;
  const listingsGridRow = marketsBelowChart != null ? nextGridRow++ : null;
  const tradeGridRow =
    marketsDockTradePanel && listingsGridRow != null
      ? listingsGridRow + 1
      : listingsGridRow ?? footerGridRow ?? chartGridRow + 1;
  const tradeGridRowClass =
    tradeGridRow === 2
      ? "lg:row-start-2"
      : tradeGridRow === 3
        ? "lg:row-start-3"
        : tradeGridRow === 4
          ? "lg:row-start-4"
          : tradeGridRow === 5
            ? "lg:row-start-5"
            : "lg:row-start-2";

  return (
    <div className="relative w-full min-w-0 max-w-full">
      <div className={`${COLLECTION_MARKET_CLUSTER_BEZEL} w-full min-w-0 max-w-full lg:pt-0`}>
        <div className={`${COLLECTION_MARKET_CLUSTER_MAT} w-full min-w-0 lg:pt-0`}>
          <div
            className={[
              "flex min-w-0 w-full max-w-full flex-col gap-3 max-lg:gap-2 max-lg:items-stretch",
              "lg:grid lg:min-h-0 lg:items-stretch lg:gap-x-1 lg:gap-y-3",
              orderBookSideColumn
                ? COLLECTION_MARKETS_CLUSTER_GRID_COLS_CLASS
                : "lg:grid-cols-[minmax(0,1fr)]",
            ].join(" ")}
          >
            {hasDesktopMetrics ? (
              <div className="hidden min-w-0 shrink-0 lg:col-start-1 lg:row-start-1 lg:block">
                {chartMetricsRow}
              </div>
            ) : null}

            <div
              className={`flex min-h-0 min-w-0 flex-col lg:col-start-1 ${COLLECTION_MARKETS_CHART_HEIGHT_CLASS} ${
                hasDesktopMetrics ? "lg:row-start-2" : "lg:row-start-1"
              } ${
                useMobileTabbedMarket
                  ? "max-lg:hidden"
                  : COLLECTION_MARKETS_CHART_HEIGHT_MOBILE_CLASS
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

            {orderBookSideColumn ? (
              <div
                className={`flex min-h-0 w-full min-w-0 max-w-full flex-col items-stretch gap-2 self-stretch ${
                  hideOrderBookOnMobile || useMobileTabbedMarket ? "max-lg:hidden" : ""
                } lg:contents`}
              >
                <div
                  className={`flex min-h-0 w-full min-w-0 max-w-full flex-col items-stretch self-stretch lg:col-start-2 lg:self-stretch ${COLLECTION_MARKETS_ORDER_BOOK_COLUMN_WIDTH_CLASS} ${
                    hasDesktopMetrics ? "lg:[grid-row:1/3]" : "lg:[grid-row:1/2]"
                  }`}
                >
                  {marketsRightStackTop ? (
                    <div className="min-h-0 w-full min-w-0 shrink-0 overflow-y-auto lg:hidden">
                      {marketsRightStackTop}
                    </div>
                  ) : null}
                  <div
                    className={`mx-auto flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden ${COLLECTION_MARKETS_ORDER_BOOK_FRAME} max-lg:max-w-full lg:mx-0 lg:h-full`}
                  >
                    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
                      {withFlushProp(orderBookNextToChart)}
                    </div>
                  </div>
                  {marketsDockTradePanel ? (
                    <div className="shrink-0 lg:hidden">{withFlushProp(tradePanel)}</div>
                  ) : null}
                </div>
                {marketsDockTradePanel ? (
                  <div
                    className={`hidden min-w-0 shrink-0 lg:col-start-2 lg:block ${COLLECTION_MARKETS_ORDER_BOOK_COLUMN_WIDTH_CLASS} ${tradeGridRowClass}`}
                  >
                    {withFlushProp(tradePanel)}
                  </div>
                ) : null}
              </div>
            ) : null}

            {marketsChartFooter != null ? (
              <div
                className={`min-w-0 shrink-0 max-lg:pt-1.5 pt-2.5 sm:pt-3 lg:col-start-1 lg:col-span-1 ${
                  footerGridRow === 2
                    ? "lg:row-start-2"
                    : footerGridRow === 3
                      ? "lg:row-start-3"
                      : "lg:row-start-4"
                }`}
              >
                {marketsChartFooter}
              </div>
            ) : null}
            {marketsBelowChart != null ? (
              <div
                className={[
                  "min-w-0 w-full max-w-full self-stretch",
                  useMobileTabbedMarket ? "max-lg:hidden" : "",
                  orderBookSideColumn ? "lg:mt-2 max-lg:mt-2 mt-1" : "lg:mt-2 max-lg:mt-1 mt-1",
                  orderBookSideColumn ? "lg:col-span-2 lg:col-start-1" : "lg:col-span-1 lg:col-start-1",
                  listingsGridRow === 2
                    ? "lg:row-start-2"
                    : listingsGridRow === 3
                      ? "lg:row-start-3"
                      : listingsGridRow === 4
                        ? "lg:row-start-4"
                        : listingsGridRow === 5
                          ? "lg:row-start-5"
                          : "lg:row-start-3",
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
                  orderBookSideColumn ? "lg:col-span-1 lg:col-start-1" : "lg:col-span-1",
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
