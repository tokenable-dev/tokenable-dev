"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
        <span className="cd-ob-book-hdr__c">Qty</span>
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
}: {
  bidCount: number;
  askCount: number;
  flush?: boolean;
  showSellHint?: boolean;
  collectionDetail?: boolean;
}) {
  /* Design HTML: no footer under the book (empty tips live on the mid strip). */
  if (collectionDetail) return null;

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

/**
 * Design HTML split-scroll pane: fixed visual height, independent scroll,
 * top/bottom fades, optional pin-to-bottom (asks near spread).
 */
function OrderBookSplitScrollPane({
  pinToBottom,
  scrollKey,
  children,
}: {
  pinToBottom?: boolean;
  /** Remount/reset scroll when depth identity changes. */
  scrollKey: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [fadeTop, setFadeTop] = useState(false);
  const [fadeBot, setFadeBot] = useState(false);

  const updateFades = () => {
    const el = ref.current;
    if (!el) return;
    const atTop = el.scrollTop <= 2;
    const atBot = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
    const canScroll = el.scrollHeight > el.clientHeight + 2;
    setFadeTop(canScroll && !atTop);
    setFadeBot(canScroll && !atBot);
  };

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const pin = () => {
      /* Card.html: `ael.scrollTop = ael.scrollHeight` so best ask sits on the spread. */
      if (pinToBottom) {
        el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
      } else {
        el.scrollTop = 0;
      }
      updateFades();
    };

    pin();
    const ro = new ResizeObserver(pin);
    ro.observe(el);
    const child = el.firstElementChild;
    if (child) ro.observe(child);
    const raf = window.requestAnimationFrame(() => {
      pin();
      window.requestAnimationFrame(pin);
    });
    return () => {
      ro.disconnect();
      window.cancelAnimationFrame(raf);
    };
  }, [scrollKey, pinToBottom]);

  return (
    <div className="cd-ob-book-pane">
      <div
        ref={ref}
        className="cd-ob-book-pane__scroll"
        onScroll={updateFades}
      >
        {children}
      </div>
      <div
        className={`cd-ob-book-pane__fade cd-ob-book-pane__fade--top${
          fadeTop ? "" : " is-hidden"
        }`}
        aria-hidden
      />
      <div
        className={`cd-ob-book-pane__fade cd-ob-book-pane__fade--bot${
          fadeBot ? "" : " is-hidden"
        }`}
        aria-hidden
      />
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
  const [coachOn, setCoachOn] = useState(false);

  useEffect(() => {
    if (!collectionDetail || askLevels.length === 0) return;
    let seen = false;
    try {
      seen = window.localStorage.getItem("tk-ob-coach") === "1";
    } catch {
      seen = false;
    }
    if (seen) return;
    setCoachOn(true);
    try {
      window.localStorage.setItem("tk-ob-coach", "1");
    } catch {
      /* ignore */
    }
    const t = window.setTimeout(() => setCoachOn(false), 3500);
    return () => window.clearTimeout(t);
  }, [collectionDetail, askLevels.length]);
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
        <div className="cd-ob-book-pane cd-ob-book-pane--tall">
          <OrderBookEmptyPanel
            variant="no_market"
            onPlaceBid={onPlaceBid}
            onListYours={onListYours}
          />
        </div>
        <p className="cd-ob-book-hint cd-ob-book-hint--market-empty">
          Vaulted cards can be listed here.
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
        className={
          collectionDetail
            ? `cd-ob-book flex h-full min-h-0 flex-col overflow-hidden${
                asksEmptyBidsLive ? " cd-ob-book--noasks" : ""
              }${bidsEmptyAsksLive ? " cd-ob-book--nobids" : ""}${
                askScrollable && bidScrollable ? " cd-ob-book--both-sides" : ""
              }`
            : `flex min-h-0 flex-col overflow-hidden ${
                mobileEmbed ? "h-full" : "h-full flex-1"
              }`
        }
      >
        <OrderBookColumnHeader flush collectionDetail={collectionDetail} />
        {coachOn ? (
          <div className="cd-ob-coach" role="status">
            Tap an ask to buy
          </div>
        ) : null}
        {collectionDetail ? (
          <div className="cd-ob-book-stack">
            {asksEmptyBidsLive ? (
              <div className="cd-ob-book-pane cd-ob-book-pane--empty-side">
                <OrderBookEmptyPanel
                  variant="no_asks"
                  onPlaceBid={onPlaceBid}
                  listingAlertActive={listingAlertActive}
                  listingAlertPending={listingAlertPending}
                  onToggleListingAlert={onToggleListingAlert}
                />
              </div>
            ) : (
              <OrderBookSplitScrollPane
                pinToBottom
                scrollKey={`asks:${askLevels.map((l) => l.key).join(",")}`}
              >
                <AskLevelsList
                  levels={askLevels}
                  selectedLevelKey={selectedLevelKey}
                  onSelectLevel={onSelectLevel}
                  flush
                  collectionDetail
                  wrapperClass="cd-ob-book-asks__list"
                />
              </OrderBookSplitScrollPane>
            )}
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
            {bidsEmptyAsksLive ? (
              <div className="cd-ob-book-pane cd-ob-book-pane--empty-side">
                <OrderBookEmptyPanel
                  variant="no_bids"
                  onPlaceBid={onPlaceBid}
                />
              </div>
            ) : (
              <OrderBookSplitScrollPane
                scrollKey={`bids:${bidLevels.map((l) => l.key).join(",")}`}
              >
                <BidLevelsList
                  levels={bidLevels}
                  selectedLevelKey={selectedLevelKey}
                  onSelectLevel={onSelectLevel}
                  flush
                  collectionDetail
                  wrapperClass="cd-ob-book-bids__list"
                />
              </OrderBookSplitScrollPane>
            )}
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
