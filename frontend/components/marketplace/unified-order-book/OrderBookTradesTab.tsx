"use client";

import { COLLECTION_ORDER_BOOK_SCROLL_CLASS } from "@/components/marketplace/collectionOverviewChrome";
import {
  orderBookColEndCls,
  orderBookColMidCls,
  orderBookColStartCls,
  orderBookColumnHeaderCls,
  orderBookTradesRowValueCls,
} from "@/components/marketplace/price-metrics-strip/theme";
import type { CollectionPlatformTapeFill } from "@/lib/core";
import {
  formatTapeDate,
  formatTapeTimeFull,
  tapeSideDisplay,
} from "@/lib/marketplace/unified-order-book";

const TRADES_GRID_LEGACY =
  "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,2.5rem)_minmax(4.75rem,5.5rem)] gap-x-2";
const TRADES_FLUSH_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto_minmax(4.75rem,5.5rem)] gap-x-3 sm:gap-x-4";

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
  mobileEmbed,
}: {
  tapeFills: CollectionPlatformTapeFill[];
  tapeLoading?: boolean;
  flush?: boolean;
  mobileEmbed?: boolean;
}) {
  const gridClass = flush ? TRADES_FLUSH_GRID : TRADES_GRID_LEGACY;
  const rootClass = flush
    ? `flex min-h-0 flex-col overflow-hidden ${mobileEmbed ? "h-full" : "h-full flex-1"}`
    : "flex min-h-0 max-h-[min(420px,52vh)] flex-col";

  if (!tapeLoading && tapeFills.length === 0) {
    return (
      <div
        className={
          flush
            ? `flex min-h-0 items-center justify-center overflow-hidden ${
                mobileEmbed ? "h-full" : "h-full flex-1"
              }`
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
            {tapeFills.map((row) => {
              const side = tapeSideDisplay(row);
              return (
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
                  className={`min-w-0 truncate ${orderBookColMidCls} ${side.className}`}
                  title={side.title}
                >
                  {side.label}
                </span>
                {!flush ? (
                  <span className={`${orderBookColEndCls} text-zinc-500`}>#{row.tokenId}</span>
                ) : null}
                <span
                  className={`min-w-0 truncate tabular-nums ${orderBookColEndCls} text-zinc-400`}
                  title={formatTapeTimeFull(row.t)}
                >
                  {formatTapeDate(row.t)}
                </span>
              </div>
            );
            })}
          </div>
        </>
      )}
    </div>
  );
}
