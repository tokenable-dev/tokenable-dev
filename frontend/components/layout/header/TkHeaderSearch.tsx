"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type KeyboardEvent,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { TkInput } from "@/components/ds";
import { cn } from "@/lib/ds/cn";
import type { MarketplaceCollectionSummary, MarketplaceSearchCardHit } from "@/lib/core";
import { useMarketplaceCatalogSearch } from "@/hooks/marketplace";
import { useResolvedMediaUrlMap } from "@/hooks/media";
import { useGnbMobile } from "@/hooks/layout/useGnbMobile";
import { buildMarketsCollectionTitle } from "@/lib/markets/marketsCollectionTitle";
import { buildCollectionSearchHref } from "@/lib/markets/marketsUrlFilters";
import { toCardDisplayCase } from "@/lib/marketplace/collectionFullDetailsTitle";
import { pickCollectionSummaryDisplayImageUrl } from "@/lib/marketplace/collectionDisplayImage";
import { formatUsdCompact } from "@/lib/market/collectionMarketPricing";
import { trackEvent } from "@/lib/analytics/googleAnalytics";

const SEARCH_PLACEHOLDER = "Find your card — name, cert #, set, player…";

function SearchIcon({ muted = false }: { muted?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
      style={muted ? { opacity: 0.4 } : undefined}
    >
      <circle cx={11} cy={11} r={7} />
      <line x1={16.5} y1={16.5} x2={21} y2={21} />
    </svg>
  );
}

/** DS Search `type="search"` clear — custom so it shows on all browsers. */
function SearchClearButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn("tk-search__clear", className)}
      onClick={onClick}
      aria-label="Clear search"
      tabIndex={-1}
    >
      <svg viewBox="0 0 16 16" width={10} height={10} aria-hidden>
        <path
          d="M3.5 3.5l9 9M12.5 3.5l-9 9"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}

function formatSearchMeta(c: MarketplaceCollectionSummary): string {
  const comp = c.components;
  const company = (comp.gradingCompanyDisplay || comp.gradingCompany || "PSA").trim();
  const score = (comp.gradeScore || "").trim();
  const grade = score ? `${company} ${score}` : company;
  const set =
    (comp.cardSetDisplay || comp.psaBrand || comp.cardSet || "").trim() ||
    (c.queryUsed ? toCardDisplayCase(c.queryUsed) : "");
  if (grade && set) return `${grade} · ${set}`;
  if (grade) return grade;
  if (set) return set;
  const n = c.activeListingCount;
  return `${n} listing${n !== 1 ? "s" : ""}`;
}

type SearchHit =
  | { kind: "card"; card: MarketplaceSearchCardHit }
  | { kind: "collection"; collection: MarketplaceCollectionSummary };

function formatCardMeta(card: MarketplaceSearchCardHit): string {
  return [
    card.gradeLabel,
    card.certNumber ? `Cert #${card.certNumber}` : null,
    card.vaultLabel,
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatSearchPrice(c: MarketplaceCollectionSummary): string | null {
  const usd = c.components.psaEstimateUsd;
  if (usd == null || !Number.isFinite(usd) || usd <= 0) return null;
  return `$${Math.round(usd).toLocaleString("en-US")}`;
}

function Thumb({ src }: { src: string | null }) {
  if (src) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img src={src} alt="" loading="lazy" />
    );
  }
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" opacity={0.4}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
      />
    </svg>
  );
}

