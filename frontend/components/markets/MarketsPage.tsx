"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  collectionMatchesCategoryFilters,
  type CollectionCategoryId,
} from "@/lib/market";
import {
  collectionKeyLower,
  type MarketsSortId,
} from "@/lib/markets/marketsCollectionSort";
import {
  applyMarketsListingFilters,
  collectMarketsSetFacetOptions,
  collectionVaultKindsFromAsks,
  type MarketsGradeFilterId,
  type MarketsVaultFilterId,
} from "@/lib/markets/marketsFilters";
import {
  marketsUrlFiltersEqual,
  parseMarketsUrlFilters,
  serializeMarketsUrlFilters,
  type MarketsUrlFilters,
} from "@/lib/markets/marketsUrlFilters";
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

function filtersFromState(input: {
  categoryFilters: Set<CollectionCategoryId>;
  sortId: MarketsSortId;
  priceMin: string;
  priceMax: string;
  gradeFilters: Set<MarketsGradeFilterId>;
  characters: string[];
  sets: string[];
  yearMin: string;
  yearMax: string;
}): MarketsUrlFilters {
  return {
    categories: [...input.categoryFilters],
    sortId: input.sortId,
    priceMin: input.priceMin,
    priceMax: input.priceMax,
    grades: [...input.gradeFilters],
    characters: input.characters,
    sets: input.sets,
    yearMin: input.yearMin,
    yearMax: input.yearMax,
  };
}

