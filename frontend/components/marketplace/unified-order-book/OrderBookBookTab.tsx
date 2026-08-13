"use client";

import {
  COLLECTION_ORDER_BOOK_FLUSH_INSET_X,
  COLLECTION_ORDER_BOOK_SCROLL_CLASS,
} from "@/components/marketplace/collectionOverviewChrome";
import {
  ORDER_BOOK_THREE_COL_GRID,
  orderBookBookSizeColCls,
  orderBookColEndCls,
  orderBookColStartCls,
  orderBookColumnHeaderCls,
  orderBookRowValueCls,
} from "@/components/marketplace/price-metrics-strip/theme";
import {
  ORDER_BOOK_FLUSH_VISIBLE_DEPTH_ROWS,
  orderBookFlushDepthPaneHeightClass,
  type BookCenterModel,
  type OrderBookDepthLevel,
} from "@/lib/marketplace/unified-order-book";
import type { BookRowSelection } from "@/lib/marketplace/marketplaceTradingTypes";
import { OrderBookCenterStrip } from "./OrderBookCenterStrip";
import { OrderBookDepthLevelRow } from "./OrderBookDepthLevelRow";

function OrderBookColumnHeader({ flush, collectionDetail }: { flush?: boolean; collectionDetail?: boolean }) {
  if (collectionDetail) {
    return (
      <div className="cd-ob-book-hdr shrink-0">
        <span>Price</span>
        <span>Size</span>
        <span>Total</span>
      </div>
    );
  }

  if (flush) {
    return (
      <div
        className={`relative ${ORDER_BOOK_THREE_COL_GRID} shrink-0 border-b border-zinc-800/50 bg-zinc-950/50 py-1.5 ${COLLECTION_ORDER_BOOK_FLUSH_INSET_X} ${orderBookColumnHeaderCls}`}
      >
        <span className={orderBookColStartCls}>Price</span>
        <span className={orderBookBookSizeColCls}>Size</span>
        <span className={`${orderBookColEndCls} tabular-nums`}>Total</span>
      </div>
    );
  }

  return (
    <div
      className={`relative grid shrink-0 grid-cols-[1fr_44px] gap-1.5 px-2.5 py-1.5 sm:px-3 ${orderBookColumnHeaderCls}`}
    >
      <span>Price (USDC)</span>
      <span className="text-right tabular-nums">Count</span>
    </div>
  );
}

function OrderBookFooterCounts({
  bidCount,
  askCount,
  flush,
  showSellHint,
  collectionDetail,
}: {
  bidCount: number;
  askCount: number;
  flush?: boolean;
  showSellHint?: boolean;
  collectionDetail?: boolean;
}) {
  if (collectionDetail) {
    return (
      <div className="cd-ob-book-footer shrink-0">
        <span>
          Bids <span className="cd-ob-book-footer__bids">{bidCount}</span>
        </span>
        <span>
          Asks <span className="cd-ob-book-footer__asks">{askCount}</span>
        </span>
      </div>
    );
  }

  return (
    <div
      className={
        flush
          ? `shrink-0 space-y-1 py-1.5 ${COLLECTION_ORDER_BOOK_FLUSH_INSET_X}`
          : "space-y-1 px-2.5 py-1.5"
      }
    >
      <div className={`flex justify-between gap-2 ${orderBookColumnHeaderCls} tabular-nums`}>
        <span>
          Bids <span className="text-mint/80">{bidCount}</span>
        </span>
        <span>
          Asks <span className="text-rose-400/80">{askCount}</span>
        </span>
      </div>
      {showSellHint ? (
        <p className={`${orderBookColumnHeaderCls} leading-snug`}>
          Selling: use the <span className="text-zinc-400">Sell</span> tab or list from your asset;
          crossing bids fill automatically when you list at or below a collection bid.
        </p>
      ) : null}
    </div>
  );
}

