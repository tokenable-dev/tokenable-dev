"use client";

import {
  COLLECTION_ORDER_BOOK_FLUSH_INSET_X,
  COLLECTION_ORDER_BOOK_SCROLL_CLASS,
} from "@/components/marketplace/collectionOverviewChrome";
import {
  ORDER_BOOK_TRADES_FOUR_COL_GRID,
  orderBookColEndCls,
  orderBookColMidCls,
  orderBookColumnHeaderCls,
  orderBookTradesFlushHeaderCls,
  orderBookTradesContentValueCls,
  orderBookTradesPriceColCls,
  orderBookTradesSideColCls,
  orderBookTradesSourceColCls,
  orderBookTradesTimeColCls,
  orderBookTradesTimeHeaderColCls,
} from "@/components/marketplace/price-metrics-strip/theme";
import type { CollectionPlatformTapeFill } from "@/lib/core";
import {
  formatTapeDate,
  formatTapeTimeFull,
  formatTradesTapePriceUsdc,
  tapeSideDisplay,
  tapeSourceDisplay,
} from "@/lib/marketplace/unified-order-book";
import { TradeSourceMark } from "./TradeSourceMark";

const TRADES_GRID_LEGACY =
  "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,3.25rem)_minmax(0,2.5rem)_minmax(4.75rem,5.5rem)] gap-x-2";

function TradesColumnHeader({
  flush,
  gridClass,
}: {
  flush?: boolean;
  gridClass: string;
}) {
  const headerCls = flush ? orderBookTradesFlushHeaderCls : orderBookColumnHeaderCls;

  if (flush) {
    return (
      <div
        className={`${ORDER_BOOK_TRADES_FOUR_COL_GRID} shrink-0 border-b border-zinc-800/50 bg-zinc-950/50 py-1 ${COLLECTION_ORDER_BOOK_FLUSH_INSET_X} ${headerCls}`}
      >
        <span className={orderBookTradesPriceColCls}>Price</span>
        <span className={orderBookTradesSideColCls}>Side</span>
        <span className={orderBookTradesSourceColCls}>Source</span>
        <span className={orderBookTradesTimeHeaderColCls}>Time</span>
      </div>
    );
  }

  return (
    <div
      className={`${gridClass} shrink-0 px-2.5 py-1.5 sm:px-3 ${headerCls}`}
    >
      <span className={orderBookTradesPriceColCls}>Price</span>
      <span className={orderBookColMidCls}>Side</span>
      <span className={orderBookTradesSourceColCls}>Source</span>
      <span className={orderBookColEndCls}>Token</span>
      <span className={orderBookTradesTimeHeaderColCls}>Time</span>
    </div>
  );
}

export function OrderBookTradesTab({
  tapeFills,
  tapeLoading,
  flush,
  mobileEmbed,
  emptyLabel = "N/A",
}: {
  tapeFills: CollectionPlatformTapeFill[];
  tapeLoading?: boolean;
  flush?: boolean;
  mobileEmbed?: boolean;
  emptyLabel?: string;
}) {
  const gridClass = flush ? ORDER_BOOK_TRADES_FOUR_COL_GRID : TRADES_GRID_LEGACY;
  const rowGridClass = flush
    ? `${ORDER_BOOK_TRADES_FOUR_COL_GRID} items-center`
    : `${gridClass} items-center`;
  const rowValueCls = orderBookTradesContentValueCls;
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
        <span className={`${rowValueCls} text-zinc-500`}>{emptyLabel}</span>
      </div>
    );
  }

  return (
    <div className={rootClass}>
      {flush ? <TradesColumnHeader flush gridClass={gridClass} /> : null}

      {tapeLoading ? (
        <div
          className={`flex min-h-0 flex-1 items-center justify-center px-3 ${rowValueCls} text-zinc-500`}
        >
          Loading trades…
        </div>
      ) : (
        <>
          {!flush ? <TradesColumnHeader flush={flush} gridClass={gridClass} /> : null}
          <div
            className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-auto py-0.5 ${COLLECTION_ORDER_BOOK_FLUSH_INSET_X} ${COLLECTION_ORDER_BOOK_SCROLL_CLASS}`}
          >
            {tapeFills.map((row) => {
              const side = tapeSideDisplay(row);
              const source = tapeSourceDisplay(row);

              return (
                <div
                  key={row.orderHash}
                  className={`${rowGridClass} py-0.5 ${rowValueCls} text-zinc-200`}
                >
                  <span
                    className={`min-w-0 truncate ${orderBookTradesPriceColCls} text-mint/95`}
                  >
                    {formatTradesTapePriceUsdc(row.priceUsdc)}
                  </span>
                  {flush ? (
                    <>
                      <span
                        className={`min-w-0 truncate ${orderBookTradesSideColCls} ${side.className}`}
                        title={side.title}
                      >
                        {side.label}
                      </span>
                      <TradeSourceMark
                        source={source}
                        className={orderBookTradesSourceColCls}
                      />
                      <span
                        className={`min-w-0 truncate ${orderBookTradesTimeColCls} text-zinc-400`}
                        title={formatTapeTimeFull(row.t)}
                      >
                        {formatTapeDate(row.t)}
                      </span>
                    </>
                  ) : (
                    <>
                      <span
                        className={`min-w-0 truncate ${orderBookColMidCls} ${side.className}`}
                        title={side.title}
                      >
                        {side.label}
                      </span>
                      <TradeSourceMark
                        source={source}
                        className={orderBookTradesSourceColCls}
                      />
                      <span className={`${orderBookColEndCls} text-zinc-500`}>
                        #{row.tokenId}
                      </span>
                      <span
                        className={`min-w-0 truncate ${orderBookTradesTimeColCls} text-zinc-400`}
                        title={formatTapeTimeFull(row.t)}
                      >
                        {formatTapeDate(row.t)}
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
