"use client";

import { COLLECTION_ORDER_BOOK_SCROLL_CLASS } from "@/components/marketplace/collectionOverviewChrome";
import {
  ORDER_BOOK_THREE_COL_GRID,
  orderBookColEndCls,
  orderBookColMidCls,
  orderBookColStartCls,
  orderBookColumnHeaderCls,
  orderBookTradesRowValueCls,
} from "@/components/marketplace/price-metrics-strip/theme";
import type { CollectionPlatformTapeFill } from "@/lib/core";
import {
  MAX_ORDER_BOOK_TAPE_ROWS,
  formatTapeTime,
} from "@/lib/marketplace/unified-order-book";

const TRADES_GRID_LEGACY =
  "grid-cols-[minmax(0,1fr)_44px_minmax(0,52px)_minmax(0,1fr)]";

function TradesColumnHeader({ flush, gridClass }: { flush?: boolean; gridClass: string }) {
  return (
    <div
      className={`${gridClass} shrink-0 px-2.5 py-1.5 sm:px-3 ${orderBookColumnHeaderCls}`}
    >
      <span className={orderBookColStartCls}>Price</span>
      <span className={orderBookColMidCls}>Side</span>
      {!flush ? <span className={orderBookColEndCls}>Token</span> : null}
      <span className={orderBookColEndCls}>Time</span>
    </div>
  );
}

export function OrderBookTradesTab({
  tapeFills,
  tapeLoading,
  flush,
}: {
  tapeFills: CollectionPlatformTapeFill[];
  tapeLoading?: boolean;
  flush?: boolean;
}) {
  const gridClass = flush ? ORDER_BOOK_THREE_COL_GRID : TRADES_GRID_LEGACY;
  const rootClass = flush
    ? "flex h-full min-h-0 flex-1 flex-col overflow-hidden"
    : "flex min-h-0 max-h-[min(420px,52vh)] flex-col";

  if (!tapeLoading && tapeFills.length === 0) {
    return (
      <div
        className={
          flush
            ? "flex h-full min-h-0 flex-1 items-center justify-center overflow-hidden"
            : "flex items-center justify-center py-10"
        }
      >
        <span className={`${orderBookTradesRowValueCls} text-zinc-500`}>N/A</span>
      </div>
    );
  }

  return (
    <div className={rootClass}>
      {flush ? <TradesColumnHeader flush gridClass={gridClass} /> : null}

      {tapeLoading ? (
        <div
          className={`flex min-h-0 flex-1 items-center justify-center px-3 ${orderBookTradesRowValueCls} text-zinc-500`}
        >
          Loading trades…
        </div>
      ) : (
        <>
          {!flush ? <TradesColumnHeader flush={flush} gridClass={gridClass} /> : null}
          <div
            className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-auto px-1 py-0.5 ${COLLECTION_ORDER_BOOK_SCROLL_CLASS}`}
          >
            {tapeFills.slice(0, MAX_ORDER_BOOK_TAPE_ROWS).map((row) => (
              <div
                key={row.orderHash}
                className={`${gridClass} items-center px-1.5 py-1 ${orderBookTradesRowValueCls} text-zinc-200`}
              >
                <span className={`min-w-0 truncate ${orderBookColStartCls} text-mint/95`}>
                  {row.priceUsdc.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span
                  className={`min-w-0 truncate ${orderBookColMidCls} ${
                    row.tapeAggressor === "sell" ? "text-rose-400/95" : "text-white"
                  }`}
                >
                  {row.tapeAggressor === "sell" ? "SELL" : "BUY"}
                </span>
                {!flush ? (
                  <span className={`${orderBookColEndCls} text-zinc-500`}>#{row.tokenId}</span>
                ) : null}
                <span
                  className={`min-w-0 truncate ${orderBookColEndCls} text-zinc-400`}
                  title={new Date(row.t * 1000).toISOString()}
                >
                  {formatTapeTime(row.t)}
                </span>
              </div>
            ))}
          </div>
          {tapeFills.length > MAX_ORDER_BOOK_TAPE_ROWS ? (
            <p className={`shrink-0 px-2.5 py-1 text-center ${orderBookColumnHeaderCls}`}>
              Showing last {MAX_ORDER_BOOK_TAPE_ROWS} of {tapeFills.length} fills
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
