"use client";

import type { Order } from "@/lib/core";
import { CollectionChangeBidModal } from "./CollectionChangeBidModal";
import { CollectionMyOrdersEmbeddedBody } from "./CollectionMyOrdersEmbeddedBody";
import { CollectionMyOrdersStandaloneBody } from "./CollectionMyOrdersStandaloneBody";
import { useCollectionMyOrders } from "@/hooks/marketplace/collection-trading/useCollectionMyOrders";

export function CollectionMyOrdersPanel({
  asks,
  collectionBids,
  address,
  onInvalidate,
  collectionLabel,
  collectionKey,
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
  const orders = useCollectionMyOrders({
    asks,
    collectionBids,
    address,
    onInvalidate,
    collectionKey,
  });

  const bodyProps = {
    addr: orders.addr,
    total: orders.total,
    myListings: orders.myListings,
    myBids: orders.myBids,
    cancelling: orders.cancelling,
    onCancel: (hash: string) => void orders.handleCancel(hash),
    onChangeBidPrice: (bid: Order) => orders.setBidToChange(bid),
    isBidStale: orders.isBidStale,
  };

  const changeBidModal =
    collectionKey != null && collectionKey.trim() !== "" ? (
      <CollectionChangeBidModal
        open={orders.bidToChange != null}
        bid={orders.bidToChange}
        collectionKey={collectionKey}
        activeAsks={asks}
        connectedAddress={address ?? undefined}
        onClose={() => orders.setBidToChange(null)}
        onUpdated={() => onInvalidate?.()}
      />
    ) : null;

  if (embedded) {
    return (
      <div id="collection-my-orders" aria-label="Your orders in this collection">
        <CollectionMyOrdersEmbeddedBody {...bodyProps} />
        {changeBidModal}
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
          {orders.addr && orders.total > 0 && (
            <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium tabular-nums text-gray-400">
              {orders.total} active
            </span>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <CollectionMyOrdersStandaloneBody {...bodyProps} />
      </div>
      {changeBidModal}
    </section>
  );
}
