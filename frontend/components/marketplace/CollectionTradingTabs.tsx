"use client";

import { type ReactNode, useMemo, useState } from "react";
import type { Address } from "viem";
import type { Order } from "@/lib/core";
import { isCriteriaCollectionBid } from "@/lib/seaport/criteria/criteriaMatch";
import { CollectionCriteriaBidPanel } from "@/components/marketplace/CollectionCriteriaBidPanel";
import { CollectionMyOrdersPanel } from "@/components/marketplace/CollectionMyOrdersPanel";
import {
  CollectionTradeTicket,
  type BookRowSelection,
} from "@/components/marketplace/CollectionTradeTicket";
import {
  COLLECTION_DETAILS_BG_CLASS,
  COLLECTION_DETAILS_BORDER_ALL,
  COLLECTION_DETAILS_BORDER_B,
} from "@/components/marketplace/collectionOverviewChrome";

export type CollectionTradeTab = "buy" | "sell" | "orders";

export function formatExchangeTradePriceLabel(
  bookSelection: BookRowSelection | null,
  presetPriceFromBook: string | null,
): string {
  if (bookSelection != null && Number.isFinite(bookSelection.price) && bookSelection.price > 0) {
    return `${bookSelection.price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}$`;
  }
  const p = presetPriceFromBook?.trim();
  if (p) return p.endsWith("$") ? p : `${p}$`;
  return "—";
}

type FlowTab = CollectionTradeTab;

function isAskRow(o: Order): boolean {
  return String(o.side ?? "ask").toLowerCase() !== "bid";
}

function countMyActiveOrders(
  asks: Order[],
  collectionBids: Order[],
  address?: string | null,
): number {
  const addr = address?.toLowerCase() ?? "";
  if (!addr) return 0;
  const listings = asks.filter(
    (o) => o.offerer.toLowerCase() === addr && o.status === "active" && isAskRow(o),
  );
  const bids = collectionBids.filter(
    (o) => o.offerer.toLowerCase() === addr && o.status === "active" && isCriteriaCollectionBid(o),
  );
  return listings.length + bids.length;
}

