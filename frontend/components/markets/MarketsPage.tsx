"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  useMarketplaceCollectionsInfinite,
  useMarketplaceCatalogSearch,
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
import {
  MarketsCollectionGrid,
  MarketsGridSkeleton,
} from "./MarketsCollectionGrid";
import { SearchCertMatches } from "@/components/search/SearchCertMatches";
import { pickCollectionSummaryDisplayImageUrl } from "@/lib/marketplace/collectionDisplayImage";
import {
  buildBrowseEntriesFromSummaries,
  saveCollectionBrowseContext,
} from "@/lib/marketplace/collectionBrowseContext";
import { AppPageState } from "@/components/ui/AppPageState";
import { TkButton } from "@/components/ds";
import { cn } from "@/lib/ds/cn";
import { useClientMounted } from "@/hooks/ui/useClientMounted";
import { usePageViewedEvent } from "@/hooks/analytics/usePageViewedEvent";

function filtersFromState(input: {
  categoryFilters: Set<CollectionCategoryId>;
  sortId: MarketsSortId;
  priceMin: string;
  priceMax: string;
  gradeFilters: Set<MarketsGradeFilterId>;
  vaultFilters: Set<MarketsVaultFilterId>;
  characters: string[];
  series: string[];
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
    vaults: [...input.vaultFilters],
    characters: input.characters,
    series: input.series,
    sets: input.sets,
    yearMin: input.yearMin,
    yearMax: input.yearMax,
  };
}

