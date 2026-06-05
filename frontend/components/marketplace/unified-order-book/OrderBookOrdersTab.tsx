"use client";

import type { Order } from "@/lib/core";
import { CollectionMyOrdersEmbeddedBody } from "@/components/marketplace/collection-trading/CollectionMyOrdersEmbeddedBody";

export function OrderBookOrdersTab({
  flush,
  addr,
  total,
  myListings,
  myBids,
  cancelling,
  onCancel,
  onChangeBidPrice,
  isBidStale,
}: {
  flush?: boolean;
  addr: string;
  total: number;
  myListings: Order[];
  myBids: Order[];
  cancelling: string | null;
  onCancel: (orderHash: string) => void;
  onChangeBidPrice: (bid: Order) => void;
  isBidStale: (o: Order) => boolean;
}) {
  return (
    <div
      className={
        flush
          ? "flex h-full min-h-0 flex-1 flex-col overflow-hidden"
          : "min-h-[120px]"
      }
    >
      <div
        className={
          flush
            ? "min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-2.5 sm:px-3.5 sm:py-3"
            : "px-3 py-2.5 sm:px-3.5"
        }
      >
        <CollectionMyOrdersEmbeddedBody
          variant="orderBook"
          addr={addr}
          total={total}
          myListings={myListings}
          myBids={myBids}
          cancelling={cancelling}
          onCancel={onCancel}
          onChangeBidPrice={onChangeBidPrice}
          isBidStale={isBidStale}
        />
      </div>
    </div>
  );
}
