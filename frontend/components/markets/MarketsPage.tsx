"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useMarketplaceCollectionsInfinite } from "@/hooks/marketplace";
import { useMarketsOrders, useMarketsSnapshots } from "@/hooks/markets/useMarketsPageData";
import { useResolvedMediaUrlMap } from "@/hooks/media";
import { CollectionCategoryFilterBar } from "@/components/marketplace/markets-ui";
import { GatedSellLink } from "@/components/auth/GatedSellLink";
import {
  collectionMatchesCategoryFilter,
  MARKET_PRICE_CHANGE_SNAPSHOT_DURATION,
  MARKETS_CATEGORY_FILTERS,
  MARKETS_DEFAULT_CATEGORY_FILTER,
  type CollectionCategoryFilterId,
} from "@/lib/market";
import {
  collectionKeyLower,
  compareMarketsCollections,
  MARKETS_DEFAULT_SORT_ID,
  type MarketsSortId,
} from "@/lib/markets/marketsCollectionSort";
import { CollectionGridCard } from "./CollectionGridCard";
import { MarketsSortToolbar } from "./MarketsSortToolbar";
import { TOP_CARDS_UI_ENABLED, TOP_MOVERS_UI_ENABLED } from "@/lib/markets/top100Copy";
import { pickCollectionSummaryDisplayImageUrl } from "@/lib/marketplace/collectionDisplayImage";
import { CardTop100Section } from "./CardTop100Section";
import { TopMoversSection } from "./TopMoversSection";

