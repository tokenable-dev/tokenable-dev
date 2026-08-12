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
  collectionDetail,
}: {
  flush?: boolean;
  gridClass: string;
  collectionDetail?: boolean;
}) {
  if (collectionDetail) {
    return (
      <div className="cd-ob-trades-hdr shrink-0">
        <span>Price</span>
        <span>Side</span>
        <span>Source</span>
        <span>Time</span>
      </div>
    );
  }

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
  tapeError,
  tapeErrorMessage,
  flush,
  mobileEmbed,
  collectionDetail,
  emptyLabel = "N/A",
}: {
  tapeFills: CollectionPlatformTapeFill[];
  tapeLoading?: boolean;
  tapeError?: boolean;
  tapeErrorMessage?: string | null;
  flush?: boolean;
  mobileEmbed?: boolean;
  collectionDetail?: boolean;
  emptyLabel?: string;
}) {
  const gridClass = flush ? ORDER_BOOK_TRADES_FOUR_COL_GRID : TRADES_GRID_LEGACY;
  const rowValueCls = orderBookTradesContentValueCls;
  const rootClass = flush
    ? "flex h-full min-h-0 flex-1 flex-col overflow-hidden"
    : "flex min-h-0 max-h-[min(420px,52vh)] flex-col";

  const showHeader = Boolean(flush) || (!tapeLoading && tapeFills.length > 0);
  const bodyClass = collectionDetail
    ? "cd-ob-trades-scroll flex min-h-0 flex-1 flex-col"
    : "flex min-h-0 flex-1 flex-col";

  if (tapeError) {
    return (
      <div className={rootClass}>
        {flush ? (
          <TradesColumnHeader
            flush
            gridClass={gridClass}
            collectionDetail={collectionDetail}
          />
        ) : null}
        <div
          className={
            flush
              ? `flex min-h-[8rem] flex-1 flex-col items-center justify-center px-4 text-center${
                  collectionDetail ? " cd-ob-trades-empty" : ""
                }`
              : "flex min-h-[12rem] flex-1 items-center justify-center px-4 text-center"
          }
        >
          <span className={`${rowValueCls} text-rose-400/90`}>
            {tapeErrorMessage?.trim() || "Failed to load trades"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={rootClass}>
      {showHeader ? (
        <TradesColumnHeader
          flush={flush}
          gridClass={gridClass}
          collectionDetail={collectionDetail}
        />
      ) : null}

      {tapeLoading && tapeFills.length === 0 ? (
        <div
          className={`${bodyClass} items-center justify-center px-3 ${rowValueCls} text-zinc-500${
            collectionDetail ? " cd-ob-trades-empty" : ""
          }`}
        >
          Loading trades…
        </div>
      ) : tapeFills.length === 0 ? (
        <div
          className={
            flush
              ? `${bodyClass} items-center justify-center overflow-hidden${
                  collectionDetail ? " cd-ob-trades-empty" : ""
                }`
              : "flex min-h-[12rem] flex-1 items-center justify-center"
          }
        >
          <span className={`${rowValueCls} text-zinc-500`}>{emptyLabel}</span>
        </div>
      ) : (
        <TradesTapeScrollList
          tapeFills={tapeFills}
          flush={Boolean(flush)}
          collectionDetail={collectionDetail}
          insetXClass={
            flush && !collectionDetail ? COLLECTION_ORDER_BOOK_FLUSH_INSET_X : ""
          }
          scrollClass={COLLECTION_ORDER_BOOK_SCROLL_CLASS}
          maxHeightClass={
            collectionDetail
              ? "cd-ob-trades-scroll"
              : flush
                ? TRADES_TAPE_SCROLL_HEIGHT_CLASS
                : undefined
          }
        />
      )}
    </div>
  );
}
