"use client";

import Link from "next/link";
import {
  COLLECTION_DETAILS_BORDER_ALL,
  COLLECTION_DETAILS_BORDER_B,
} from "@/components/marketplace/collectionOverviewChrome";
import type { BookRowSelection } from "@/lib/marketplace/marketplaceTradingTypes";
import { formatTradeTicketUsdcPrice } from "@/lib/marketplace/collection-trading/orderUsdcFormat";

export function CollectionTradeTicketSell({
  selection,
  onOpenSellModal,
  listingCount,
  showSellListingCount,
}: {
  selection: BookRowSelection | null;
  onOpenSellModal: () => void;
  listingCount: number;
  showSellListingCount: boolean;
}) {
  const listTitle =
    "Choose an asset from your wallet, set a USDC price, and list it in this collection’s order book.";
  const bidHint =
    selection?.side === "bid"
      ? `Bid row ${formatTradeTicketUsdcPrice(selection.price)} USDC — you can list a new ask at this price. If you already have a higher ask, accept the offer from Notifications (Accept offer) instead of lowering your list price.`
      : selection?.side === "ask"
        ? "Red row is someone else’s listing — use Buy to purchase it, or open List for sale to set your own price."
        : null;

  return (
    <div className="w-full space-y-2" aria-label="Sell">
      <div className={`flex items-center justify-between gap-2 pb-2 pt-0.5 ${COLLECTION_DETAILS_BORDER_B}`}>
        <h2 className="text-xs font-semibold tracking-tight text-white">Sell</h2>
        <span
          className={`inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded ${COLLECTION_DETAILS_BORDER_ALL} text-[9px] font-semibold leading-none text-zinc-500`}
          title={listTitle}
        >
          i
        </span>
      </div>
      {bidHint ? (
        <p className="text-[10px] leading-snug text-zinc-500 pt-1">{bidHint}</p>
      ) : null}
      <div className="space-y-2 pt-2">
        <button
          type="button"
          onClick={onOpenSellModal}
          title={listTitle}
          className="w-full min-h-[40px] rounded-md bg-[#DC2626] px-3 py-2 text-xs font-bold text-white shadow-md shadow-black/25 transition hover:brightness-110 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-40"
        >
          List for sale
        </button>
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[9px] text-zinc-500">
          <Link href="/portfolio" className="hover:text-zinc-400" title="Manage RWAs in your wallet">
            Portfolio
          </Link>
          {showSellListingCount ? (
            listingCount > 0 ? (
              <Link
                href="#collection-listings"
                className="tabular-nums hover:text-zinc-400"
                title="Scroll to listings in this collection"
              >
                {listingCount} listing{listingCount === 1 ? "" : "s"}
              </Link>
            ) : (
              <span title="No other listings in this collection yet">0 listings</span>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
