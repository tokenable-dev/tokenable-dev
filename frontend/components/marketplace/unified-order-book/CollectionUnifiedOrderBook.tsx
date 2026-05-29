"use client";

import {
  COLLECTION_DETAILS_BG_CLASS,
  COLLECTION_DETAILS_BORDER_ALL,
} from "@/components/marketplace/collectionOverviewChrome";
import type { CollectionUnifiedOrderBookProps } from "@/lib/marketplace/marketplaceTradingTypes";
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
}: CollectionUnifiedOrderBookProps) {
  const book = useUnifiedOrderBook({
    asks,
    collectionBids,
    lastTradePriceUsdc,
    lastTradeSide,
    compact,
    flush,
  });

  const shell = flush
    ? embedInMobileTab
      ? "relative flex w-full min-w-0 shrink-0 flex-col overflow-hidden rounded-none border-0 bg-transparent shadow-none"
      : `relative flex h-full max-h-full min-h-0 max-w-full flex-col overflow-hidden rounded-none border-0 bg-transparent shadow-none max-lg:min-h-0 lg:min-h-0`
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
      <OrderBookTabHeader tab={book.tab} setTab={book.setTab} flush={flush} />

      {book.tab === "book" ? (
        <OrderBookBookTab
          flush={flush}
          compact={compact}
          depthMax={book.depthMax}
          askLevels={book.askLevels}
          bidLevels={book.bidLevels}
          bookCenterModel={book.bookCenterModel}
          bidCount={book.bidRows.length}
          askCount={book.askRows.length}
          selectedLevelKey={selectedLevelKey}
          onSelectLevel={onSelectLevel}
        />
      ) : null}

      {book.tab === "trades" ? (
        <OrderBookTradesTab tapeFills={tapeFills} tapeLoading={tapeLoading} flush={flush} />
      ) : null}
    </div>
  );
}
