"use client";

import Link from "next/link";
import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { TkButton, TkSearchField } from "@/components/ds";
import { cn } from "@/lib/ds/cn";
import type {
  CollectionListMarketSnapshot,
  MarketplaceCollectionSummary,
  MarketplaceSearchCardHit,
} from "@/lib/core";
import { useMarketplaceCatalogSearch } from "@/hooks/marketplace";
import { useMarketsSnapshots } from "@/hooks/markets/useMarketsPageData";
import { useResolvedMediaUrlMap } from "@/hooks/media";
import { MARKETS_CATEGORY_SELECT_OPTIONS } from "@/lib/market/collectionCategoryFilter";
import {
  buildCollectionSearchHref,
  marketsHrefFromFilters,
} from "@/lib/markets/marketsUrlFilters";
import {
  collectionDetailHref,
  resolveCollectionDetailHref,
} from "@/lib/marketplace/collectionBrowseContext";
import { pickCollectionSummaryDisplayImageUrl } from "@/lib/marketplace/collectionDisplayImage";
import { trackEvent } from "@/lib/analytics/googleAnalytics";
import {
  GNB_SEARCH_PREVIEW_LIMIT,
  SearchResultsList,
  isImeKeyEvent,
} from "@/components/layout/header/TkHeaderSearch";
import { useMobileViewport } from "@/hooks/ui/useIsMobileViewport";

type SearchHit =
  | { kind: "card"; card: MarketplaceSearchCardHit }
  | { kind: "collection"; collection: MarketplaceCollectionSummary };

const PLACEHOLDER = "Search cards, players, sets";
const PLACEHOLDER_MOBILE = "Search cards, players…";

function SearchIcon() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <circle cx={11} cy={11} r={7} />
      <line x1={16.5} y1={16.5} x2={21} y2={21} />
    </svg>
  );
}

export function HomeHeroSearch() {
  const { ready: viewportReady, isMobile: heroMobile } = useMobileViewport(768);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLFormElement>(null);

  const trimmed = query.trim();
  const showDropdown = open && trimmed.length > 0;

  const {
    cards,
    collections: filtered,
    isSearching,
  } = useMarketplaceCatalogSearch(query, {
    enabled: showDropdown,
    cardLimit: heroMobile ? GNB_SEARCH_PREVIEW_LIMIT : 8,
    collectionLimit: heroMobile ? GNB_SEARCH_PREVIEW_LIMIT : 8,
  });

  const hits: SearchHit[] = useMemo(
    () => [
      ...cards.map((card) => ({ kind: "card" as const, card })),
      ...filtered.map((collection) => ({
        kind: "collection" as const,
        collection,
      })),
    ],
    [cards, filtered],
  );

  useEffect(() => {
    setHighlightIdx(-1);
  }, [query]);

  useEffect(() => {
    function onDocMouse(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onDocMouse);
    return () => document.removeEventListener("mousedown", onDocMouse);
  }, [open]);

  const coverSources = useMemo(
    () => [
      ...cards.map((c) => c.imageUrl),
      ...filtered.map((c) => pickCollectionSummaryDisplayImageUrl(c)),
    ],
    [cards, filtered],
  );
  const { map: coverUrlMap } = useResolvedMediaUrlMap(coverSources, {
    enabled: showDropdown && hits.length > 0,
  });

  const snapshotKeys = useMemo(() => {
    const u = new Set<string>();
    for (const k of [
      ...cards.map((c) => c.collectionKey),
      ...filtered.map((c) => c.collectionKey),
    ]) {
      const key = k?.trim().toLowerCase();
      if (key) u.add(key);
    }
    return [...u].sort();
  }, [cards, filtered]);
  const { snapshotByKey } = useMarketsSnapshots(snapshotKeys, showDropdown);

  const goToSearchPage = useCallback(() => {
    const q = inputRef.current?.value ?? query;
    trackEvent("search_performed", {
      query: q.trim(),
      results_count: hits.length,
    });
    router.push(buildCollectionSearchHref(q));
    setOpen(false);
    inputRef.current?.blur();
  }, [query, hits.length, router]);

  const navigateHit = useCallback(
    async (hit: SearchHit) => {
      trackEvent("search_performed", {
        query: inputRef.current?.value ?? query,
        results_count: hits.length,
      });
      if (hit.kind === "card") {
        router.push(
          await resolveCollectionDetailHref(hit.card.tokenId, hit.card.collectionKey),
        );
      } else {
        router.push(collectionDetailHref(hit.collection.collectionKey));
      }
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
    },
    [query, hits.length, router],
  );

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (highlightIdx >= 0 && highlightIdx < hits.length) {
      void navigateHit(hits[highlightIdx]);
      return;
    }
    goToSearchPage();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (isImeKeyEvent(e)) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!hits.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((p) => (p + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((p) => (p <= 0 ? hits.length - 1 : p - 1));
    }
  }

  return (
    <>
      <form
        ref={wrapRef}
        className="home-hero__search home-hero__reveal home-hero__reveal--1"
        onSubmit={handleSubmit}
        role="search"
      >
        <div className="home-hero__search-field">
          <TkSearchField
            ref={inputRef}
            icon={<SearchIcon />}
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onCompositionEnd={(e) => setQuery(e.currentTarget.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={
              viewportReady && heroMobile ? PLACEHOLDER_MOBILE : PLACEHOLDER
            }
            title={PLACEHOLDER}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Search cards"
            aria-expanded={showDropdown}
            aria-controls="home-hero-search-dd"
          />
          <TkButton type="submit" variant="primary" className="home-hero__search-btn">
            Search
          </TkButton>
        </div>
        <div
          id="home-hero-search-dd"
          className={cn("home-hero__search-dropdown", showDropdown && "is-open")}
          role="listbox"
          aria-label="Search results"
        >
          <SearchResultsList
            hits={hits}
            highlightIdx={highlightIdx}
            onHighlight={setHighlightIdx}
            onSelect={(hit) => void navigateHit(hit)}
            isSearching={isSearching}
            coverUrlMap={coverUrlMap}
            snapshotByKey={snapshotByKey as Map<string, CollectionListMarketSnapshot>}
          />
          {hits.length > 0 ? (
            <button
              type="button"
              className="home-hero__search-view-all"
              onClick={goToSearchPage}
            >
              View all results →
            </button>
          ) : null}
        </div>
      </form>

      <div
        className="home-hero__search-tags home-hero__reveal home-hero__reveal--2"
        aria-label="Browse by category"
      >
        {MARKETS_CATEGORY_SELECT_OPTIONS.filter((cat) => cat.id !== "other").map((cat) => (
          <Link
            key={cat.id}
            href={marketsHrefFromFilters({ categories: [cat.id] })}
          >
            {cat.label}
          </Link>
        ))}
      </div>
    </>
  );
}
