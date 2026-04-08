"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  getActiveOrders,
  getMarketplaceCollections,
  type MarketplaceCollectionSummary,
  type Order,
} from "@/lib/api";
import { CollectionCoverFrame } from "@/components/marketplace/CollectionCoverFrame";
import { useShallow } from "zustand/react/shallow";
import { useAppStore, selectWallet, selectUsdcBalance } from "@/store";

const USDC_DECIMALS = 1_000_000;

function useMarketStats(
  orders: Order[],
  collections: MarketplaceCollectionSummary[],
) {
  return useMemo(() => {
    const askOrders = orders.filter((o) => o.side !== "bid");
    let totalValueMicros = BigInt(0);
    for (const o of askOrders) {
      try {
        totalValueMicros += BigInt(o.considerationAmount ?? "0");
      } catch {
        /* skip */
      }
    }
    const totalValue = Number(totalValueMicros) / USDC_DECIMALS;
    const totalListings = askOrders.length;
    const totalCollections = collections.filter(
      (c) => c.activeListingCount > 0,
    ).length;
    return { totalValue, totalListings, totalCollections };
  }, [orders, collections]);
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/50 px-5 py-6 text-center">
      <p className="text-xs text-gray-400 mb-3 font-medium">{label}</p>
      <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
        {value}
      </p>
      {sub && (
        <p className="mt-1.5 text-xs text-mint font-semibold">{sub}</p>
      )}
    </div>
  );
}

function CollectionRow({
  collection,
  floorPrice,
  listingCount,
}: {
  collection: MarketplaceCollectionSummary;
  floorPrice: number | null;
  listingCount: number;
}) {
  const comp = collection.components as {
    cardName?: string;
    gradeScore?: string;
    gradingCompany?: string;
    cardSet?: string;
    cardNumber?: string;
  };

  const subtitle = [
    comp.gradingCompany,
    comp.cardSet,
    comp.cardNumber ? `#${comp.cardNumber}` : null,
  ]
    .filter(Boolean)
    .join("  ");

  return (
    <Link
      href={`/marketplace/collections/${encodeURIComponent(collection.collectionKey)}`}
      className="group flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-colors hover:bg-gray-800/40"
    >
      <div className="shrink-0 w-8 h-8 flex items-center justify-center text-mint/60 text-sm">
        ★
      </div>

      {collection.coverImageUrl ? (
        <div className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 overflow-hidden rounded-lg">
          <CollectionCoverFrame
            imageUrl={collection.coverImageUrl}
            variant="compact"
            className="w-full h-full"
          />
        </div>
      ) : (
        <div className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gray-800 border border-gray-700" />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-[13px] font-bold text-white truncate group-hover:text-mint transition-colors">
            {collection.displayLabel}
          </h3>
        </div>
        {subtitle && (
          <p className="text-[11px] text-gray-500 mt-0.5 truncate">{subtitle}</p>
        )}
      </div>

      <div className="hidden sm:flex items-center gap-5 text-xs shrink-0">
        <div>
          <span className="text-gray-500">Price </span>
          <span className="font-bold text-white">
            {floorPrice !== null
              ? `$${floorPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
              : "—"}
          </span>
        </div>
        <div>
          <span className="text-gray-500">Orders </span>
          <span className="font-bold text-white">{listingCount}</span>
        </div>
      </div>

      <span className="shrink-0 text-gray-600 group-hover:text-mint transition-colors text-sm">
        →
      </span>
    </Link>
  );
}

export default function ExchangePage() {
  const { address, isConnected } = useAppStore(useShallow(selectWallet));
  const { usdcBalanceFormatted } = useAppStore(useShallow(selectUsdcBalance));

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
  const stats = useMarketStats(orders, collectionSummaries);

  const collectionsWithListings = collectionSummaries.filter(
    (c) => c.activeListingCount > 0,
  );

  const floorPrices = useMemo(() => {
    const map = new Map<string, number>();
    const askOrders = orders.filter((o) => o.side !== "bid");
    for (const o of askOrders) {
      const key = o.collectionKey;
      if (!key) continue;
      try {
        const price = Number(BigInt(o.considerationAmount ?? "0")) / USDC_DECIMALS;
        const existing = map.get(key);
        if (existing === undefined || price < existing) {
          map.set(key, price);
        }
      } catch {
        /* skip */
      }
    }
    return map;
  }, [orders]);

  const orphanAsks = orders.filter(
    (o) => o.side !== "bid" && (!o.collectionKey || !String(o.collectionKey).trim()),
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-20">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1">
            RWA Exchange
          </h1>
          <p className="text-sm text-gray-400">
            Real-world assets tokenized on-chain
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <StatCard
            label="Total Market CAP"
            value={`$${stats.totalValue >= 1000 ? `${(stats.totalValue / 1000).toFixed(1)}K` : stats.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            sub={`${stats.totalCollections} collections`}
          />
          <StatCard
            label="Active Listings"
            value={stats.totalListings.toString()}
            sub="Live"
          />
          <StatCard
            label="Available Liquidity"
            value={
              isConnected && address
                ? `${parseFloat(usdcBalanceFormatted).toLocaleString()} USDC`
                : "—"
            }
            sub={isConnected ? "Your balance" : "Connect wallet"}
          />
        </div>

        {/* Collection list */}
        <div className="mb-6">
          <h2 className="text-lg font-bold mb-4">Card Trading List</h2>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-20 bg-gray-800/60 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : collectionsWithListings.length === 0 && orphanAsks.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-2">No assets listed for sale yet.</p>
            <p className="text-sm text-gray-600">
              Mint and list your assets from{" "}
              <Link href="/vault" className="text-mint hover:underline">
                Vault
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-800 bg-gray-900/30 divide-y divide-gray-800/60">
            {collectionsWithListings.map((c) => (
              <CollectionRow
                key={c.collectionKey}
                collection={c}
                floorPrice={floorPrices.get(c.collectionKey) ?? null}
                listingCount={c.activeListingCount}
              />
            ))}
            {orphanAsks.length > 0 && (
              <Link
                href="/marketplace/other-listings"
                className="group flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-2.5 sm:py-3 transition-colors hover:bg-gray-800/40"
              >
                <div className="shrink-0 w-8 h-8 flex items-center justify-center text-gray-600 text-sm">
                  ○
                </div>
                <div className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gray-800/60 border border-gray-700/50 flex items-center justify-center text-gray-600 text-sm">
                  ?
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-gray-300 group-hover:text-mint transition-colors">
                    Other Listings
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    No collection metadata
                  </p>
                </div>
                <div className="hidden sm:block text-xs">
                  <span className="text-gray-500">Orders </span>
                  <span className="font-bold text-white">{orphanAsks.length}</span>
                </div>
                <span className="shrink-0 text-gray-600 group-hover:text-mint transition-colors">
                  →
                </span>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
