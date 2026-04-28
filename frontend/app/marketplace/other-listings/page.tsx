"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getActiveOrders, rq, marketplaceRqPolicy } from "@/lib/core";
import { MarketplaceOrderBook } from "@/components/marketplace/MarketplaceOrderBook";

export default function MarketplaceOtherListingsPage() {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: rq.ordersActive(),
    queryFn: getActiveOrders,
    refetchInterval: marketplaceRqPolicy.ordersRefetchMs,
    staleTime: marketplaceRqPolicy.ordersStaleMs,
  });

  const asks = orders.filter((o) => o.side !== "bid");
  const orphan = asks.filter((o) => !o.collectionKey || !String(o.collectionKey).trim());

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="h-80 max-w-4xl mx-auto bg-gray-800/80 rounded-xl animate-pulse border border-gray-800" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-20">
        <Link
          href="/markets"
          className="inline-flex text-sm text-mint/90 hover:text-mint mb-6"
        >
          ← Back to Markets
        </Link>

        <header className="mb-8 border-b border-gray-800 pb-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
            Ungrouped
          </p>
          <h1 className="text-2xl font-extrabold text-white">Other listings</h1>
          <p className="mt-2 text-sm text-gray-500">
            Active listings without complete collection metadata.
          </p>
        </header>

        {orphan.length === 0 ? (
          <p className="text-gray-500 text-sm py-8">No ungrouped listings.</p>
        ) : (
          <div className="flex justify-center">
            <MarketplaceOrderBook
              orders={orphan}
              variant="full"
              subtitle="Ungrouped asks · click a row for asset detail"
            />
          </div>
        )}
      </div>
    </div>
  );
}
