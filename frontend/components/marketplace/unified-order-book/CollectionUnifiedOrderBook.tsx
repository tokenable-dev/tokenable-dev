"use client";

import { useMemo } from "react";
import {
  COLLECTION_DETAILS_BG_CLASS,
  COLLECTION_DETAILS_BORDER_ALL,
} from "@/components/marketplace/collectionOverviewChrome";
import type { CollectionUnifiedOrderBookProps } from "@/lib/marketplace/marketplaceTradingTypes";
import {
  ORDER_BOOK_FLUSH_MOBILE_VISIBLE_DEPTH_ROWS,
  ORDER_BOOK_MOBILE_EMBED_TAB_BODY_HEIGHT_CLASS,
  applyOrderBookNotionalDepth,
} from "@/lib/marketplace/unified-order-book";
import { useUnifiedOrderBook } from "@/hooks/unified-order-book";
import { OrderBookBookTab } from "./OrderBookBookTab";
import { OrderBookTabHeader } from "./OrderBookTabHeader";
import { OrderBookTradesTab } from "./OrderBookTradesTab";

export function CollectionUnifiedOrderBook({
  collectionKey,
  asks,
  collectionBids,
  onSelectLevel,
  selectedLevelKey,
  compact = false,
  flush = false,
  embedInMobileTab = false,
  lastTradePriceUsdc = null,
  lastTradeSide = null,
  tapeFills = [],
  tapeLoading = false,
  tapeError = false,
  tapeErrorMessage = null,
  defaultTab = "book",
  onPlaceBid,
  onListYours,
  listingAlertActive,
  listingAlertPending,
  onToggleListingAlert,
}: CollectionUnifiedOrderBookProps) {
  const book = useUnifiedOrderBook({
    asks,
    collectionBids,
    lastTradePriceUsdc,
    lastTradeSide,
    compact,
    flush,
    defaultTab,
  });

  const mobileFlushDepth =
    embedInMobileTab && flush ? ORDER_BOOK_FLUSH_MOBILE_VISIBLE_DEPTH_ROWS : undefined;
  const displayAskLevels =
    mobileFlushDepth != null
      ? book.askLevels.slice(-mobileFlushDepth)
      : book.askLevels;
  const displayBidLevels =
    mobileFlushDepth != null
      ? book.bidLevels.slice(0, mobileFlushDepth)
      : book.bidLevels;

  const mobileEmbed = embedInMobileTab && flush;
  const collectionDetail = flush && compact;

  const collectionDetailLevels = useMemo(() => {
    if (!collectionDetail) {
      return { askLevels: displayAskLevels, bidLevels: displayBidLevels };
    }
    return applyOrderBookNotionalDepth(displayAskLevels, displayBidLevels);
  }, [collectionDetail, displayAskLevels, displayBidLevels]);

  const bookTabProps = {
    flush,
    compact,
    depthMax: book.depthMax,
    flushDepthRows: mobileFlushDepth,
    mobileEmbed,
    askLevels: collectionDetailLevels.askLevels,
    bidLevels: collectionDetailLevels.bidLevels,
    bookCenterModel: book.bookCenterModel,
    bidCount: book.bidRows.length,
    askCount: book.askRows.length,
    selectedLevelKey,
    onSelectLevel,
    collectionDetail,
    onPlaceBid,
    onListYours,
    listingAlertActive,
    listingAlertPending,
    onToggleListingAlert,
  };

  const shell = flush
    ? embedInMobileTab
      ? "@container/orderbook relative flex min-h-0 w-full min-w-0 shrink-0 flex-col overflow-hidden rounded-none border-0 bg-transparent shadow-none"
      : collectionDetail
        ? "@container/orderbook cd-ob-panel relative flex w-full max-w-full flex-col overflow-hidden rounded-none border-0 bg-transparent shadow-none"
        : "@container/orderbook relative flex h-full max-h-full min-h-0 w-full max-w-full flex-col overflow-hidden rounded-none border-0 bg-transparent shadow-none"
    : `relative overflow-hidden ${COLLECTION_DETAILS_BORDER_ALL} ${COLLECTION_DETAILS_BG_CLASS} ${
        compact
          ? "rounded-xl shadow-none"
          : "rounded-2xl shadow-[0_16px_48px_-20px_rgba(0,0,0,0.75)]"
      }`;

  return (
    <div className={shell} aria-label={`OrderBook ${collectionKey}`}>
      {!compact && !flush && (
        <div
          className="pointer-events-none absolute -right-8 -top-12 h-40 w-52 rounded-full bg-zinc-600/[0.14] blur-3xl"
          aria-hidden
        />
      )}
      <OrderBookTabHeader
        tab={book.tab}
        setTab={book.setTab}
        flush={flush}
        collectionDetail={collectionDetail}
      />

      {flush && !embedInMobileTab && collectionDetail ? (
        <>
          <div
            className={book.tab === "book" ? "cd-ob-body" : "hidden"}
            aria-hidden={book.tab !== "book"}
          >
            <OrderBookBookTab {...bookTabProps} flush />
          </div>
          <div
            className={book.tab === "trades" ? "cd-ob-body" : "hidden"}
            aria-hidden={book.tab !== "trades"}
          >
            <OrderBookTradesTab
              tapeFills={tapeFills}
              tapeLoading={tapeLoading}
              tapeError={tapeError}
              tapeErrorMessage={tapeErrorMessage}
              flush
              collectionDetail
            />
          </div>
        </>
      ) : flush && !embedInMobileTab ? (
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div
            className={`absolute inset-0 flex flex-col overflow-hidden ${
              book.tab === "book" ? "" : "pointer-events-none invisible"
            }`}
            aria-hidden={book.tab !== "book"}
          >
            <OrderBookBookTab {...bookTabProps} flush />
          </div>
          <div
            className={`absolute inset-0 flex flex-col overflow-hidden ${
              book.tab === "trades" ? "" : "pointer-events-none invisible"
            }`}
            aria-hidden={book.tab !== "trades"}
          >
            <OrderBookTradesTab
              tapeFills={tapeFills}
              tapeLoading={tapeLoading}
              tapeError={tapeError}
              tapeErrorMessage={tapeErrorMessage}
              flush
            />
          </div>
        </div>
      ) : mobileEmbed ? (
        <div
          className={`${ORDER_BOOK_MOBILE_EMBED_TAB_BODY_HEIGHT_CLASS} flex min-h-0 shrink-0 flex-col overflow-hidden`}
        >
          {book.tab === "book" ? <OrderBookBookTab {...bookTabProps} flush /> : null}
          {book.tab === "trades" ? (
            <OrderBookTradesTab
              tapeFills={tapeFills}
              tapeLoading={tapeLoading}
              tapeError={tapeError}
              tapeErrorMessage={tapeErrorMessage}
              flush
              mobileEmbed
              collectionDetail={collectionDetail}
            />
          ) : null}
        </div>
      ) : (
        <>
          {book.tab === "book" ? (
            <OrderBookBookTab {...bookTabProps} flush={flush} />
          ) : null}
          {book.tab === "trades" ? (
            <OrderBookTradesTab
              tapeFills={tapeFills}
              tapeLoading={tapeLoading}
              tapeError={tapeError}
              tapeErrorMessage={tapeErrorMessage}
              flush={flush}
              collectionDetail={collectionDetail}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
