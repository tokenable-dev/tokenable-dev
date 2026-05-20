"use client";

import { useState } from "react";
import { formatUnits } from "viem";
import { cancelOrder, type Order } from "@/lib/core";
import { isCriteriaCollectionBid } from "@/lib/seaport/criteria/criteriaMatch";
import { isCollectionBidMerkleStale } from "@/lib/seaport/criteria/collectionCriteriaRoot";
import { useCollectionMerkleRootHex } from "@/lib/seaport/criteria/useCollectionMerkleRootHex";

function formatUsdc6(amountStr: string): string {
  try {
    const n = Number(formatUnits(BigInt(amountStr), 6));
    return n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return amountStr;
  }
}

function bidMaxUsdc(o: Order): string {
  try {
    const offer0 = o.parameters?.offer?.[0];
    if (offer0?.startAmount) return formatUsdc6(String(offer0.startAmount));
  } catch {
    /* */
  }
  return formatUsdc6(o.considerationAmount);
}

function isAskRow(o: Order): boolean {
  return String(o.side ?? "ask").toLowerCase() !== "bid";
}

export function CollectionMyOrdersPanel({
  asks,
  collectionBids,
  address,
  onInvalidate,
  collectionLabel,
  /** Used to compare each criteria bid’s signed Merkle root vs the current pool (staleness). */
  collectionKey,
  /** When true, omit outer section chrome (for use inside a parent tab panel). */
  embedded = false,
}: {
  asks: Order[];
  collectionBids: Order[];
  address?: string | null;
  onInvalidate?: () => void;
  collectionLabel?: string;
  collectionKey?: string;
  embedded?: boolean;
}) {
  const [cancelling, setCancelling] = useState<string | null>(null);
  const { data: currentMerkleRootHex } = useCollectionMerkleRootHex(collectionKey);

  const addr = address?.toLowerCase() ?? "";

  const myListings = asks.filter(
    (o) =>
      addr &&
      o.offerer.toLowerCase() === addr &&
      o.status === "active" &&
      isAskRow(o),
  );

  const myBids = collectionBids.filter(
    (o) =>
      addr &&
      o.offerer.toLowerCase() === addr &&
      o.status === "active" &&
      isCriteriaCollectionBid(o),
  );

  const total = myListings.length + myBids.length;

  async function handleCancel(orderHash: string) {
    if (!address) return;
    setCancelling(orderHash);
    try {
      await cancelOrder(orderHash, address);
      onInvalidate?.();
    } finally {
      setCancelling(null);
    }
  }

  const embeddedBody = !address ? (
    <p className="py-6 text-center text-[11px] text-zinc-500">Connect wallet to view orders.</p>
  ) : total === 0 ? (
    <p
      className="py-6 text-center text-[11px] text-zinc-500"
      title="Use Buy or Sell to place orders; they appear here when active."
    >
      No active orders.
    </p>
  ) : (
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
                    {formatUsdc6(o.considerationAmount)}
                  </span>
                  <span className="text-zinc-600"> USDC</span>
                </div>
                <button
                  type="button"
                  disabled={cancelling === o.orderHash}
                  onClick={() => void handleCancel(o.orderHash)}
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
                  <span className="font-mono tabular-nums text-zinc-400">≤{bidMaxUsdc(o)}</span>
                  <span className="text-zinc-600"> USDC</span>
                  {isCollectionBidMerkleStale(o, currentMerkleRootHex) ? (
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
                  onClick={() => void handleCancel(o.orderHash)}
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

  const body = embedded ? (
    embeddedBody
  ) : (
    <div className="p-4 sm:p-6">
      {!address ? (
        <p className="py-8 text-center text-sm text-gray-500">
          Connect your wallet to see and manage your orders.
        </p>
      ) : total === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-800/90 bg-black/20 px-4 py-10 text-center">
          <p className="text-sm text-gray-400">No open orders from you in this collection.</p>
          <p className="mx-auto mt-2 max-w-md text-[11px] leading-relaxed text-gray-600">
            List an asset with <span className="text-gray-500">Sell</span> or place a bid below —
            they will show up here.
          </p>
        </div>
      ) : (
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
                        {formatUsdc6(o.considerationAmount)} USDC · listing
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={cancelling === o.orderHash}
                      onClick={() => void handleCancel(o.orderHash)}
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
                <span className="h-2 w-2 rounded-full bg-mint/90 shadow-[0_0_10px_rgba(135,255,72,0.35)]" />
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
                        Up to {bidMaxUsdc(o)} USDC · criteria
                      </p>
                      {isCollectionBidMerkleStale(o, currentMerkleRootHex) ? (
                        <p className="mt-2 text-[10px] leading-relaxed text-amber-200/90">
                          Merkle pool changed since this bid was signed —{" "}
                          <span className="text-amber-100/95">cancel and place again from Buy</span>{" "}
                          (same USDC) so instant match can run. Seaport locks the root inside your
                          signature; it cannot auto-update.
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      disabled={cancelling === o.orderHash}
                      onClick={() => void handleCancel(o.orderHash)}
                      className="shrink-0 rounded-lg border border-amber-500/35 bg-amber-500/[0.08] px-3 py-2 text-[11px] font-semibold text-amber-100/95 transition-colors hover:bg-amber-500/[0.14] disabled:opacity-40"
                    >
                      {cancelling === o.orderHash ? "Cancelling…" : "Cancel bid"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (embedded) {
    return (
      <div id="collection-my-orders" aria-label="Your orders in this collection">
        {body}
      </div>
    );
  }

  return (
    <section
      className="mt-10 rounded-2xl border border-gray-800/80 bg-gradient-to-b from-[#0c0f14] via-[#090b10] to-[#07080c] overflow-hidden shadow-[0_20px_50px_-28px_rgba(0,0,0,0.85)]"
      id="collection-my-orders"
      aria-label="Your orders in this collection"
    >
      <div className="relative border-b border-gray-800/80 px-4 sm:px-6 py-4 sm:py-5">
        <div
          className="pointer-events-none absolute -right-10 -top-16 h-36 w-44 rounded-full bg-violet-500/[0.07] blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white tracking-tight">Your orders</h2>
            <p className="text-[11px] text-gray-500 mt-1 max-w-xl leading-relaxed">
              {collectionLabel ? (
                <>
                  Open listings and collection bids you have in{" "}
                  <span className="text-gray-400">{collectionLabel}</span>. Cancel here anytime
                  before they fill.
                </>
              ) : (
                <>Open listings and collection bids in this collection. Cancel here before they fill.</>
              )}
            </p>
          </div>
          {addr && total > 0 && (
            <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium tabular-nums text-gray-400">
              {total} active
            </span>
          )}
        </div>
      </div>

      {body}
    </section>
  );
}