export default function MarketsPage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchQ = String(searchParams.get("q") ?? "").trim();
  const isSearchMode = pathname === "/search" || pathname.startsWith("/search/");
  usePageViewedEvent(isSearchMode ? "search" : "markets");
  const mounted = useClientMounted();

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
    () => new Set(urlFilters.vaults),
  );
  const [characters, setCharacters] = useState(urlFilters.characters);
  const [series, setSeries] = useState(urlFilters.series);
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
    setVaultFilters(new Set(urlFilters.vaults));
    setCharacters(urlFilters.characters);
    setSeries(urlFilters.series);
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
      vaultFilters,
      characters,
      series,
      sets,
      yearMin,
      yearMax,
    });
    const fromLocation = parseMarketsUrlFilters(
      new URLSearchParams(window.location.search),
    );
    if (marketsUrlFiltersEqual(next, fromLocation)) return;
    const qs = serializeMarketsUrlFilters(next).toString();
    const hrefParams = new URLSearchParams(qs);
    if (searchQ) hrefParams.set("q", searchQ);
    const hrefQs = hrefParams.toString();
    const href = hrefQs ? `${pathname}?${hrefQs}` : pathname;
    window.history.replaceState(window.history.state, "", href);
  }, [
    categoryFilters,
    sortId,
    priceMin,
    priceMax,
    gradeFilters,
    vaultFilters,
    characters,
    series,
    sets,
    yearMin,
    yearMax,
    pathname,
    searchQ,
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
    setSeries([]);
    setSets([]);
    setYearMin("");
    setYearMax("");
  }, []);

  const ordersQuery = useMarketsOrders();
  const orders = ordersQuery.orders;

  const colInfinite = useMarketplaceCollectionsInfinite({
    q: isSearchMode ? searchQ : undefined,
  });
  // Name matches are already covered by collection results; only cert #s surface individual cards.
  const isCertQuery = /^\d{7,}$/.test(searchQ);
  const searchCardsQuery = useMarketplaceCatalogSearch(searchQ, {
    enabled: isSearchMode && isCertQuery,
    cardLimit: 20,
    collectionLimit: 0,
  });
  const searchCards = isSearchMode && isCertQuery ? searchCardsQuery.cards : [];
  const {
    data: colPages,
    isPending: colInitialPending,
    isError: colLoadError,
    error: colError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = colInfinite;

  const collectionSummaries = useMemo(() => {
    const pages = colPages?.pages;
    if (!Array.isArray(pages)) return [];
    return pages.flatMap((p) =>
      Array.isArray(p?.items) ? p.items.filter(Boolean) : [],
    );
  }, [colPages]);

  const coverRawUrls = useMemo(
    () => collectionSummaries.map((c) => pickCollectionSummaryDisplayImageUrl(c)),
    [collectionSummaries],
  );
  const { map: resolvedCoverMap } = useResolvedMediaUrlMap(coverRawUrls, {
    enabled: collectionSummaries.length > 0,
  });

  const isInitialLoading = colInitialPending;
  const loadFailed = colLoadError;
  const loadError = colError ?? null;
  const showLoadingShell =
    !mounted || (isInitialLoading && collectionSummaries.length === 0 && !loadFailed);

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
  } = useMarketsSnapshots(
    snapshotKeysSorted,
    collectionSummaries.length > 0 || !colInitialPending,
  );

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
      series,
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
    series,
    sets,
    yearMin,
    yearMax,
  ]);

  const saveMarketsBrowseContext = useCallback(() => {
    saveCollectionBrowseContext({
      source: "markets-grid",
      entries: buildBrowseEntriesFromSummaries(filteredSorted),
      categoryFilter:
        categoryFilters.size > 0
          ? [...categoryFilters].join("|")
          : undefined,
      sortId,
    });
  }, [filteredSorted, categoryFilters, sortId]);

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
    for (const [i, name] of series.entries()) {
      chips.push({
        key: `series:${name}`,
        label: name,
        onClear: () =>
          setSeries((prev) => prev.filter((_, idx) => idx !== i)),
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
  }, [characters, series, yearMin, yearMax]);

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
    mounted &&
    !showLoadingShell &&
    (sortedForRank.length > 0 || searchCards.length > 0);

  return (
    <div className="markets-page">
      <MarketsPageHeader
        searchQuery={isSearchMode ? searchQ : undefined}
        resultCount={
          mounted && !showLoadingShell && !searchCardsQuery.isSearching
            ? filteredSorted.length + searchCards.length
            : null
        }
      />

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
          yearMin={yearMin}
          yearMax={yearMax}
          onYearRangeChange={(min, max) => {
            setYearMin(min);
            setYearMax(max);
          }}
          characters={characters}
          onCharactersChange={setCharacters}
          series={series}
          onSeriesChange={setSeries}
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
        {showLoadingShell ? (
          <div role="status" aria-live="polite" aria-busy="true">
            <span className="sr-only">Loading markets</span>
            <MarketsGridSkeleton />
          </div>
        ) : isSearchMode &&
          sortedForRank.length === 0 &&
          searchCards.length === 0 &&
          !searchCardsQuery.isSearching ? (
          <div className="srch-empty">
            <p className="srch-empty__title">
              {searchQ
                ? `No cards found for "${searchQ}"`
                : "Type a card name, set, player, or cert #."}
            </p>
            <p className="srch-empty__sub">
              Check the spelling, or try a name, set, player, or cert #.
            </p>
            <TkButton href="/markets" variant="primary">
              Browse all markets →
            </TkButton>
          </div>
        ) : sortedForRank.length === 0 && orphanAsks.length === 0 && searchCards.length === 0 ? (
          <div className="markets-empty">
            <p className="markets-empty__lead">No items listed for sale yet.</p>
            <p className="markets-empty__sub">
              Mint and list your items from{" "}
              <GatedSellLink className="text-[var(--azure)] hover:underline">Vault</GatedSellLink>.
            </p>
          </div>
        ) : (
          <>
            {isSearchMode ? <SearchCertMatches cards={searchCards} query={searchQ} /> : null}
            {filteredSorted.length === 0 ? (
              sortedForRank.length > 0 ? (
              <div className="markets-filter-empty">
                <p className="markets-empty__lead">No collections match these filters yet.</p>
                <p className="markets-empty__sub">
                  Try a different category, price range, grade, or year.
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
              ) : null
            ) : (
              <>
                {isSearchMode ? (
                  <div className="srch-results-head">
                    <h2 className="srch-results-head__title">Collection results</h2>
                    <span className="srch-results-head__count">
                      <b>{filteredSorted.length.toLocaleString("en-US")}</b> for &quot;{searchQ}&quot;
                    </span>
                  </div>
                ) : null}
                <MarketsCollectionGrid
                  collections={filteredSorted}
                  snapshotByKey={snapshotByKey}
                  resolvedCoverMap={resolvedCoverMap}
                  changeLoading={showMarketSnapshotLoadingBar}
                  snapshotsFetching={snapshotsFetching}
                  onBeforeNavigate={saveMarketsBrowseContext}
                  showCatalogSubtitle={isSearchMode}
                />

                {isFetchingNextPage ? (
                  <MarketsGridSkeleton
                    count={Math.min(4, MARKETS_COLLECTIONS_PAGE_SIZE)}
                    className="markets-grid--tail"
                  />
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

                {!isSearchMode && categoryFilters.size === 0 && orphanAsks.length > 0 ? (
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