export function CollectionTradingTabs({
  orderBook,
  bookSelection,
  address,
  onBuySuccess,
  onOpenSellModal,
  collectionKey,
  collectionLabel,
  asks,
  collectionBids,
  connectedAddress,
  onInvalidate,
  /** Called with on-chain listing fill price after a successful instant buy (updates last print without polling). */
  onInstantBuyFillUsdc,
  onPurchaseFilled,
  presetPriceFromBook,
  listingCount,
  showSellListingCount = true,
  /** Fused with order book: shared outer chrome, full height, scroll inside. */
  flush = false,
  /** With {@link flush}: render as a bottom / corner sheet instead of the exchange column. */
  exchangeDock = false,
  /** Open state for {@link exchangeDock} (controlled from hero Buy/Sell). */
  dockOpen = false,
  onDockOpenChange,
  tradeFlow: tradeFlowProp,
  onTradeFlowChange,
}: {
  /** When omitted, the order book is expected beside the chart (exchange layout). */
  orderBook?: ReactNode;
  bookSelection: BookRowSelection | null;
  address: Address | undefined;
  onBuySuccess: () => void;
  onOpenSellModal: () => void;
  collectionKey: string;
  collectionLabel: string;
  asks: Order[];
  collectionBids: Order[];
  connectedAddress?: string;
  onInvalidate: () => void;
  onInstantBuyFillUsdc?: (usdc: number) => void;
  /** Instant buy / bid match filled — e.g. celebration modal (Buy panel). */
  onPurchaseFilled?: () => void;
  presetPriceFromBook?: string | null;
  listingCount: number;
  showSellListingCount?: boolean;
  flush?: boolean;
  exchangeDock?: boolean;
  dockOpen?: boolean;
  onDockOpenChange?: (open: boolean) => void;
  /** Controlled buy / sell / orders (e.g. hero row drives exchange layout). */
  tradeFlow?: CollectionTradeTab;
  onTradeFlowChange?: (tab: CollectionTradeTab) => void;
}) {
  const [internalFlow, setInternalFlow] = useState<FlowTab>("buy");
  const controlled = tradeFlowProp !== undefined && onTradeFlowChange !== undefined;
  const flow = controlled ? tradeFlowProp! : internalFlow;
  const setFlow = (f: FlowTab) => {
    if (controlled) onTradeFlowChange!(f);
    else setInternalFlow(f);
  };

  const ordersCount = useMemo(
    () => countMyActiveOrders(asks, collectionBids, connectedAddress),
    [asks, collectionBids, connectedAddress],
  );

  const docked = Boolean(flush && exchangeDock);
  const dockControlled = onDockOpenChange != null;
  const dockVisible = docked ? (dockControlled ? dockOpen : true) : true;

  const sectionClassName = docked
    ? [
        "box-border flex max-h-[min(560px,88dvh)] min-h-0 w-full min-w-0 max-w-full flex-col overflow-hidden",
        "fixed bottom-0 left-0 right-0 z-[100] sm:bottom-5 sm:left-auto sm:right-5 sm:w-[min(100vw-2.5rem,420px)]",
        "rounded-t-2xl border border-[rgba(38,39,45,1)] bg-[#141415] shadow-[0_20px_50px_-28px_rgba(0,0,0,0.85)] ring-1 ring-[rgba(11,13,16,1)] sm:rounded-xl",
        "transition-[transform,opacity,visibility] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]",
        dockVisible
          ? "translate-y-0 opacity-100 visible"
          : "pointer-events-none invisible translate-y-[105%] opacity-0",
      ].join(" ")
    : flush
      ? `box-border flex h-full max-h-full min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-hidden rounded-none border-0 bg-transparent shadow-none ring-0`
      : `min-w-0 w-full max-w-full overflow-hidden rounded-xl ${COLLECTION_DETAILS_BORDER_ALL} ${COLLECTION_DETAILS_BG_CLASS} shadow-[0_20px_50px_-28px_rgba(0,0,0,0.85)] ring-1 ring-[rgba(11,13,16,1)]`;

  const dockBackdrop =
    docked && dockVisible && dockControlled ? (
      <button
        type="button"
        className="fixed inset-0 z-[95] cursor-default bg-black/55"
        aria-label="Close trade panel"
        onClick={() => onDockOpenChange?.(false)}
      />
    ) : null;

  return (
    <>
      {dockBackdrop}
      <section
        className={sectionClassName}
        id="collection-trading"
        aria-label="Trade"
        aria-hidden={docked && !dockVisible ? true : undefined}
      >
        <div
          className={`flex shrink-0 flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 sm:px-3 ${
            flush && !docked
              ? "border-b border-[rgba(38,39,45,1)] bg-transparent"
              : docked
                ? "border-b border-[rgba(38,39,45,1)] bg-transparent"
                : `${COLLECTION_DETAILS_BORDER_B} ${COLLECTION_DETAILS_BG_CLASS}`
          }`}
        >
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <span
              className="truncate text-[10px] font-medium text-zinc-300"
              title={`${collectionLabel} · priced in USDC`}
            >
              {collectionLabel}
            </span>
            <span
              className={`inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded ${COLLECTION_DETAILS_BORDER_ALL} text-[9px] font-semibold leading-none text-zinc-500`}
              title="Collection market: bids and asks in USDC (Sepolia)."
            >
              i
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              role="tab"
              aria-selected={flow === "orders"}
              onClick={() => setFlow("orders")}
              className={`rounded border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide transition-colors ${
                flow === "orders"
                  ? `${COLLECTION_DETAILS_BORDER_ALL} bg-zinc-800/80 text-zinc-100`
                  : `border-transparent text-zinc-500 hover:border-[rgba(11,13,16,1)] hover:bg-zinc-900/60 hover:text-zinc-300`
              }`}
              title="Your active listings and collection bids in this collection"
            >
              Orders
              {ordersCount > 0 ? (
                <span className="ml-1 tabular-nums text-zinc-400">{ordersCount}</span>
              ) : null}
            </button>
            {docked && dockControlled ? (
              <button
                type="button"
                onClick={() => onDockOpenChange?.(false)}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${COLLECTION_DETAILS_BORDER_ALL} text-zinc-400 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100`}
                aria-label="Close trade panel"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            ) : null}
          </div>
        </div>

        {!flush ? (
        <div
          className={`shrink-0 px-2.5 pb-2 pt-1 sm:px-3 ${COLLECTION_DETAILS_BORDER_B} ${COLLECTION_DETAILS_BG_CLASS}`}
        >
          <div
            className={`relative flex gap-1 rounded-xl ${COLLECTION_DETAILS_BORDER_ALL} p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${COLLECTION_DETAILS_BG_CLASS}`}
            role="tablist"
            aria-label="Buy or sell"
          >
            <span
              aria-hidden
              className={`pointer-events-none absolute top-1 bottom-1 left-1 w-[calc((100%-0.5rem-0.25rem)/2)] rounded-lg shadow-[0_1px_0_rgba(255,255,255,0.05)] transition-[transform,background-color,box-shadow] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] ${
                flow === "buy"
                  ? "translate-x-0 bg-mint/[0.18] ring-1 ring-mint/35"
                  : "translate-x-[calc(100%+0.25rem)] bg-rose-500/[0.18] ring-1 ring-rose-400/35"
              }`}
            />
            <button
              type="button"
              role="tab"
              aria-selected={flow === "buy"}
              onClick={() => setFlow("buy")}
              className={`relative z-10 flex-1 rounded-lg py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/40 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${
                flow === "buy"
                  ? "text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Buy
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={flow === "sell"}
              onClick={() => setFlow("sell")}
              className={`relative z-10 flex-1 rounded-lg py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${
                flow === "sell"
                  ? "text-rose-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Sell
            </button>
          </div>
        </div>
      ) : null}

      <div
        className={
          flush
            ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-auto"
            : "contents"
        }
      >
        {flow === "orders" ? (
          <div
            className={`px-2 py-1.5 sm:px-2.5 ${flush ? "min-h-0 shrink-0" : "sm:py-2"}`}
            role="tabpanel"
            aria-label="Your orders"
          >
            <CollectionMyOrdersPanel
              asks={asks}
              collectionBids={collectionBids}
              address={connectedAddress}
              onInvalidate={onInvalidate}
              collectionLabel={collectionLabel}
              collectionKey={collectionKey}
              embedded
            />
          </div>
        ) : (
          <div
            className={`flex flex-col gap-2 p-2 pb-3 sm:p-3 sm:pb-3 ${flush ? "min-h-0 shrink-0" : ""}`}
            role="tabpanel"
          >
            {orderBook != null ? <div className="min-w-0 w-full">{orderBook}</div> : null}

            <div
              className={`w-full min-w-0 ${flush ? "rounded-none border-0 bg-transparent px-2 py-2 sm:px-2.5 sm:py-2.5" : `rounded-lg ${COLLECTION_DETAILS_BORDER_ALL} ${COLLECTION_DETAILS_BG_CLASS} p-2.5 sm:p-3`}`}
            >
              {flow === "buy" ? (
                <div id="collection-bid-panel" className="min-w-0">
                  <CollectionCriteriaBidPanel
                    variant="embedded"
                    collectionKey={collectionKey}
                    activeAsks={asks}
                    connectedAddress={connectedAddress}
                    onPlaced={() => onInvalidate()}
                    onInstantBuyFillUsdc={onInstantBuyFillUsdc}
                    onOpenSellModal={onOpenSellModal}
                    presetPriceFromBook={presetPriceFromBook}
                    onPurchaseFilled={onPurchaseFilled}
                  />
                </div>
              ) : (
                <CollectionTradeTicket
                  flow="sell"
                  selection={bookSelection}
                  address={address}
                  onBuySuccess={onBuySuccess}
                  onOpenSellModal={onOpenSellModal}
                  collectionLabel={collectionLabel}
                  listingCount={listingCount}
                  showSellListingCount={showSellListingCount}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </section>
    </>
  );
}
