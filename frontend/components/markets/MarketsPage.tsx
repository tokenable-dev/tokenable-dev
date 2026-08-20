"use client";

import { Suspense, useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  useMarketplaceCollectionsInfinite,
  MARKETS_COLLECTIONS_PAGE_SIZE,
} from "@/hooks/marketplace";
import {
  useMarketsOrders,
  useMarketsSnapshots,
  useMarketsStableSortedCollections,
} from "@/hooks/markets/useMarketsPageData";
import { useMarketsInfiniteScroll } from "@/hooks/markets/useMarketsInfiniteScroll";
import { useResolvedMediaUrlMap } from "@/hooks/media";
import { GatedSellLink } from "@/components/auth/GatedSellLink";
import { HomeTicker } from "@/components/home/HomeTicker";
import {
  collectionMatchesCategoryFilter,
  MARKETS_CATEGORY_FILTERS,
  MARKETS_DEFAULT_CATEGORY_FILTER,
  type CollectionCategoryFilterId,
} from "@/lib/market";
import {
  collectionKeyLower,
  MARKETS_DEFAULT_SORT_ID,
  type MarketsSortId,
} from "@/lib/markets/marketsCollectionSort";
import {
  applyMarketsListingFilters,
  collectionVaultKindsFromAsks,
  type MarketsGradeFilterId,
  type MarketsVaultFilterId,
} from "@/lib/markets/marketsFilters";
import { MarketsFilterBar } from "./MarketsFilterBar";
import { MarketsPageHeader } from "./MarketsPageHeader";
import { MarketsP2pSection } from "./MarketsP2pSection";
import { MarketsCollectionGrid } from "./MarketsCollectionGrid";
import { TOP_CARDS_UI_ENABLED, TOP_MOVERS_UI_ENABLED } from "@/lib/markets/top100Copy";
import { pickCollectionSummaryDisplayImageUrl } from "@/lib/marketplace/collectionDisplayImage";
import {
  buildBrowseEntriesFromSummaries,
  saveCollectionBrowseContext,
} from "@/lib/marketplace/collectionBrowseContext";
import { CardTop100Section } from "./CardTop100Section";
import { TopMoversSection } from "./TopMoversSection";
import { AppPageState } from "@/components/ui/AppPageState";
import { cn } from "@/lib/ds/cn";
import { useClientMounted } from "@/hooks/ui/useClientMounted";
import { usePageViewedEvent } from "@/hooks/analytics/usePageViewedEvent";

