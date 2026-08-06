"use client";

import Link from "next/link";
import { MarketplaceOrderBook } from "@/components/marketplace/other-order-book";
import { useMarketsOrders } from "@/hooks/markets/useMarketsPageData";

export default function MarketplaceOtherListingsPage() {
  const { orders, isPending } = useMarketsOrders();

  const asks = orders.filter((o) => o.side !== "bid");
  const orphan = asks.filter((o) => !o.collectionKey || !String(o.collectionKey).trim());

  if (isPending) {
    return (
      <div className="tkl-wrap mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto h-80 max-w-4xl animate-pulse rounded-xl bg-white/5" />
      </div>
    );
  }

  return (
    <div className="min-h-screen min-w-0 overflow-x-clip">
      <div className="tkl-wrap mx-auto max-w-6xl px-4 py-8 pb-20 sm:px-6">
        <Link
          href="/markets"
          className="mb-6 inline-flex min-h-11 items-center text-sm text-[var(--azure)] hover:text-[#fff]"
        >
          ← Back to Markets
        </Link>

        <header className="mb-8 border-b border-white/10 pb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--t3)]">
            Ungrouped
          </p>
          <h1 className="text-2xl font-extrabold text-[#fff]">Other listings</h1>
          <p className="mt-2 text-sm text-[var(--t2)]">
            Active listings without complete collection metadata.
          </p>
        </header>

        {orphan.length === 0 ? (
          <p className="py-8 text-sm text-[var(--t2)]">No ungrouped listings.</p>
        ) : (
          <div className="flex justify-center overflow-x-auto">
            <MarketplaceOrderBook
              orders={orphan}
              variant="full"
              subtitle="Ungrouped asks · tap a row for asset detail"
            />
          </div>
        )}
      </div>
    </div>
  );
}
