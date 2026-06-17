"use client";

import type { ReactNode } from "react";
import {
  COLLECTION_MARKET_CLUSTER_BEZEL,
  COLLECTION_MARKET_CLUSTER_MAT,
  COLLECTION_MARKETS_CHART_COMPACT_HEIGHT_CLASS,
  COLLECTION_MARKETS_ORDER_BOOK_COMPACT_FRAME,
  COLLECTION_MARKETS_ORDER_BOOK_COMPACT_WIDTH_CLASS,
} from "@/components/marketplace/collectionOverviewChrome";
import { withFlushProp } from "../utils/withFlushProp";

/**
 * Collection detail desktop — metrics | trades (same row), chart | trades (continued),
 * then listings | details without overlapping grid spans.
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
  const chartRowStart = hasMetrics ? 2 : 1;
  const listingsRowStart = hasMetrics ? 3 : 2;
  const orderBookRowSpanClass = hasMetrics ? "lg:[grid-row:1/3]" : "lg:row-start-1";

  return (
    <div className="relative hidden w-full min-w-0 max-w-full lg:block">
      <div className={`${COLLECTION_MARKET_CLUSTER_BEZEL} w-full min-w-0 max-w-full`}>
        <div className={`${COLLECTION_MARKET_CLUSTER_MAT} w-full min-w-0`}>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_300px] items-stretch gap-x-4 gap-y-3">
            {hasMetrics ? (
              <div className="min-w-0 self-stretch lg:col-start-1 lg:row-start-1">
                {chartMetricsRow}
              </div>
            ) : null}

            <div
              className={`min-h-0 min-w-0 overflow-hidden lg:col-start-1 ${COLLECTION_MARKETS_CHART_COMPACT_HEIGHT_CLASS} ${
                chartRowStart === 2 ? "lg:row-start-2" : "lg:row-start-1"
              }`}
            >
              <div className="flex h-full min-h-0 w-full flex-col [&>*]:min-h-0 [&>*]:flex-1">
                {priceChart}
              </div>
            </div>

            <div
              className={`flex min-h-0 flex-col self-stretch overflow-hidden lg:col-start-2 ${COLLECTION_MARKETS_ORDER_BOOK_COMPACT_WIDTH_CLASS} ${COLLECTION_MARKETS_ORDER_BOOK_COMPACT_FRAME} ${orderBookRowSpanClass}`}
            >
              <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
                {withFlushProp(orderBookNextToChart)}
              </div>
            </div>

            {marketsBelowChart != null ? (
              <div
                className={`min-w-0 self-start border-t border-zinc-800/30 lg:col-start-1 lg:pt-8 ${
                  listingsRowStart === 3 ? "lg:row-start-3" : "lg:row-start-2"
                }`}
                id="collection-listings"
                aria-label="Individual listings"
              >
                {marketsBelowChart}
              </div>
            ) : (
              <div className="lg:col-start-1" aria-hidden />
            )}

            {belowCover != null ? (
              <div
                className={`flex min-w-0 flex-col gap-3 self-start border-t border-zinc-800/35 pt-5 lg:col-start-2 lg:pt-8 ${COLLECTION_MARKETS_ORDER_BOOK_COMPACT_WIDTH_CLASS} ${
                  listingsRowStart === 3 ? "lg:row-start-3" : "lg:row-start-2"
                }`}
                aria-label="Collection details"
              >
                {belowCover}
                {marketsDockTradePanel ? (
                  <div className="min-w-0 shrink-0">{withFlushProp(tradePanel)}</div>
                ) : null}
              </div>
            ) : marketsDockTradePanel ? (
              <div
                className={`min-w-0 self-start lg:col-start-2 ${COLLECTION_MARKETS_ORDER_BOOK_COMPACT_WIDTH_CLASS} ${
                  listingsRowStart === 3 ? "lg:row-start-3" : "lg:row-start-2"
                }`}
              >
                {withFlushProp(tradePanel)}
              </div>
            ) : (
              <div className="lg:col-start-2" aria-hidden />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
