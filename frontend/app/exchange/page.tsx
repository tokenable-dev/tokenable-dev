"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  getActiveOrders,
  getMarketplaceCollections,
  postMarketplaceCollectionSnapshotsBatched,
  type CollectionListMarketSnapshot,
  type MarketplaceCollectionSummary,
  type Order,
} from "@/lib/api";
import { CollectionCoverFrame } from "@/components/marketplace/CollectionCoverFrame";
import { CollectionCategoryFilterBar } from "@/components/marketplace/CollectionCategoryFilterBar";
import { CollectionListSparkline } from "@/components/marketplace/CollectionListSparkline";
import {
  collectionMatchesCategoryFilter,
  type CollectionCategoryFilterId,
} from "@/lib/collectionCategoryFilter";
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

function formatUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function CollectionRow({
  collection,
  rank,
  floorPrice,
  listingCount,
  snapshot,
}: {
  collection: MarketplaceCollectionSummary;
  rank: number;
  floorPrice: number | null;
  listingCount: number;
  snapshot: CollectionListMarketSnapshot | undefined;
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

  const pct = snapshot?.marketChangePct;
  const category = snapshot?.categoryLabel;
  const g = snapshot?.gradePrices;

  return (
    <Link
      href={`/marketplace/collections/${encodeURIComponent(collection.collectionKey)}`}
      className="group flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3.5 sm:py-4 rounded-2xl border border-gray-800/50 bg-[#0d0d0d] transition-colors hover:border-gray-700/80 hover:bg-[#121212]"
    >
      <div className="relative shrink-0 w-[72px] sm:w-[84px]">
        <div className="absolute left-1.5 top-1.5 z-10 flex h-6 min-w-[1.5rem] items-center justify-center rounded-md bg-emerald-500 px-1.5 text-[11px] font-bold text-black shadow-sm">
          {rank}
        </div>
        {collection.coverImageUrl ? (
          <div className="aspect-[3/4] w-full overflow-hidden rounded-xl border border-gray-800/80">
            <CollectionCoverFrame
              imageUrl={collection.coverImageUrl}
              variant="compact"
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="aspect-[3/4] w-full rounded-xl border border-gray-800 bg-gray-900" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 gap-y-1.5">
          <h3 className="max-w-[min(100%,260px)] truncate text-[15px] sm:text-base font-bold text-white transition-colors group-hover:text-emerald-300/95 sm:max-w-none">
            {collection.displayLabel}
          </h3>
          {pct != null && Number.isFinite(pct) ? (
            <span
              className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                pct >= 0
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-rose-500/15 text-rose-300"
              }`}
            >
              <span aria-hidden>{pct >= 0 ? "↗" : "↘"}</span>
              {pct >= 0 ? "+" : ""}
              {pct.toFixed(2)}%
            </span>
          ) : null}
          {category ? (
            <span className="inline-flex shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-200/90">
              {category}
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 text-xs leading-snug text-gray-500">
          <span className="tabular-nums">PSA 10: {formatUsd(g?.psa10)}</span>
          <span className="mx-1.5 text-gray-700">·</span>
          <span className="tabular-nums">PSA 9: {formatUsd(g?.psa9)}</span>
          <span className="mx-1.5 text-gray-700">·</span>
          <span className="tabular-nums">Raw: {formatUsd(g?.raw)}</span>
          {floorPrice != null ? (
            <>
              <span className="mx-1.5 text-gray-700">·</span>
              <span className="text-gray-600">Floor</span>{" "}
              <span className="tabular-nums text-gray-400">
                ${floorPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </>
          ) : null}
        </p>
        {subtitle ? (
          <p className="mt-1 truncate text-[11px] text-gray-600">{subtitle}</p>
        ) : null}
        <p className="mt-1 text-[11px] text-gray-600 tabular-nums">
          {listingCount} listing{listingCount === 1 ? "" : "s"}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <CollectionListSparkline
          points={snapshot?.sparklineUsd}
          positive={pct == null ? undefined : pct >= 0}
        />
      </div>
    </Link>
  );
}

export default function ExchangePage() {
  const [categoryFilter, setCategoryFilter] = useState<CollectionCategoryFilterId>("all");
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
        const k = key.toLowerCase();
        const existing = map.get(k);
        if (existing === undefined || price < existing) {
          map.set(k, price);
        }
      } catch {
        /* skip */
      }
    }
    return map;
  }, [orders]);

  const sortedForRank = useMemo(() => {
    return [...collectionsWithListings].sort((a, b) => {
      const fa = floorPrices.get(a.collectionKey.toLowerCase()) ?? -1;
      const fb = floorPrices.get(b.collectionKey.toLowerCase()) ?? -1;
      if (fb !== fa) return fb - fa;
      return a.displayLabel.localeCompare(b.displayLabel);
    });
  }, [collectionsWithListings, floorPrices]);

  const snapshotKeys = useMemo(
    () => sortedForRank.map((c) => c.collectionKey),
    [sortedForRank],
  );

  const { data: snapshotPack } = useQuery({
    queryKey: ["marketplace-collection-snapshots", snapshotKeys.join("|")],
    queryFn: () =>
      postMarketplaceCollectionSnapshotsBatched(snapshotKeys, "30d"),
    enabled: snapshotKeys.length > 0 && !isLoading,
    staleTime: 60_000,
  });

  const snapshotByKey = useMemo(() => {
    const m = new Map<string, CollectionListMarketSnapshot>();
    for (const it of snapshotPack?.items ?? []) {
      m.set(it.collectionKey.toLowerCase(), it);
    }
    return m;
  }, [snapshotPack]);

  const orphanAsks = orders.filter(
    (o) => o.side !== "bid" && (!o.collectionKey || !String(o.collectionKey).trim()),
  );

  const filteredSorted = useMemo(() => {
    return sortedForRank.filter((c) =>
      collectionMatchesCategoryFilter(
        categoryFilter,
        c,
        snapshotByKey.get(c.collectionKey.toLowerCase()),
      ),
    );
  }, [sortedForRank, snapshotByKey, categoryFilter]);

  return (
    <div className="min-h-screen bg-black text-white">
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
          <h2 className="text-lg font-bold mb-3">Card Trading List</h2>
          {!isLoading && collectionsWithListings.length > 0 ? (
            <div className="mb-4">
              <CollectionCategoryFilterBar value={categoryFilter} onChange={setCategoryFilter} />
            </div>
          ) : null}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-28 bg-gray-800/60 rounded-2xl animate-pulse"
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
        ) : filteredSorted.length === 0 && collectionsWithListings.length > 0 ? (
          <div className="rounded-2xl border border-gray-800/80 bg-[#0d0d0d] px-6 py-12 text-center">
            <p className="text-sm text-gray-400">
              No collections match this category yet.
            </p>
            <p className="mt-2 text-xs text-gray-600">
              Categories use JustTCG game data and listing text — try ALL or Others.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSorted.map((c, i) => (
              <CollectionRow
                key={c.collectionKey}
                rank={i + 1}
                collection={c}
                floorPrice={floorPrices.get(c.collectionKey.toLowerCase()) ?? null}
                listingCount={c.activeListingCount}
                snapshot={snapshotByKey.get(c.collectionKey.toLowerCase())}
              />
            ))}
            {categoryFilter === "all" && orphanAsks.length > 0 && (
              <Link
                href="/marketplace/other-listings"
                className="group flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3.5 sm:py-4 rounded-2xl border border-gray-800/50 bg-[#0d0d0d] transition-colors hover:border-gray-700/80 hover:bg-[#121212]"
              >
                <div className="shrink-0 w-9 h-9 flex items-center justify-center text-gray-600 text-sm">
                  ○
                </div>
                <div className="flex h-[96px] sm:h-[112px] w-[72px] sm:w-[84px] shrink-0 items-center justify-center rounded-xl border border-gray-700/50 bg-gray-800/60 text-gray-600 text-sm">
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
