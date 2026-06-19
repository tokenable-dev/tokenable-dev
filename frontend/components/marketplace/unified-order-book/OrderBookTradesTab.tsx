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
  orderBookTradesPriceHeaderColCls,
  orderBookTradesSideColCls,
  orderBookTradesSourceHeaderColCls,
  orderBookTradesTimeHeaderColCls,
} from "@/components/marketplace/price-metrics-strip/theme";
import type { CollectionPlatformTapeFill } from "@/lib/core";
import {
  TRADES_TAPE_FLUSH_HEADER_CLASS,
  TRADES_TAPE_SCROLL_HEIGHT_CLASS,
} from "@/lib/marketplace/unified-order-book/tradesTapeTableChrome";
import { TradesTapeScrollList } from "./TradesTapeScrollList";

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
        className={`${ORDER_BOOK_TRADES_FOUR_COL_GRID} shrink-0 bg-zinc-950/50 py-1 ${COLLECTION_ORDER_BOOK_FLUSH_INSET_X} ${orderBookTradesFlushHeaderCls} ${TRADES_TAPE_FLUSH_HEADER_CLASS}`}
      >
        <span className={orderBookTradesPriceHeaderColCls}>Price</span>
        <span className={orderBookTradesSideColCls}>Side</span>
        <span className={orderBookTradesSourceHeaderColCls}>Source</span>
        <span className={orderBookTradesTimeHeaderColCls}>Time</span>
      </div>
    );
  }

  return (
    <div
      className={`${gridClass} shrink-0 px-2.5 py-1.5 sm:px-3 ${headerCls}`}
    >
      <span className={orderBookTradesPriceHeaderColCls}>Price</span>
      <span className={orderBookColMidCls}>Side</span>
      <span className={orderBookTradesSourceHeaderColCls}>Source</span>
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
  const rowValueCls = orderBookTradesContentValueCls;
  const rootClass = flush
    ? "flex h-full min-h-0 flex-1 flex-col overflow-hidden"
    : "flex min-h-0 max-h-[min(420px,52vh)] flex-col";

  if (!tapeLoading && tapeFills.length === 0) {
    return (
      <div
        className={
          flush
            ? "flex h-full min-h-0 flex-1 flex-col items-center justify-center overflow-hidden"
            : "flex min-h-[12rem] flex-1 items-center justify-center"
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
          <TradesTapeScrollList
            tapeFills={tapeFills}
            flush={Boolean(flush)}
            insetXClass={flush ? COLLECTION_ORDER_BOOK_FLUSH_INSET_X : "py-0.5"}
            scrollClass={COLLECTION_ORDER_BOOK_SCROLL_CLASS}
            maxHeightClass={flush ? TRADES_TAPE_SCROLL_HEIGHT_CLASS : undefined}
          />
        </>
      )}
    </div>
  );
}
