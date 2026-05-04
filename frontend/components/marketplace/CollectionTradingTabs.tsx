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

type FlowTab = "buy" | "sell" | "orders";

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
  /** Fused with order book: shared outer chrome, full height, scroll inside. */
  flush = false,
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
  flush?: boolean;
}) {
  const [flow, setFlow] = useState<FlowTab>("buy");

  const ordersCount = useMemo(
    () => countMyActiveOrders(asks, collectionBids, connectedAddress),
    [asks, collectionBids, connectedAddress],
  );

  return (
    <section
      className={
        flush
          ? "box-border flex h-full max-h-full min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-hidden rounded-none border-0 bg-[#09090b] shadow-none ring-0"
          : "min-w-0 w-full max-w-full overflow-hidden rounded-xl border border-zinc-800/90 bg-[#09090b] shadow-[0_20px_50px_-28px_rgba(0,0,0,0.85)] ring-1 ring-white/[0.04]"
      }
      id="collection-trading"
      aria-label="Trade"
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-800/90 bg-[#09090b] px-2.5 py-1.5 sm:px-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className="truncate text-[10px] font-medium text-zinc-300"
            title={`${collectionLabel} · priced in USDC`}
          >
            {collectionLabel}
          </span>
          <span
            className="inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded border border-zinc-800/90 text-[9px] font-semibold leading-none text-zinc-500"
            title="Collection market: bids and asks in USDC (Sepolia)."
          >
            i
          </span>
        </div>
        <button
          type="button"
          role="tab"
          aria-selected={flow === "orders"}
          onClick={() => setFlow("orders")}
          className={`shrink-0 rounded border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide transition-colors ${
            flow === "orders"
              ? "border-zinc-600 bg-zinc-800/80 text-zinc-100"
              : "border-transparent text-zinc-500 hover:border-zinc-800 hover:bg-zinc-900/60 hover:text-zinc-300"
          }`}
          title="Your active listings and collection bids in this collection"
        >
          Orders
          {ordersCount > 0 ? (
            <span className="ml-1 tabular-nums text-zinc-400">{ordersCount}</span>
          ) : null}
        </button>
      </div>

      <div className="shrink-0 border-b border-zinc-800/90 bg-[#09090b] px-2.5 pb-2 pt-1 sm:px-3">
        <div
          className="relative flex gap-1 rounded-xl border border-zinc-800/70 bg-zinc-950/80 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          role="tablist"
          aria-label="Buy or sell"
        >
          <span
            aria-hidden
            className={`pointer-events-none absolute top-1 bottom-1 left-1 w-[calc((100%-0.5rem-0.25rem)/2)] rounded-lg shadow-[0_1px_0_rgba(255,255,255,0.05)] transition-[transform,background-color,box-shadow] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] ${
              flow === "buy"
                ? "translate-x-0 bg-emerald-500/[0.18] ring-1 ring-emerald-400/35"
                : "translate-x-[calc(100%+0.25rem)] bg-rose-500/[0.18] ring-1 ring-rose-400/35"
            }`}
          />
          <button
            type="button"
            role="tab"
            aria-selected={flow === "buy"}
            onClick={() => setFlow("buy")}
            className={`relative z-10 flex-1 rounded-lg py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${
              flow === "buy"
                ? "text-emerald-100"
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

      <div
        className={
          flush
            ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-auto scrollbar-platform"
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
              className={`w-full min-w-0 ${flush ? "rounded-none border-0 bg-transparent px-2 py-2 sm:px-2.5 sm:py-2.5" : "rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-2.5 sm:p-3"}`}
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
                />
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
