"use client";

import type { Order } from "@/lib/core";
import {
  bidMaxUsdcFromOrder,
  formatOrderUsdc6,
} from "@/lib/marketplace/collection-trading/orderUsdcFormat";

export function CollectionMyOrdersStandaloneBody({
  addr,
  total,
  myListings,
  myBids,
  cancelling,
  onCancel,
  onChangeBidPrice,
  isBidStale,
}: {
  addr: string;
  total: number;
  myListings: Order[];
  myBids: Order[];
  cancelling: string | null;
  onCancel: (orderHash: string) => void;
  onChangeBidPrice: (bid: Order) => void;
  isBidStale: (o: Order) => boolean;
}) {
  if (!addr) {
    return (
      <p className="py-8 text-center text-sm text-gray-500">
        Connect your wallet to see and manage your orders.
      </p>
    );
  }

  if (total === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-800/90 bg-black/20 px-4 py-10 text-center">
        <p className="text-sm text-gray-400">No open orders from you in this collection.</p>
        <p className="mx-auto mt-2 max-w-md text-[11px] leading-relaxed text-gray-600">
          List an asset with <span className="text-gray-500">Sell</span> or place a bid below —
          they will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {myListings.length > 0 && (
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-rose-400/90 shadow-[0_0_10px_rgba(251,113,133,0.35)]" />
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
              Selling
            </h3>
            <span className="text-[10px] tabular-nums text-gray-600">({myListings.length})</span>
          </div>
          <ul className="space-y-2">
            {myListings.map((o) => (
              <li
                key={o.orderHash}
                className="group flex flex-col gap-3 rounded-xl border border-gray-800/80 bg-black/30 px-3.5 py-3 ring-1 ring-transparent transition-shadow hover:ring-white/[0.06] sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white">
                    Token <span className="font-mono tabular-nums">#{o.tokenId}</span>
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] tabular-nums text-gray-500">
                    {formatOrderUsdc6(o.considerationAmount)} USDC · listing
                  </p>
                </div>
                <button
                  type="button"
                  disabled={cancelling === o.orderHash}
                  onClick={() => onCancel(o.orderHash)}
                  className="shrink-0 rounded-lg border border-rose-500/35 bg-rose-500/[0.08] px-3 py-2 text-[11px] font-semibold text-rose-200/95 transition-colors hover:bg-rose-500/[0.14] disabled:opacity-40"
                >
                  {cancelling === o.orderHash ? "Cancelling…" : "Cancel listing"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {myBids.length > 0 && (
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-mint/90 shadow-[0_0_10px_rgba(16,211,51,0.35)]" />
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
              Buying (collection bid)
            </h3>
            <span className="text-[10px] tabular-nums text-gray-600">({myBids.length})</span>
          </div>
          <ul className="space-y-2">
            {myBids.map((o) => (
              <li
                key={o.orderHash}
                className="group flex flex-col gap-3 rounded-xl border border-gray-800/80 bg-black/30 px-3.5 py-3 ring-1 ring-transparent transition-shadow hover:ring-white/[0.06] sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white">Collection-wide bid</p>
                  <p className="mt-0.5 font-mono text-[11px] tabular-nums text-gray-500">
                    Up to {bidMaxUsdcFromOrder(o)} USDC · criteria
                  </p>
                  {isBidStale(o) ? (
                    <p className="mt-2 text-[10px] leading-relaxed text-amber-200/90">
                      Merkle pool changed since this bid was signed — use{" "}
                      <span className="text-amber-100/95">Change price</span> (or cancel and re-bid)
                      so instant match can run with the current pool.
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    disabled={cancelling === o.orderHash}
                    onClick={() => onChangeBidPrice(o)}
                    className="rounded-lg border border-mint/35 bg-mint/[0.08] px-3 py-2 text-[11px] font-semibold text-mint transition-colors hover:bg-mint/[0.14] disabled:opacity-40"
                  >
                    Change price
                  </button>
                  <button
                    type="button"
                    disabled={cancelling === o.orderHash}
                    onClick={() => onCancel(o.orderHash)}
                    className="rounded-lg border border-amber-500/35 bg-amber-500/[0.08] px-3 py-2 text-[11px] font-semibold text-amber-100/95 transition-colors hover:bg-amber-500/[0.14] disabled:opacity-40"
                  >
                    {cancelling === o.orderHash ? "Cancelling…" : "Cancel bid"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