function AskLevelsList({
  levels,
  selectedLevelKey,
  onSelectLevel,
  flush,
  wrapperClass,
  collectionDetail,
}: {
  levels: OrderBookDepthLevel[];
  selectedLevelKey?: string | null;
  onSelectLevel?: (selection: BookRowSelection) => void;
  flush?: boolean;
  wrapperClass: string;
  collectionDetail?: boolean;
}) {
  return (
    <div className={wrapperClass}>
      {levels.map((level) => (
        <OrderBookDepthLevelRow
          key={level.key}
          side="ask"
          level={level}
          selectedLevelKey={selectedLevelKey}
          onSelectLevel={onSelectLevel}
          flush={flush}
          collectionDetail={collectionDetail}
        />
      ))}
    </div>
  );
}

function BidLevelsList({
  levels,
  selectedLevelKey,
  onSelectLevel,
  flush,
  wrapperClass,
  collectionDetail,
}: {
  levels: OrderBookDepthLevel[];
  selectedLevelKey?: string | null;
  onSelectLevel?: (selection: BookRowSelection) => void;
  flush?: boolean;
  wrapperClass: string;
  collectionDetail?: boolean;
}) {
  return (
    <div className={wrapperClass}>
      {levels.map((level) => (
        <OrderBookDepthLevelRow
          key={level.key}
          side="bid"
          level={level}
          selectedLevelKey={selectedLevelKey}
          onSelectLevel={onSelectLevel}
          flush={flush}
          collectionDetail={collectionDetail}
        />
      ))}
    </div>
  );
}

function scrollPaneClass(
  scrollable: boolean,
  flush?: boolean,
  flushDepthRows = ORDER_BOOK_FLUSH_VISIBLE_DEPTH_ROWS,
  mobileEmbed?: boolean,
) {
  if (flush && (scrollable || mobileEmbed)) {
    return `min-h-0 shrink-0 overflow-y-auto overflow-x-hidden overscroll-y-auto ${COLLECTION_ORDER_BOOK_SCROLL_CLASS} ${orderBookFlushDepthPaneHeightClass(flushDepthRows)}`;
  }
  return scrollable
    ? `min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-auto ${COLLECTION_ORDER_BOOK_SCROLL_CLASS}`
    : "shrink-0 overflow-hidden";
}

function isOrderBookFullyEmpty(
  askLevels: OrderBookDepthLevel[],
  bidLevels: OrderBookDepthLevel[],
  bookCenterModel: BookCenterModel,
): boolean {
  return (
    askLevels.length === 0 &&
    bidLevels.length === 0 &&
    bookCenterModel.primary === "N/A"
  );
}

function OrderBookEmptyNaOnly({
  flush,
  mobileEmbed,
  collectionDetail,
}: {
  flush?: boolean;
  mobileEmbed?: boolean;
  collectionDetail?: boolean;
}) {
  return (
    <div
      className={
        flush
          ? `flex min-h-0 items-center justify-center overflow-hidden ${
              collectionDetail ? "cd-ob-book-empty" : mobileEmbed ? "h-full" : "h-full flex-1"
            }`
          : "flex items-center justify-center py-10"
      }
    >
      <span className={`${orderBookRowValueCls} text-zinc-500`}>N/A</span>
    </div>
  );
}