export function SearchResultsList({
  hits,
  highlightIdx,
  onHighlight,
  onSelect,
  searchTruncated,
  isSearching,
  coverUrlMap,
}: {
  hits: SearchHit[];
  highlightIdx: number;
  onHighlight: (idx: number) => void;
  onSelect: (hit: SearchHit) => void;
  searchTruncated: boolean;
  isSearching: boolean;
  coverUrlMap: Map<string, string>;
}) {
  if (hits.length === 0) {
    return (
      <div className="gnb-search-overlay__empty">
        <p>{isSearching ? "Searching…" : "No cards or collections found"}</p>
      </div>
    );
  }

  const cardCount = hits.filter((h) => h.kind === "card").length;

  return (
    <div role="listbox">
      {searchTruncated ? (
        <p className="gnb-search-truncated">
          Showing top matches — type more to narrow.
        </p>
      ) : null}
      {hits.map((hit, i) => {
        const selected = i === highlightIdx;
        if (hit.kind === "card") {
          const card = hit.card;
          const src = card.imageUrl
            ? (coverUrlMap.get(card.imageUrl) ?? card.imageUrl)
            : null;
          const price =
            card.listedUsd != null ? formatUsdCompact(card.listedUsd) : null;
          return (
            <div key={`card-${card.tokenId}`}>
              {i === 0 ? (
                <h4 className="gnb-search-dropdown__heading">Cards</h4>
              ) : null}
              <button
                type="button"
                role="option"
                aria-selected={selected}
                onMouseEnter={() => onHighlight(i)}
                onClick={() => onSelect(hit)}
                className="gnb-search-item"
              >
                <div className="gnb-search-item__thumb">
                  <Thumb src={src} />
                </div>
                <div className="gnb-search-item__info">
                  <div className="gnb-search-item__name">{card.title}</div>
                  <div className="gnb-search-item__meta">{formatCardMeta(card)}</div>
                </div>
                {price ? (
                  <div className="gnb-search-item__price">
                    <div className="gnb-search-item__price-val">{price}</div>
                  </div>
                ) : null}
              </button>
            </div>
          );
        }
        const c = hit.collection;
        const displayImageUrl = pickCollectionSummaryDisplayImageUrl(c);
        const price = formatSearchPrice(c);
        return (
          <div key={`col-${c.collectionKey}`}>
            {i === cardCount ? (
              <h4 className="gnb-search-dropdown__heading">Collections</h4>
            ) : null}
            <button
              type="button"
              role="option"
              aria-selected={selected}
              onMouseEnter={() => onHighlight(i)}
              onClick={() => onSelect(hit)}
              className="gnb-search-item"
            >
              <div className="gnb-search-item__thumb">
                <Thumb
                  src={
                    displayImageUrl
                      ? (coverUrlMap.get(displayImageUrl) ?? displayImageUrl)
                      : null
                  }
                />
              </div>
              <div className="gnb-search-item__info">
                <div className="gnb-search-item__name">
                  {buildMarketsCollectionTitle({ collection: c, comp: c.components })}
                </div>
                <div className="gnb-search-item__meta">{formatSearchMeta(c)}</div>
              </div>
              {price ? (
                <div className="gnb-search-item__price">
                  <div className="gnb-search-item__price-val">{price}</div>
                </div>
              ) : null}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function isImeKeyEvent(e: KeyboardEvent<HTMLInputElement>): boolean {
  return e.nativeEvent.isComposing || e.key === "Process" || e.keyCode === 229;
}

export function TkHeaderSearch({
  mobileOpen,
  onMobileOpenChange,
}: {
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}) {
  const gnbMobile = useGnbMobile();
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [internalMobileOpen, setInternalMobileOpen] = useState(false);
  const mobileOverlayOpen = mobileOpen ?? internalMobileOpen;
  const setMobileOverlayOpen = onMobileOpenChange ?? setInternalMobileOpen;

  const [query, setQuery] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const desktopWrapperRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlSearchQ =
    pathname === "/search" || pathname.startsWith("/search/")
      ? String(searchParams.get("q") ?? "")
      : "";

  useEffect(() => {
    if (pathname === "/search" || pathname.startsWith("/search/")) {
      setQuery(urlSearchQ);
    }
  }, [pathname, urlSearchQ]);

  const searchActive = gnbMobile ? mobileOverlayOpen : desktopOpen;
  const showResultsPanel =
    searchActive && query.trim().length > 0;

  const {
    cards,
    collections: filtered,
    isSearching,
    truncated: searchTruncated,
  } = useMarketplaceCatalogSearch(query, {
    enabled: showResultsPanel,
    cardLimit: 8,
    collectionLimit: 8,
  });

  const hits: SearchHit[] = useMemo(
    () => [
      ...cards.map((card) => ({ kind: "card" as const, card })),
      ...filtered.map((collection) => ({ kind: "collection" as const, collection })),
    ],
    [cards, filtered],
  );

  useEffect(() => {
    setHighlightIdx(-1);
  }, [query]);

  const closeAll = useCallback(() => {
    setQuery("");
    setDesktopOpen(false);
    setMobileOverlayOpen(false);
    setHighlightIdx(-1);
    desktopInputRef.current?.blur();
    mobileInputRef.current?.blur();
  }, [setMobileOverlayOpen]);

  const clearQuery = useCallback(() => {
    setQuery("");
    setHighlightIdx(-1);
    if (pathname === "/search" || pathname.startsWith("/search/")) {
      router.push("/search");
    }
    if (gnbMobile) {
      mobileInputRef.current?.focus();
    } else {
      desktopInputRef.current?.focus();
      setDesktopOpen(true);
    }
  }, [gnbMobile, pathname, router]);

  useEffect(() => {
    if (!mobileOverlayOpen) return;
    const t = window.setTimeout(() => mobileInputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [mobileOverlayOpen]);

  useEffect(() => {
    if (!mobileOverlayOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOverlayOpen]);

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (gnbMobile) {
          setMobileOverlayOpen(true);
        } else {
          setDesktopOpen(true);
          desktopInputRef.current?.focus();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gnbMobile, setMobileOverlayOpen]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        desktopWrapperRef.current &&
        !desktopWrapperRef.current.contains(e.target as Node)
      ) {
        setDesktopOpen(false);
      }
    }
    if (desktopOpen && !gnbMobile) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [desktopOpen, gnbMobile]);

  function liveQuery(): string {
    const el = gnbMobile ? mobileInputRef.current : desktopInputRef.current;
    return el?.value ?? query;
  }

  function goToSearchPage() {
    const q = liveQuery();
    const href = buildCollectionSearchHref(q);
    trackEvent("search_performed", {
      query: q.trim(),
      results_count: hits.length,
    });
    router.push(href);
    closeAll();
  }

  function navigateHit(hit: SearchHit) {
    trackEvent("search_performed", {
      query: liveQuery(),
      results_count: hits.length,
    });
    if (hit.kind === "card") {
      router.push(`/marketplace/${encodeURIComponent(hit.card.tokenId)}`);
    } else {
      router.push(
        `/marketplace/collections/${encodeURIComponent(hit.collection.collectionKey)}`,
      );
    }
    closeAll();
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (highlightIdx >= 0 && highlightIdx < hits.length) {
      navigateHit(hits[highlightIdx]);
      return;
    }
    goToSearchPage();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (isImeKeyEvent(e)) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeAll();
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

  const showDesktopDropdown = !gnbMobile && desktopOpen && query.trim().length > 0;
  const showMobileResults = mobileOverlayOpen && query.trim().length > 0;

  const coverSources = useMemo(
    () => [
      ...cards.map((c) => c.imageUrl),
      ...filtered.map((c) => pickCollectionSummaryDisplayImageUrl(c)),
    ],
    [cards, filtered],
  );
  const { map: coverUrlMap } = useResolvedMediaUrlMap(coverSources, {
    enabled: (showDesktopDropdown || showMobileResults) && hits.length > 0,
  });

  const mobileOverlay =
    mobileOverlayOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            className={cn("gnb-search-overlay", mobileOverlayOpen && "open")}
            role="dialog"
            aria-modal
            aria-label="Search collections"
          >
            <div className="gnb-search-overlay__bar">
              <span className="gnb-search-overlay__bar-icon" aria-hidden>
                <SearchIcon muted />
              </span>
              <form className="gnb-search-overlay__field" onSubmit={handleSubmit}>
                <input
                  ref={mobileInputRef}
                  className={cn(
                    "gnb-search-overlay__input",
                    query.length > 0 && "has-clear",
                  )}
                  type="search"
                  name="q"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onCompositionEnd={(e) => setQuery(e.currentTarget.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={SEARCH_PLACEHOLDER}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="search"
                />
                {query.length > 0 ? (
                  <SearchClearButton
                    className="gnb-search-overlay__clear"
                    onClick={clearQuery}
                  />
                ) : null}
              </form>
              <button
                type="button"
                className="gnb-search-overlay__cancel"
                onClick={closeAll}
              >
                Cancel
              </button>
            </div>
            <div className="gnb-search-overlay__dropdown">
              {!query.trim() ? (
                <div className="gnb-search-overlay__empty">
                  <p>Find a collection</p>
                  <p>Search by card name, set, player, or cert.</p>
                </div>
              ) : (
                <>
                <SearchResultsList
                  hits={hits}
                  highlightIdx={highlightIdx}
                  onHighlight={setHighlightIdx}
                  onSelect={navigateHit}
                  searchTruncated={searchTruncated}
                  isSearching={isSearching}
                  coverUrlMap={coverUrlMap}
                />
                <button
                  type="button"
                  className="gnb-search-view-all"
                  onClick={goToSearchPage}
                >
                  View all results
                </button>
                </>
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {!gnbMobile ? (
        <form
          ref={desktopWrapperRef}
          className="gnb-search-anchor"
          onSubmit={handleSubmit}
          role="search"
        >
          <div
            className={cn(
              "tk-search",
              query.length > 0 && "tk-search--has-clear",
            )}
          >
            <span className="tk-search__icon">
              <SearchIcon />
            </span>
            <TkInput
              ref={desktopInputRef}
              type="search"
              name="q"
              size={1}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!desktopOpen) setDesktopOpen(true);
              }}
              onCompositionEnd={(e) => setQuery(e.currentTarget.value)}
              onFocus={() => setDesktopOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder={SEARCH_PLACEHOLDER}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {query.length > 0 ? (
              <SearchClearButton onClick={clearQuery} />
            ) : null}
          </div>
          <div className={cn("gnb-search-dropdown", showDesktopDropdown && "open")}>
            <SearchResultsList
              hits={hits}
              highlightIdx={highlightIdx}
              onHighlight={setHighlightIdx}
              onSelect={navigateHit}
              searchTruncated={searchTruncated}
              isSearching={isSearching}
              coverUrlMap={coverUrlMap}
            />
            <button
              type="button"
              className="gnb-search-view-all"
              onClick={goToSearchPage}
            >
              View all results
            </button>
          </div>
        </form>
      ) : null}
      {mobileOverlay}
    </>
  );
}

export function TkHeaderSearchMobileButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="gnb-search-mobile"
      onClick={onClick}
      aria-label="Search collections"
    >
      <SearchIcon />
    </button>
  );
}