export default function MarketsPage() {
  const [categoryFilter, setCategoryFilter] = useState<CollectionCategoryFilterId>(
    MARKETS_DEFAULT_CATEGORY_FILTER,
  );
  const [sortId, setSortId] = useState<MarketsSortId>(MARKETS_DEFAULT_SORT_ID);

  const ordersQuery = useMarketsOrders();
  const orders = ordersQuery.orders;

  const colInfinite = useMarketplaceCollectionsInfinite();
  const {
    data: colPages,
    isLoading: colInitialLoading,
    isFetching: colFetching,
    isError: colLoadError,
    error: colError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = colInfinite;

  const collectionSummaries = useMemo(
    () => colPages?.pages.flatMap((p) => p.items) ?? [],
    [colPages],
  );

  const coverRawUrls = useMemo(
    () => collectionSummaries.map((c) => pickCollectionSummaryDisplayImageUrl(c)),
    [collectionSummaries],
  );
  const { map: resolvedCoverMap } = useResolvedMediaUrlMap(coverRawUrls, {
    enabled: collectionSummaries.length > 0,
  });

  const ordersInitialLoading = ordersQuery.isLoading;
  const isInitialLoading = ordersInitialLoading || colInitialLoading;
  const loadFailed = ordersQuery.isError || colLoadError;
  const loadError = ordersQuery.error ?? colError ?? null;
  const showLoadingShell = isInitialLoading && !loadFailed;

  const snapshotKeysSorted = useMemo(() => {
    const u = new Set<string>();
    for (const c of collectionSummaries) {
      const k = c.collectionKey?.trim().toLowerCase();
      if (k) u.add(k);
    }
    return [...u].sort();
  }, [collectionSummaries]);

  const { snapshotByKey, isPending: snapshotsPending } = useMarketsSnapshots(
    snapshotKeysSorted,
    !isInitialLoading,
  );

  const showMarketSnapshotLoadingBar =
    snapshotKeysSorted.length > 0 && !isInitialLoading && snapshotsPending;

  const sortedForRank = useMemo(() => {
    return [...collectionSummaries].sort((a, b) =>
      compareMarketsCollections(a, b, sortId, snapshotByKey),
    );
  }, [collectionSummaries, snapshotByKey, sortId]);

  const orphanAsks = orders.filter(
    (o) => o.side !== "bid" && (!o.collectionKey || !String(o.collectionKey).trim()),
  );

  const filteredSorted = useMemo(() => {
    return sortedForRank.filter((c) =>
      collectionMatchesCategoryFilter(
        categoryFilter,
        c,
        snapshotByKey.get(collectionKeyLower(c)),
      ),
    );
  }, [sortedForRank, snapshotByKey, categoryFilter]);

  if (loadFailed) {
    const msg =
      loadError instanceof Error ? loadError.message : String(loadError ?? "Unknown error");
    return (
      <div className="min-h-screen min-w-0 overflow-x-clip bg-black text-white">
        <div className="mx-auto w-full max-w-6xl min-w-0 px-4 py-16 sm:px-6">
          <h1 className="text-lg font-semibold text-red-400">Markets — API unavailable</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Could not reach the backend at{" "}
            <code className="rounded bg-zinc-900 px-1 text-mint">{process.env.NEXT_PUBLIC_API_URL ?? "/api"}</code>. Start the
            Nest server (in <code className="text-zinc-300">backend/</code>, run{" "}
            <code className="text-zinc-300">pnpm start:dev</code>) and confirm Postgres is up.
          </p>
          <p className="mt-4 text-xs text-zinc-500">{msg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-w-0 overflow-x-clip bg-black text-white">
      <div className="mx-auto w-full max-w-6xl min-w-0 px-3 pb-20 pt-8 max-[380px]:px-2 sm:px-6 sm:pb-24 sm:pt-12">
        {(TOP_CARDS_UI_ENABLED || TOP_MOVERS_UI_ENABLED) ? (
          <>
            <div
              className={
                TOP_CARDS_UI_ENABLED && TOP_MOVERS_UI_ENABLED
                  ? "mb-10 grid grid-cols-1 gap-8 lg:mb-4 lg:grid-cols-2 lg:gap-6 xl:gap-8"
                  : "mb-10 sm:mb-4"
              }
            >
              {TOP_CARDS_UI_ENABLED ? (
                <Suspense
                  fallback={
                    <div className="h-64 animate-pulse rounded-2xl border border-zinc-800/50 bg-[#0d0d0d]" />
                  }
                >
                  <CardTop100Section variant="preview" />
                </Suspense>
              ) : null}
              {TOP_MOVERS_UI_ENABLED ? (
                <Suspense
                  fallback={
                    <div className="h-64 animate-pulse rounded-2xl border border-zinc-800/50 bg-[#0d0d0d]" />
                  }
                >
                  <TopMoversSection />
                </Suspense>
              ) : null}
            </div>

            <div
              className="mb-6 border-t border-white/[0.06] pt-8 sm:mb-5 sm:pt-4"
              aria-hidden
            />
          </>
        ) : null}

        {!showLoadingShell && sortedForRank.length > 0 ? (
          <>
            <div className="mb-3 flex items-center justify-between gap-3 sm:mb-5">
              <div className="min-w-0">
                <h2 className="min-w-0 text-xl font-bold leading-tight tracking-tight text-white sm:text-2xl">
                  All Collections
                </h2>
              </div>
              <MarketsSortToolbar
                className="inline-flex sm:hidden"
                sortId={sortId}
                onSortChange={setSortId}
              />
            </div>
            <div className="mb-4 sm:mb-4 sm:flex sm:flex-nowrap sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0 w-full sm:flex-1">
                <CollectionCategoryFilterBar
                  filters={MARKETS_CATEGORY_FILTERS}
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  toolbarAriaLabel="Filter all collections by category"
                />
              </div>
              <MarketsSortToolbar
                className="hidden sm:inline-flex"
                sortId={sortId}
                onSortChange={setSortId}
              />
            </div>
          </>
        ) : null}

        {showMarketSnapshotLoadingBar ? (
          <div
            className="mb-6 space-y-2 sm:mb-8"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <p className="text-center text-xs text-zinc-500 sm:text-left">
              Loading listing pool stats and charts…
            </p>
            <div
              className="relative h-1.5 w-full overflow-hidden rounded-full bg-zinc-800/90"
              aria-hidden
            >
              <div className="absolute left-0 top-0 h-full w-[32%] rounded-full bg-mint/90 shadow-[0_0_14px_rgba(16,211,51,0.4)] exchange-snapshot-loading-fill" />
            </div>
          </div>
        ) : null}

        {showLoadingShell ? (
          <div className="space-y-5">
            <p className="text-center text-sm text-zinc-500" role="status" aria-live="polite">
              Loading collections and listings…
              {colFetching || ordersQuery.isFetching
                ? " (waiting for backend — check terminal for GET /api/marketplace/… logs)"
                : ""}
            </p>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-44 animate-pulse rounded-2xl bg-gray-800/60 sm:h-52"
              />
            ))}
          </div>
        ) : sortedForRank.length === 0 && orphanAsks.length === 0 ? (
          <div className="py-16 text-center">
            <p className="mb-2 text-base text-gray-500 sm:text-lg">No assets listed for sale yet.</p>
            <p className="text-sm text-gray-600 sm:text-base">
              Mint and list your assets from{" "}
              <GatedSellLink className="text-mint hover:underline">
                Vault
              </GatedSellLink>
              .
            </p>
          </div>
        ) : filteredSorted.length === 0 && sortedForRank.length > 0 ? (
          <div className="rounded-2xl border border-gray-800/80 bg-[#0d0d0d] px-6 py-12 text-center">
            <p className="text-base text-gray-400 sm:text-lg">
              No collections match this category yet.
            </p>
            <p className="mt-2 text-sm text-gray-600 sm:text-base">
              Categories use listing text and snapshot metadata — try ALL or another category.
            </p>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-2 gap-2.5 pt-1 min-[400px]:gap-3 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
            {filteredSorted.map((c) => {
              const displayImageUrl = pickCollectionSummaryDisplayImageUrl(c);
              return (
              <CollectionGridCard
                key={c.collectionKey}
                collection={c}
                snapshot={snapshotByKey.get(collectionKeyLower(c))}
                resolvedCoverUrl={
                  displayImageUrl ? resolvedCoverMap.get(displayImageUrl) : undefined
                }
                listingCount={c.activeListingCount}
                marketChangeLoading={showMarketSnapshotLoadingBar}
              />
            );
            })}
            {hasNextPage ? (
              <div className="col-span-full flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => void fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="rounded-xl border border-zinc-700 bg-zinc-900/80 px-5 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                >
                  {isFetchingNextPage ? "Loading…" : "Load more collections"}
                </button>
              </div>
            ) : null}
          </div>
          {categoryFilter === "all" && orphanAsks.length > 0 ? (
            <div className="mt-6 sm:mt-7">
              <Link
                href="/marketplace/other-listings"
                className="group flex flex-col gap-4 rounded-2xl border border-gray-800/50 bg-[#0d0d0d] px-4 py-4 transition-colors hover:border-gray-700/80 hover:bg-[#121212] sm:flex-row sm:items-center sm:gap-6 sm:px-6 sm:py-6"
              >
                <div className="flex items-center gap-4 sm:contents">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center text-lg text-gray-600 sm:order-none">
                    ○
                  </div>
                  <div className="flex aspect-[3/4] w-[min(108px,28vw)] shrink-0 items-center justify-center rounded-2xl border border-gray-700/50 bg-gray-800/60 text-xl text-gray-600 sm:w-[136px]">
                    ?
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold leading-snug text-gray-300 transition-colors group-hover:text-mint sm:text-2xl">
                    Other Listings
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 sm:text-lg">
                    No collection metadata
                  </p>
                  <p className="mt-2 flex items-center justify-between text-sm text-zinc-500 sm:hidden">
                    <span>
                      <span className="text-zinc-500">Orders </span>
                      <span className="font-bold text-white">{orphanAsks.length}</span>
                    </span>
                    <span className="text-zinc-500 transition-colors group-hover:text-mint" aria-hidden>
                      →
                    </span>
                  </p>
                </div>
                <div className="hidden text-base sm:block sm:text-lg">
                  <span className="text-gray-500">Orders </span>
                  <span className="font-bold text-white">{orphanAsks.length}</span>
                </div>
                <span className="hidden shrink-0 text-xl text-gray-600 transition-colors group-hover:text-mint sm:inline sm:text-2xl">
                  →
                </span>
              </Link>
            </div>
          ) : null}
          </>
        )}
      </div>

    </div>
  );
}
