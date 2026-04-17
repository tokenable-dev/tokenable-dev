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
import {
  computeCollectionMarketCapUsd,
  formatMarketCapUsd,
} from "@/lib/gradedCardMarketCap";
import { useShallow } from "zustand/react/shallow";
import { useAppStore, selectWallet, selectUsdcBalance } from "@/store";

const USDC_DECIMALS = 1_000_000;

function useMarketStats(
  orders: Order[],
  viewerAddress: string | null | undefined,
) {
  return useMemo(() => {
    const viewer = viewerAddress?.trim().toLowerCase() ?? "";
    const askOrders = orders.filter((o) => String(o.side ?? "ask").toLowerCase() !== "bid");
    const myAsks = viewer
      ? askOrders.filter((o) => String(o.offerer).toLowerCase() === viewer)
      : [];

    let totalValueMicros = BigInt(0);
    for (const o of myAsks) {
      try {
        totalValueMicros += BigInt(o.considerationAmount ?? "0");
      } catch {
        /* skip */
      }
    }
    const totalValue = Number(totalValueMicros) / USDC_DECIMALS;
    const totalListings = myAsks.length;
    const collectionKeys = new Set<string>();
    for (const o of myAsks) {
      const ck = o.collectionKey?.trim();
      if (ck) collectionKeys.add(ck.toLowerCase());
    }
    const totalCollections = collectionKeys.size;

    return {
      totalValue,
      totalListings,
      totalCollections,
      hasWallet: viewer.length > 0,
    };
  }, [orders, viewerAddress]);
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
    <div className="rounded-2xl border border-gray-800 bg-gray-900/50 px-5 py-7 text-center sm:px-6 sm:py-8">
      <p className="mb-3 text-sm font-medium text-gray-400 sm:text-base">{label}</p>
      <p className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
        {value}
      </p>
      {sub && (
        <p className="mt-2 text-sm font-semibold text-mint sm:text-base">{sub}</p>
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
  listingCount,
  snapshot,
}: {
  collection: MarketplaceCollectionSummary;
  listingCount: number;
  snapshot: CollectionListMarketSnapshot | undefined;
}) {
  const comp = collection.components as {
    cardName?: string;
    gradeScore?: string;
    gradingCompany?: string;
    cardSet?: string;
    cardNumber?: string;
    psaTotalPopulation?: number;
  };

  const marketCap = computeCollectionMarketCapUsd({
    components: collection.components as Record<string, unknown>,
    gradeScoreStr: comp.gradeScore,
    poketraceCard: null,
    gradePrices: snapshot?.gradePrices ?? null,
  });

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
      className="group flex items-center gap-5 rounded-2xl border border-gray-800/50 bg-[#0d0d0d] px-5 py-5 transition-colors hover:border-gray-700/80 hover:bg-[#121212] sm:gap-6 sm:px-6 sm:py-6"
    >
      <div className="relative w-[108px] shrink-0 sm:w-[136px]">
        {collection.coverImageUrl ? (
          <div className="aspect-[3/4] w-full overflow-hidden rounded-2xl border border-gray-800/80">
            <CollectionCoverFrame
              imageUrl={collection.coverImageUrl}
              variant="compact"
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="aspect-[3/4] w-full rounded-2xl border border-gray-800 bg-gray-900" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-xl font-bold text-white transition-colors group-hover:text-emerald-300/95 sm:text-2xl">
          {collection.displayLabel}
        </h3>
        {(pct != null && Number.isFinite(pct)) || category ? (
          <div className="mt-2 flex flex-wrap items-start gap-x-2 gap-y-2 sm:gap-x-3">
            {pct != null && Number.isFinite(pct) ? (
              <span
                className={`inline-flex w-fit shrink-0 items-center gap-0.5 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums sm:text-base ${
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
              <span className="inline-flex shrink-0 rounded-full bg-amber-500/15 px-3 py-1.5 text-sm font-medium text-amber-200/90 sm:text-base">
                {category}
              </span>
            ) : null}
          </div>
        ) : null}
        <p className="mt-2.5 text-base leading-snug text-gray-500 sm:text-lg">
          <span className="tabular-nums">PSA 10: {formatUsd(g?.psa10)}</span>
          <span className="mx-2 text-gray-700">·</span>
          <span className="tabular-nums">PSA 9: {formatUsd(g?.psa9)}</span>
          {marketCap.usd != null ? (
            <>
              <span className="mx-2 text-gray-700">·</span>
              <span className="text-gray-600">Market cap</span>{" "}
              <span className="tabular-nums text-emerald-400/95">
                {formatMarketCapUsd(marketCap.usd)}
              </span>
            </>
          ) : null}
        </p>
        {subtitle ? (
          <p className="mt-2 truncate text-sm text-gray-600 sm:text-base">{subtitle}</p>
        ) : null}
        <p className="mt-2 text-sm text-gray-600 tabular-nums sm:text-base">
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
  const stats = useMarketStats(orders, address);

  const collectionsWithListings = collectionSummaries.filter(
    (c) => c.activeListingCount > 0,
  );

  /** Oldest collection buckets first (stable for “what listed first”). */
  const sortedForRank = useMemo(() => {
    return [...collectionsWithListings].sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      if (ta !== tb) return ta - tb;
      return a.displayLabel.localeCompare(b.displayLabel);
    });
  }, [collectionsWithListings]);

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
          <h1 className="mb-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
            RWA Exchange
          </h1>
          <p className="text-base text-gray-400 sm:text-lg">
            Real-world assets tokenized on-chain
          </p>
        </div>

        {/* Stats */}
        <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
          <StatCard
            label="Total Market CAP"
            value={
              stats.hasWallet
                ? stats.totalValue > 0
                  ? `$${stats.totalValue >= 1000 ? `${(stats.totalValue / 1000).toFixed(1)}K` : stats.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                  : "$0"
                : "—"
            }
            sub={
              stats.hasWallet
                ? stats.totalListings > 0
                  ? stats.totalCollections > 0
                    ? `${stats.totalCollections} collection${stats.totalCollections === 1 ? "" : "s"} · your asks`
                    : `${stats.totalListings} listing${stats.totalListings === 1 ? "" : "s"} · your asks`
                  : "No active listings"
                : "Connect wallet"
            }
          />
          <StatCard
            label="Active Listings"
            value={stats.hasWallet ? stats.totalListings.toString() : "—"}
            sub={stats.hasWallet ? "Your listings" : "Connect wallet"}
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
          <h2 className="mb-3 text-2xl font-bold sm:text-3xl">Card Trading List</h2>
          {!isLoading && collectionsWithListings.length > 0 ? (
            <div className="mb-4">
              <CollectionCategoryFilterBar value={categoryFilter} onChange={setCategoryFilter} />
            </div>
          ) : null}
        </div>

        {isLoading ? (
          <div className="space-y-5">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-44 animate-pulse rounded-2xl bg-gray-800/60 sm:h-52"
              />
            ))}
          </div>
        ) : collectionsWithListings.length === 0 && orphanAsks.length === 0 ? (
          <div className="py-16 text-center">
            <p className="mb-2 text-base text-gray-500 sm:text-lg">No assets listed for sale yet.</p>
            <p className="text-sm text-gray-600 sm:text-base">
              Mint and list your assets from{" "}
              <Link href="/vault" className="text-mint hover:underline">
                Vault
              </Link>
              .
            </p>
          </div>
        ) : filteredSorted.length === 0 && collectionsWithListings.length > 0 ? (
          <div className="rounded-2xl border border-gray-800/80 bg-[#0d0d0d] px-6 py-12 text-center">
            <p className="text-base text-gray-400 sm:text-lg">
              No collections match this category yet.
            </p>
            <p className="mt-2 text-sm text-gray-600 sm:text-base">
              Categories use JustTCG game data and listing text — try ALL or Others.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {filteredSorted.map((c) => (
              <CollectionRow
                key={c.collectionKey}
                collection={c}
                listingCount={c.activeListingCount}
                snapshot={snapshotByKey.get(c.collectionKey.toLowerCase())}
              />
            ))}
            {categoryFilter === "all" && orphanAsks.length > 0 && (
              <Link
                href="/marketplace/other-listings"
                className="group flex items-center gap-5 rounded-2xl border border-gray-800/50 bg-[#0d0d0d] px-5 py-5 transition-colors hover:border-gray-700/80 hover:bg-[#121212] sm:gap-6 sm:px-6 sm:py-6"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center text-lg text-gray-600">
                  ○
                </div>
                <div className="flex aspect-[3/4] w-[108px] shrink-0 items-center justify-center rounded-2xl border border-gray-700/50 bg-gray-800/60 text-xl text-gray-600 sm:w-[136px]">
                  ?
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xl font-bold text-gray-300 transition-colors group-hover:text-mint sm:text-2xl">
                    Other Listings
                  </h3>
                  <p className="mt-1.5 text-base text-gray-500 sm:text-lg">
                    No collection metadata
                  </p>
                </div>
                <div className="hidden text-base sm:block sm:text-lg">
                  <span className="text-gray-500">Orders </span>
                  <span className="font-bold text-white">{orphanAsks.length}</span>
                </div>
                <span className="shrink-0 text-xl text-gray-600 transition-colors group-hover:text-mint sm:text-2xl">
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