export default function MarketsPage() {
  usePageViewedEvent("markets");
  const mounted = useClientMounted();
  const [categoryFilter, setCategoryFilter] = useState<CollectionCategoryFilterId>(
    MARKETS_DEFAULT_CATEGORY_FILTER,
  );
  const [sortId, setSortId] = useState<MarketsSortId>(MARKETS_DEFAULT_SORT_ID);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [gradeFilters, setGradeFilters] = useState<Set<MarketsGradeFilterId>>(new Set());
  const [vaultFilters, setVaultFilters] = useState<Set<MarketsVaultFilterId>>(new Set());
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);

  const toggleGradeFilter = useCallback((grade: MarketsGradeFilterId) => {
    setGradeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(grade)) next.delete(grade);
      else next.add(grade);
      return next;
    });
  }, []);

  const toggleVaultFilter = useCallback((id: MarketsVaultFilterId) => {
    setVaultFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const ordersQuery = useMarketsOrders();
  const orders = ordersQuery.orders;

  const colInfinite = useMarketplaceCollectionsInfinite();
  const {
    data: colPages,
    isPending: colInitialPending,
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

  const isInitialLoading = ordersQuery.isPending || colInitialPending;
  const loadFailed = ordersQuery.isError || colLoadError;
  const loadError = ordersQuery.error ?? colError ?? null;
  const showLoadingShell = !mounted || (isInitialLoading && !loadFailed);

  const snapshotKeysSorted = useMemo(() => {
    const u = new Set<string>();
    for (const c of collectionSummaries) {
      const k = c.collectionKey?.trim().toLowerCase();
      if (k) u.add(k);
    }
    return [...u].sort();
  }, [collectionSummaries]);

  const {
    snapshotByKey,
    isPending: snapshotsPending,
    isFetching: snapshotsFetching,
  } = useMarketsSnapshots(snapshotKeysSorted, !isInitialLoading);

  const showMarketSnapshotLoadingBar =
    snapshotKeysSorted.length > 0 && !isInitialLoading && snapshotsPending;

  const sortedForRank = useMarketsStableSortedCollections(
    collectionSummaries,
    snapshotByKey,
    sortId,
    snapshotsFetching,
  );

  const orphanAsks = orders.filter(
    (o) => o.side !== "bid" && (!o.collectionKey || !String(o.collectionKey).trim()),
  );

  const vaultKindsByKey = useMemo(
    () => collectionVaultKindsFromAsks(orders),
    [orders],
  );

  const filteredSorted = useMemo(() => {
    const categoryFiltered = sortedForRank.filter((c) =>
      collectionMatchesCategoryFilter(
        categoryFilter,
        c,
        snapshotByKey.get(collectionKeyLower(c)),
      ),
    );
    return applyMarketsListingFilters(categoryFiltered, snapshotByKey, {
      priceMin,
      priceMax,
      gradeFilters,
      vaultFilters,
      vaultKindsByKey,
    });
  }, [
    sortedForRank,
    snapshotByKey,
    categoryFilter,
    priceMin,
    priceMax,
    gradeFilters,
    vaultFilters,
    vaultKindsByKey,
  ]);

  useMarketsInfiniteScroll({
    sentinelRef: loadMoreSentinelRef,
    enabled: !showLoadingShell && sortedForRank.length > 0,
    hasNextPage: Boolean(hasNextPage),
    isFetchingNextPage,
    fetchNextPage: () => void fetchNextPage(),
  });

  if (loadFailed) {
    const msg =
      loadError instanceof Error ? loadError.message : String(loadError ?? "Unknown error");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api";
    return (
      <div className="markets-page">
        <HomeTicker />
        <div className="tkl-wrap py-16">
          <AppPageState
            kind="markets_load_failed"
            message={`Could not reach the backend at ${apiUrl}. Start the Nest server (in backend/, run pnpm start:dev) and confirm Postgres is up.`}
            primaryAction={{
              label: "Try again",
              onClick: () => window.location.reload(),
              variant: "primary",
            }}
            secondaryAction={{ label: "Portfolio", href: "/portfolio", variant: "neutral" }}
            details={process.env.NODE_ENV === "development" ? msg : null}
          />
        </div>
      </div>
    );
  }

  const showMainChrome =
    mounted && !showLoadingShell && sortedForRank.length > 0;

  return (
    <div className="markets-page">
      <HomeTicker />
      <MarketsPageHeader />
      <MarketsP2pSection />

      {(TOP_CARDS_UI_ENABLED || TOP_MOVERS_UI_ENABLED) && !showLoadingShell ? (
        <div className="tkl-wrap markets-preview-sections">
          <div
            className={
              TOP_CARDS_UI_ENABLED && TOP_MOVERS_UI_ENABLED
                ? "markets-preview-sections__grid markets-preview-sections__grid--dual"
                : "markets-preview-sections__grid"
            }
          >
            {TOP_CARDS_UI_ENABLED ? (
              <Suspense
                fallback={
                  <div className="h-64 animate-pulse rounded-2xl bg-[var(--surf)]" />
                }
              >
                <CardTop100Section variant="preview" />
              </Suspense>
            ) : null}
            {TOP_MOVERS_UI_ENABLED ? (
              <Suspense
                fallback={
                  <div className="h-64 animate-pulse rounded-2xl bg-[var(--surf)]" />
                }
              >
                <TopMoversSection />
              </Suspense>
            ) : null}
          </div>
        </div>
      ) : null}

      {showMainChrome ? (
        <MarketsFilterBar
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          sortId={sortId}
          onSortChange={setSortId}
          priceMin={priceMin}
          priceMax={priceMax}
          onPriceRangeChange={(min, max) => {
            setPriceMin(min);
            setPriceMax(max);
          }}
          gradeFilters={gradeFilters}
          onGradeToggle={toggleGradeFilter}
          onGradeFiltersChange={setGradeFilters}
          vaultFilters={vaultFilters}
          onVaultToggle={toggleVaultFilter}
          onVaultFiltersChange={setVaultFilters}
          filters={MARKETS_CATEGORY_FILTERS}
        />
      ) : null}

      <div className="tkl-wrap markets-results-section">
        {showMarketSnapshotLoadingBar ? (
          <div className="markets-snapshot-loading" role="status" aria-live="polite" aria-busy="true">
            <p className="mb-2 text-center text-xs text-[var(--t2)] sm:text-left">
              Loading listing pool stats and charts…
            </p>
            <div className="markets-snapshot-loading__bar" aria-hidden>
              <div className="markets-snapshot-loading__fill" />
            </div>
          </div>
        ) : null}

        {showLoadingShell ? (
          <div className="space-y-5">
            <p className="text-center text-sm text-[var(--t2)]" role="status" aria-live="polite">
              Loading collections and listings…
              {colFetching || ordersQuery.isFetching
                ? " (waiting for backend)"
                : ""}
            </p>
            <div className="markets-grid">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="aspect-[3/4] animate-pulse rounded-2xl bg-[var(--surf)]"
                />
              ))}
            </div>
          </div>
        ) : sortedForRank.length === 0 && orphanAsks.length === 0 ? (
          <div className="py-16 text-center">
            <p className="mb-2 text-base text-[var(--t2)]">No assets listed for sale yet.</p>
            <p className="text-sm text-[var(--t3)]">
              Mint and list your assets from{" "}
              <GatedSellLink className="text-[var(--azure)] hover:underline">Vault</GatedSellLink>.
            </p>
          </div>
        ) : (
          <>
            <div className="markets-results-bar">
              <span className="markets-results-bar__count">
                <b>{filteredSorted.length.toLocaleString("en-US")}</b> results
              </span>
              <span className="markets-results-bar__label">Live feed</span>
            </div>
            {filteredSorted.length === 0 ? (
              <div className="rounded-2xl bg-[var(--surf)] px-6 py-12 text-center">
                <p className="text-base text-[var(--t2)]">No collections match these filters yet.</p>
                <p className="mt-2 text-sm text-[var(--t3)]">
                  Try All, a different category, price range, or grade.
                </p>
              </div>
            ) : (
              <>
            <MarketsCollectionGrid
              collections={filteredSorted}
              snapshotByKey={snapshotByKey}
              resolvedCoverMap={resolvedCoverMap}
              changeLoading={showMarketSnapshotLoadingBar}
              snapshotsFetching={snapshotsFetching}
              onBeforeNavigate={() =>
                saveCollectionBrowseContext({
                  source: "markets-grid",
                  entries: buildBrowseEntriesFromSummaries(filteredSorted),
                  categoryFilter,
                  sortId,
                })
              }
            />

            {isFetchingNextPage ? (
              <div className="markets-grid markets-grid--tail" aria-hidden>
                {Array.from(
                  { length: Math.min(4, MARKETS_COLLECTIONS_PAGE_SIZE) },
                  (_, i) => (
                    <div
                      key={`markets-tail-skel-${i}`}
                      className="markets-tail-skeleton aspect-[3/4] rounded-2xl bg-[var(--surf)]"
                    />
                  ),
                )}
              </div>
            ) : null}

            {hasNextPage ? (
              <>
                <div
                  className={cn(
                    "markets-load-more",
                    (isFetchingNextPage || snapshotsFetching) &&
                      "markets-load-more--visible",
                  )}
                  role="status"
                  aria-live="polite"
                  aria-busy={isFetchingNextPage || snapshotsFetching}
                >
                  <span className="markets-load-more__label">Loading more…</span>
                </div>
                <div ref={loadMoreSentinelRef} className="markets-load-sentinel" aria-hidden />
              </>
            ) : null}

            {categoryFilter === "all" && orphanAsks.length > 0 ? (
              <Link href="/marketplace/other-listings" className="markets-orphan-card">
                <div>
                  <h3 className="text-lg font-bold text-white">Other Listings</h3>
                  <p className="mt-1 text-sm text-[var(--t2)]">No collection metadata</p>
                </div>
                <p className="tkl-mono text-sm text-[var(--t2)]">
                  Orders <b className="text-white">{orphanAsks.length}</b>
                </p>
              </Link>
            ) : null}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