export default function MarketsPage() {
  usePageViewedEvent("markets");
  const mounted = useClientMounted();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlFilters = useMemo(
    () => parseMarketsUrlFilters(searchParams),
    [searchParams],
  );

  const [categoryFilters, setCategoryFilters] = useState<Set<CollectionCategoryId>>(
    () => new Set(urlFilters.categories),
  );
  const [sortId, setSortId] = useState<MarketsSortId>(urlFilters.sortId);
  const [priceMin, setPriceMin] = useState(urlFilters.priceMin);
  const [priceMax, setPriceMax] = useState(urlFilters.priceMax);
  const [gradeFilters, setGradeFilters] = useState<Set<MarketsGradeFilterId>>(
    () => new Set(urlFilters.grades),
  );
  const [vaultFilters, setVaultFilters] = useState<Set<MarketsVaultFilterId>>(
    new Set(),
  );
  const [characters, setCharacters] = useState(urlFilters.characters);
  const [sets, setSets] = useState(urlFilters.sets);
  const [yearMin, setYearMin] = useState(urlFilters.yearMin);
  const [yearMax, setYearMax] = useState(urlFilters.yearMax);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const skipNextUrlWrite = useRef(false);

  // Sync local state when URL changes (Details deep-links, back/forward).
  useEffect(() => {
    skipNextUrlWrite.current = true;
    setCategoryFilters(new Set(urlFilters.categories));
    setSortId(urlFilters.sortId);
    setPriceMin(urlFilters.priceMin);
    setPriceMax(urlFilters.priceMax);
    setGradeFilters(new Set(urlFilters.grades));
    setCharacters(urlFilters.characters);
    setSets(urlFilters.sets);
    setYearMin(urlFilters.yearMin);
    setYearMax(urlFilters.yearMax);
  }, [urlFilters]);

  // Write filter state back to the URL (Card.html / markets-nav.js contract).
  useEffect(() => {
    if (skipNextUrlWrite.current) {
      skipNextUrlWrite.current = false;
      return;
    }
    const next = filtersFromState({
      categoryFilters,
      sortId,
      priceMin,
      priceMax,
      gradeFilters,
      characters,
      sets,
      yearMin,
      yearMax,
    });
    if (marketsUrlFiltersEqual(next, urlFilters)) return;
    const qs = serializeMarketsUrlFilters(next).toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [
    categoryFilters,
    sortId,
    priceMin,
    priceMax,
    gradeFilters,
    characters,
    sets,
    yearMin,
    yearMax,
    pathname,
    router,
    urlFilters,
  ]);

  const toggleCategoryFilter = useCallback((id: CollectionCategoryId) => {
    setCategoryFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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

  const toggleSetFilter = useCallback((setName: string) => {
    const trimmed = setName.trim();
    if (!trimmed) return;
    setSets((prev) => {
      const i = prev.findIndex((s) => s.toLowerCase() === trimmed.toLowerCase());
      if (i >= 0) return prev.filter((_, idx) => idx !== i);
      return [...prev, trimmed];
    });
  }, []);

  const clearDetailFacets = useCallback(() => {
    setCharacters([]);
    setSets([]);
    setYearMin("");
    setYearMax("");
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

  const setFacetOptions = useMemo(() => {
    const pool =
      categoryFilters.size === 0
        ? collectionSummaries
        : collectionSummaries.filter((c) =>
            collectionMatchesCategoryFilters(
              categoryFilters,
              c,
              snapshotByKey.get(collectionKeyLower(c)),
            ),
          );
    return collectMarketsSetFacetOptions(pool);
  }, [collectionSummaries, categoryFilters, snapshotByKey]);

  const filteredSorted = useMemo(() => {
    const categoryFiltered = sortedForRank.filter((c) =>
      collectionMatchesCategoryFilters(
        categoryFilters,
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
      characters,
      sets,
      yearMin,
      yearMax,
    });
  }, [
    sortedForRank,
    snapshotByKey,
    categoryFilters,
    priceMin,
    priceMax,
    gradeFilters,
    vaultFilters,
    vaultKindsByKey,
    characters,
    sets,
    yearMin,
    yearMax,
  ]);

  const detailFacetChips = useMemo(() => {
    const chips: { key: string; label: string; onClear: () => void }[] = [];
    for (const [i, name] of characters.entries()) {
      chips.push({
        key: `character:${name}`,
        label: name,
        onClear: () =>
          setCharacters((prev) => prev.filter((_, idx) => idx !== i)),
      });
    }
    if (yearMin || yearMax) {
      const label =
        yearMin && yearMax && yearMin === yearMax
          ? yearMin
          : `${yearMin || "…"}–${yearMax || "…"}`;
      chips.push({
        key: "year",
        label: `Year · ${label}`,
        onClear: () => {
          setYearMin("");
          setYearMax("");
        },
      });
    }
    return chips;
  }, [characters, yearMin, yearMax]);

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
          categoryFilters={categoryFilters}
          onCategoryToggle={toggleCategoryFilter}
          onCategoryFiltersChange={setCategoryFilters}
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
          sets={sets}
          onSetsChange={setSets}
          onSetToggle={toggleSetFilter}
          setFacetOptions={setFacetOptions}
        />
      ) : null}

      {showMainChrome && detailFacetChips.length > 0 ? (
        <div className="tkl-wrap markets-detail-facets" aria-label="Active detail filters">
          <div className="markets-detail-facets__row">
            {detailFacetChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className="markets-detail-facets__chip"
                onClick={chip.onClear}
              >
                {chip.label}
                <span aria-hidden> ×</span>
              </button>
            ))}
            <button
              type="button"
              className="markets-detail-facets__clear"
              onClick={clearDetailFacets}
            >
              Clear
            </button>
          </div>
        </div>
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
            </div>
            {filteredSorted.length === 0 ? (
              <div className="rounded-2xl bg-[var(--surf)] px-6 py-12 text-center">
                <p className="text-base text-[var(--t2)]">No collections match these filters yet.</p>
                <p className="mt-2 text-sm text-[var(--t3)]">
                  Try All, a different category, price range, or grade — or clear detail filters.
                </p>
                {detailFacetChips.length > 0 ? (
                  <button
                    type="button"
                    className="mt-4 text-sm font-semibold text-[var(--azure)] hover:underline"
                    onClick={clearDetailFacets}
                  >
                    Clear detail filters
                  </button>
                ) : null}
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
                      categoryFilter:
                        categoryFilters.size > 0
                          ? [...categoryFilters].join("|")
                          : undefined,
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

                {categoryFilters.size === 0 && orphanAsks.length > 0 ? (
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
