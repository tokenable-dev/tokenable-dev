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
import { OrderBookEmptyPanel } from "./OrderBookEmptyPanel";

function OrderBookColumnHeader({ flush, collectionDetail }: { flush?: boolean; collectionDetail?: boolean }) {
  if (collectionDetail) {
    return (
      <div className="cd-ob-book-hdr shrink-0">
        <span>Price</span>
        <span className="cd-ob-book-hdr__r">Qty</span>
        <span className="cd-ob-book-hdr__r">Total</span>
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
  asksEmptyBidsLive,
  bidsEmptyAsksLive,
}: {
  bidCount: number;
  askCount: number;
  flush?: boolean;
  showSellHint?: boolean;
  collectionDetail?: boolean;
  asksEmptyBidsLive?: boolean;
  bidsEmptyAsksLive?: boolean;
}) {
  if (collectionDetail) {
    if (asksEmptyBidsLive) {
      return (
        <>
          <p className="cd-ob-book-hint">
            Bids are still live — sellers can accept any of these now.
          </p>
          <p className="cd-ob-book-hint cd-ob-book-hint--notify-note">
            Notify me = alert when this card is first listed for sale. One-time, then
            auto-off.
          </p>
        </>
      );
    }
    let hint = "Asks fill top-down, bids bottom-up — highest bid matches first.";
    if (bidsEmptyAsksLive) {
      hint =
        "Asks are still live — buy at any ask price above, or place a bid and wait.";
    }
    return <p className="cd-ob-book-hint">{hint}</p>;
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

function hasNoMarket(
  askLevels: OrderBookDepthLevel[],
  bidLevels: OrderBookDepthLevel[],
): boolean {
  return askLevels.length === 0 && bidLevels.length === 0;
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
  onPlaceBid,
  onListYours,
  listingAlertActive,
  listingAlertPending,
  onToggleListingAlert,
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
  onPlaceBid?: () => void;
  onListYours?: () => void;
  listingAlertActive?: boolean;
  listingAlertPending?: boolean;
  onToggleListingAlert?: () => void;
}) {
  const askScrollable = askLevels.length > 0;
  const bidScrollable = bidLevels.length > 0;
  const noMarket = hasNoMarket(askLevels, bidLevels);
  const asksEmptyBidsLive =
    collectionDetail && askLevels.length === 0 && bidLevels.length > 0;
  const bidsEmptyAsksLive =
    collectionDetail && bidLevels.length === 0 && askLevels.length > 0;

  if (noMarket && collectionDetail) {
    return (
      <div className="cd-ob-book cd-ob-book--empty-market">
        <OrderBookEmptyPanel
          variant="no_market"
          onPlaceBid={onPlaceBid}
          onListYours={onListYours}
        />
        <p className="cd-ob-book-hint cd-ob-book-hint--market-empty">
          Once a card is vaulted, it can be listed here instantly — no shipping needed.
        </p>
      </div>
    );
  }

  if (noMarket && !collectionDetail) {
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
            ? "cd-ob-book"
            : mobileEmbed
              ? "h-full"
              : "h-full flex-1"
        }`}
      >
        <OrderBookColumnHeader flush collectionDetail={collectionDetail} />
        {collectionDetail ? (
          <div className="cd-ob-book-stack">
            <div className="cd-ob-book-asks">
              {asksEmptyBidsLive ? (
                <OrderBookEmptyPanel
                  variant="no_asks"
                  onPlaceBid={onPlaceBid}
                  listingAlertActive={listingAlertActive}
                  listingAlertPending={listingAlertPending}
                  onToggleListingAlert={onToggleListingAlert}
                />
              ) : (
                <AskLevelsList
                  levels={askLevels}
                  selectedLevelKey={selectedLevelKey}
                  onSelectLevel={onSelectLevel}
                  flush
                  collectionDetail
                  wrapperClass="cd-ob-book-asks__list"
                />
              )}
            </div>
            <div className="cd-ob-book-center shrink-0">
              <OrderBookCenterStrip
                model={bookCenterModel}
                collectionDetail
                asksEmptyBidsLive={asksEmptyBidsLive}
                bidsEmptyAsksLive={bidsEmptyAsksLive}
                bestBidUsdc={bidLevels[0]?.price ?? null}
                bestAskUsdc={
                  askLevels.length > 0
                    ? Math.min(...askLevels.map((l) => l.price))
                    : null
                }
              />
            </div>
            <div className="cd-ob-book-bids">
              {bidsEmptyAsksLive ? (
                <OrderBookEmptyPanel
                  variant="no_bids"
                  onPlaceBid={onPlaceBid}
                />
              ) : (
                <BidLevelsList
                  levels={bidLevels}
                  selectedLevelKey={selectedLevelKey}
                  onSelectLevel={onSelectLevel}
                  flush
                  collectionDetail
                  wrapperClass="cd-ob-book-bids__list"
                />
              )}
            </div>
          </div>
        ) : (
          <>
            <div
              className={scrollPaneClass(askScrollable, true, flushDepthRows, mobileEmbed)}
            >
              <AskLevelsList
                levels={askLevels}
                selectedLevelKey={selectedLevelKey}
                onSelectLevel={onSelectLevel}
                flush
                wrapperClass={
                  askScrollable
                    ? `flex min-h-full flex-col justify-end gap-px pt-0.5 pb-1 ${COLLECTION_ORDER_BOOK_FLUSH_INSET_X}`
                    : `flex flex-col gap-px pt-0.5 pb-1 ${COLLECTION_ORDER_BOOK_FLUSH_INSET_X}`
                }
              />
            </div>
            <div className="relative mx-0.5 shrink-0">
              <OrderBookCenterStrip model={bookCenterModel} />
            </div>
            <div
              className={scrollPaneClass(bidScrollable, true, flushDepthRows, mobileEmbed)}
            >
              <BidLevelsList
                levels={bidLevels}
                selectedLevelKey={selectedLevelKey}
                onSelectLevel={onSelectLevel}
                flush
                wrapperClass={`flex flex-col gap-px pt-0.5 pb-1 ${COLLECTION_ORDER_BOOK_FLUSH_INSET_X}`}
              />
            </div>
          </>
        )}
        <OrderBookFooterCounts
          bidCount={bidCount}
          askCount={askCount}
          flush
          collectionDetail={collectionDetail}
          asksEmptyBidsLive={asksEmptyBidsLive}
          bidsEmptyAsksLive={bidsEmptyAsksLive}
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
