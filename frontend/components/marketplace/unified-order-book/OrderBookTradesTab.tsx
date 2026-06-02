"use client";

import Link from "next/link";
import {
  COLLECTION_DETAILS_BORDER_B,
  COLLECTION_DETAILS_BORDER_T,
} from "@/components/marketplace/collectionOverviewChrome";
import type { CollectionPlatformTapeFill } from "@/lib/core";
import {
  MAX_ORDER_BOOK_TAPE_ROWS,
  formatTapeTime,
} from "@/lib/marketplace/unified-order-book";

export function OrderBookTradesTab({
  tapeFills,
  tapeLoading,
  flush,
}: {
  tapeFills: CollectionPlatformTapeFill[];
  tapeLoading?: boolean;
  flush?: boolean;
}) {
  return (
    <div
      className={`flex min-h-0 flex-col ${
        flush ? "min-h-0 flex-1 overflow-hidden" : "max-h-[min(420px,52vh)]"
      }`}
    >
      {tapeLoading ? (
        <div className="flex flex-1 items-center justify-center py-12 text-[11px] text-gray-500">
          Loading trades…
        </div>
      ) : tapeFills.length === 0 ? (
        <div className="px-3 py-10 text-center text-[11px] leading-relaxed text-gray-600">
          No on-chain sales recorded for this collection yet.
        </div>
      ) : (
        <>
          <div
            className={`grid shrink-0 grid-cols-[minmax(0,1fr)_44px_minmax(0,52px)_minmax(0,1fr)] gap-1 px-2.5 py-1.5 text-[9px] font-medium uppercase tracking-wide text-gray-500 sm:px-3 sm:text-[10px] ${COLLECTION_DETAILS_BORDER_B}`}
          >
            <span>Price</span>
            <span className="text-center">Side</span>
            <span className="text-right">Token</span>
            <span className="text-right">Time</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-auto px-1 py-0.5">
            {tapeFills.slice(0, MAX_ORDER_BOOK_TAPE_ROWS).map((row) => (
              <div
                key={row.orderHash}
                className="grid grid-cols-[minmax(0,1fr)_44px_minmax(0,52px)_minmax(0,1fr)] items-center gap-1 rounded-[2px] px-1.5 py-1 font-mono text-[10px] tabular-nums text-gray-200 hover:bg-white/[0.03] sm:text-[11px]"
              >
                <span className="min-w-0 truncate text-mint/95">
                  {row.priceUsdc.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span
                  className={`text-center text-[9px] font-sans font-medium uppercase tracking-wide sm:text-[10px] ${
                    row.tapeAggressor === "sell" ? "text-rose-400/95" : "text-mint/90"
                  }`}
                >
                  {row.tapeAggressor === "sell" ? "Sell" : "Buy"}
                </span>
                <span className="text-right">
                  {/^\d+$/.test(String(row.tokenId)) ? (
                    <Link
                      href={`/marketplace/${encodeURIComponent(row.tokenId)}`}
                      className="text-mint/90 hover:text-mint hover:underline"
                    >
                      #{row.tokenId}
                    </Link>
                  ) : (
                    <span className="text-gray-500">{row.tokenId}</span>
                  )}
                </span>
                <span
                  className="min-w-0 truncate text-right text-gray-500"
                  title={new Date(row.t * 1000).toISOString()}
                >
                  {formatTapeTime(row.t)}
                </span>
              </div>
            ))}
          </div>
          {tapeFills.length > MAX_ORDER_BOOK_TAPE_ROWS ? (
            <p
              className={`shrink-0 px-2.5 py-1 text-center text-[9px] text-gray-600 ${COLLECTION_DETAILS_BORDER_T}`}
            >
              Showing last {MAX_ORDER_BOOK_TAPE_ROWS} of {tapeFills.length} fills
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
