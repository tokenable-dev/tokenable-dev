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
  defaultTab = "book",
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

  const shell = flush
    ? embedInMobileTab
      ? "relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-none border-0 bg-transparent shadow-none"
      : "relative flex h-full max-h-full min-h-0 w-full max-w-full flex-col overflow-hidden rounded-none border-0 bg-transparent shadow-none"
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

      {flush ? (
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div
            className={`absolute inset-0 flex flex-col overflow-hidden ${
              book.tab === "book" ? "" : "pointer-events-none invisible"
            }`}
            aria-hidden={book.tab !== "book"}
          >
            <OrderBookBookTab
              flush
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
          </div>
          <div
            className={`absolute inset-0 flex flex-col overflow-hidden ${
              book.tab === "trades" ? "" : "pointer-events-none invisible"
            }`}
            aria-hidden={book.tab !== "trades"}
          >
            <OrderBookTradesTab tapeFills={tapeFills} tapeLoading={tapeLoading} flush />
          </div>
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