export function OrderBookBookTab({
  flush,
  compact,
  depthMax,
  flushDepthRows = ORDER_BOOK_FLUSH_VISIBLE_DEPTH_ROWS,
  mobileEmbed,
  askLevels,
  bidLevels,
  bookCenterModel,
  bidCount,
  askCount,
  selectedLevelKey,
  onSelectLevel,
  collectionDetail,
}: {
  flush?: boolean;
  compact?: boolean;
  depthMax: string;
  flushDepthRows?: number;
  mobileEmbed?: boolean;
  askLevels: OrderBookDepthLevel[];
  bidLevels: OrderBookDepthLevel[];
  bookCenterModel: BookCenterModel;
  bidCount: number;
  askCount: number;
  selectedLevelKey?: string | null;
  onSelectLevel?: (selection: BookRowSelection) => void;
  collectionDetail?: boolean;
}) {
  const askScrollable = askLevels.length > 0;
  const bidScrollable = bidLevels.length > 0;
  const fullyEmpty = isOrderBookFullyEmpty(askLevels, bidLevels, bookCenterModel);

  if (fullyEmpty) {
    return (
      <OrderBookEmptyNaOnly
        flush={flush}
        mobileEmbed={mobileEmbed}
        collectionDetail={collectionDetail}
      />
    );
  }

  if (flush) {
    return (
      <div
        className={`flex min-h-0 flex-col overflow-hidden ${
          collectionDetail
            ? "cd-ob-book h-full"
            : mobileEmbed
              ? "h-full"
              : "h-full flex-1"
        }`}
      >
        <OrderBookColumnHeader flush collectionDetail={collectionDetail} />
        <div
          className={
            collectionDetail
              ? "cd-ob-book__scroll min-h-0 flex-1"
              : "contents"
          }
        >
          <div
            className={
              collectionDetail
                ? "cd-ob-book-asks min-h-0"
                : scrollPaneClass(askScrollable, true, flushDepthRows, mobileEmbed)
            }
          >
            <AskLevelsList
              levels={askLevels}
              selectedLevelKey={selectedLevelKey}
              onSelectLevel={onSelectLevel}
              flush
              collectionDetail={collectionDetail}
              wrapperClass={
                collectionDetail
                  ? "cd-ob-book-asks__list"
                  : askScrollable
                    ? `flex min-h-full flex-col justify-end gap-px pt-0.5 pb-1 ${COLLECTION_ORDER_BOOK_FLUSH_INSET_X}`
                    : `flex flex-col gap-px pt-0.5 pb-1 ${COLLECTION_ORDER_BOOK_FLUSH_INSET_X}`
              }
            />
          </div>
          <div
            className={
              collectionDetail ? "cd-ob-book-center shrink-0" : "relative mx-0.5 shrink-0"
            }
          >
            <OrderBookCenterStrip model={bookCenterModel} collectionDetail={collectionDetail} />
          </div>
          <div
            className={
              collectionDetail
                ? "cd-ob-book-bids min-h-0"
                : scrollPaneClass(bidScrollable, true, flushDepthRows, mobileEmbed)
            }
          >
            <BidLevelsList
              levels={bidLevels}
              selectedLevelKey={selectedLevelKey}
              onSelectLevel={onSelectLevel}
              flush
              collectionDetail={collectionDetail}
              wrapperClass={
                collectionDetail
                  ? "cd-ob-book-bids__list"
                  : `flex flex-col gap-px pt-0.5 pb-1 ${COLLECTION_ORDER_BOOK_FLUSH_INSET_X}`
              }
            />
          </div>
        </div>
        <OrderBookFooterCounts
          bidCount={bidCount}
          askCount={askCount}
          flush
          collectionDetail={collectionDetail}
        />
      </div>
    );
  }

  return (
    <>
      <OrderBookColumnHeader />
      <AskLevelsList
        levels={askLevels}
        selectedLevelKey={selectedLevelKey}
        onSelectLevel={onSelectLevel}
        wrapperClass={`min-h-[36px] flex flex-col justify-end gap-px px-1 pt-0.5 ${
          askScrollable
            ? `overflow-y-auto ${COLLECTION_ORDER_BOOK_SCROLL_CLASS} ${depthMax}`
            : ""
        }`}
      />
      <div className="relative mx-0.5 my-0.5">
        <OrderBookCenterStrip model={bookCenterModel} />
      </div>
      <BidLevelsList
        levels={bidLevels}
        selectedLevelKey={selectedLevelKey}
        onSelectLevel={onSelectLevel}
        wrapperClass={`flex flex-col gap-px px-1 pb-1.5 ${
          bidScrollable
            ? `overflow-y-auto ${COLLECTION_ORDER_BOOK_SCROLL_CLASS} ${depthMax}`
            : ""
        }`}
      />
      <OrderBookFooterCounts
        bidCount={bidCount}
        askCount={askCount}
        showSellHint={bidCount > 0 && !compact}
      />
    </>
  );
}
