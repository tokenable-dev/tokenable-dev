"use client";

import type { Order } from "@/lib/core";
import {
  bidMaxUsdcFromOrder,
  formatOrderUsdc6,
} from "@/lib/marketplace/collection-trading/orderUsdcFormat";

export function CollectionMyOrdersEmbeddedBody({
  addr,
  total,
  myListings,
  myBids,
  cancelling,
  onCancel,
  isBidStale,
}: {
  addr: string;
  total: number;
  myListings: Order[];
  myBids: Order[];
  cancelling: string | null;
  onCancel: (orderHash: string) => void;
  isBidStale: (o: Order) => boolean;
}) {
  if (!addr) {
    return (
      <p className="py-6 text-center text-[11px] text-zinc-500">Connect wallet to view orders.</p>
    );
  }

  if (total === 0) {
    return (
      <p
        className="py-6 text-center text-[11px] text-zinc-500"
        title="Use Buy or Sell to place orders; they appear here when active."
      >
        No active orders.
      </p>
    );
  }

  return (
    <div className="divide-y divide-zinc-800/80">
      {myListings.length > 0 ? (
        <div className="py-1">
          <p className="px-0.5 py-1 text-[9px] font-medium uppercase tracking-wide text-zinc-600">
            Listings
          </p>
          <ul className="divide-y divide-zinc-800/60">
            {myListings.map((o) => (
              <li
                key={o.orderHash}
                className="flex items-center justify-between gap-2 py-2 text-[11px] first:pt-1"
              >
                <div className="min-w-0">
                  <span className="text-zinc-500">Ask</span>{" "}
                  <span className="font-mono tabular-nums text-zinc-200">#{o.tokenId}</span>
                  <span className="ml-2 font-mono tabular-nums text-zinc-400">
                    {formatOrderUsdc6(o.considerationAmount)}
                  </span>
                  <span className="text-zinc-600"> USDC</span>
                </div>
                <button
                  type="button"
                  disabled={cancelling === o.orderHash}
                  onClick={() => onCancel(o.orderHash)}
                  className="shrink-0 text-[10px] font-medium text-rose-400/90 hover:text-rose-300 disabled:opacity-40"
                  title="Cancel this listing"
                >
                  {cancelling === o.orderHash ? "…" : "Cancel"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {myBids.length > 0 ? (
        <div className="py-1">
          <p className="px-0.5 py-1 text-[9px] font-medium uppercase tracking-wide text-zinc-600">
            Bids
          </p>
          <ul className="divide-y divide-zinc-800/60">
            {myBids.map((o) => (
              <li
                key={o.orderHash}
                className="flex items-center justify-between gap-2 py-2 text-[11px] first:pt-1"
              >
                <div className="min-w-0">
                  <span className="text-zinc-500">Bid</span>{" "}
                  <span className="font-mono tabular-nums text-zinc-400">≤{bidMaxUsdcFromOrder(o)}</span>
                  <span className="text-zinc-600"> USDC</span>
                  {isBidStale(o) ? (
                    <span
                      className="ml-1.5 rounded border border-amber-500/35 bg-amber-500/[0.12] px-1 py-px text-[9px] font-medium text-amber-200/95"
                      title="This bid was signed with an older Merkle pool. Cancel it and place again from Buy (same USDC) so matchAdvancedOrders can run."
                    >
                      Pool outdated
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={cancelling === o.orderHash}
                  onClick={() => onCancel(o.orderHash)}
                  className="shrink-0 text-[10px] font-medium text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
                  title="Cancel collection bid"
                >
                  {cancelling === o.orderHash ? "…" : "Cancel"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
