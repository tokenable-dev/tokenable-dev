"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getActiveOrders,
  getMarketplaceCollections,
} from "@/lib/api";
import { CollectionBrowseCard } from "./CollectionBrowseCard";
import { MarketplaceOrderCard } from "./MarketplaceOrderCard";

import { useShallow } from "zustand/react/shallow";
import { useAppStore, selectWallet, selectUsdcBalance } from "@/store";

function UsdcBalanceBanner() {
  const { usdcBalanceFormatted } = useAppStore(useShallow(selectUsdcBalance));

  return (
    <div className="flex items-center justify-between mb-5 px-4 py-2.5 bg-gray-900/60 border border-gray-800 rounded-xl text-sm">
      <span className="text-gray-400">
        My USDC Balance:{" "}
        <span className="text-white font-semibold">
          {parseFloat(usdcBalanceFormatted).toLocaleString()} USDC
        </span>
      </span>
      <a
        href="https://faucet.circle.com"
        target="_blank"
        rel="noopener noreferrer"
        className="ml-4 px-3 py-1 text-xs font-semibold bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
      >
        Get Sepolia USDC →
      </a>
    </div>
  );
}

export function Marketplace() {
  const { address, isConnected } = useAppStore(useShallow(selectWallet));

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["marketplace-orders"],
    queryFn: getActiveOrders,
    refetchInterval: 15_000,
  });

  const { data: collectionSummaries = [], isLoading: colLoading } = useQuery({
    queryKey: ["marketplace-collections"],
    queryFn: getMarketplaceCollections,
    refetchInterval: 15_000,
  });

  const isLoading = ordersLoading || colLoading;

  const askOrders = orders.filter((o) => o.side !== "bid");
  const orphanAsks = askOrders.filter(
    (o) => !o.collectionKey || !String(o.collectionKey).trim()
  );

  const collectionsWithListings = collectionSummaries.filter(
    (c) => c.activeListingCount > 0
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-36 bg-gray-800/80 rounded-2xl animate-pulse border border-gray-800"
          />
        ))}
      </div>
    );
  }

  const hasCollectionCards = collectionsWithListings.length > 0;
  const hasOther = orphanAsks.length > 0;
  const hasAnything = hasCollectionCards || hasOther;

  if (!hasAnything) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 mb-2">No NFTs listed for sale yet.</p>
        <p className="text-sm text-gray-600">
          Mint and list your NFTs from the My NFTs tab.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isConnected && address && <UsdcBalanceBanner />}
      <p className="text-xs text-gray-500">
        Choose a collection to see listed cards. Listings are grouped by graded
        metadata (same card &amp; grade).
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {collectionsWithListings.map((c) => (
          <CollectionBrowseCard
            key={c.collectionKey}
            collectionKey={c.collectionKey}
            displayLabel={c.displayLabel}
            listingCount={c.activeListingCount}
            coverImageUrl={c.coverImageUrl ?? null}
          />
        ))}
        {hasOther && (
          <CollectionBrowseCard
            collectionKey=""
            displayLabel="Other listings (no collection metadata)"
            listingCount={orphanAsks.length}
            variant="other"
          />
        )}
      </div>
    </div>
  );
}
