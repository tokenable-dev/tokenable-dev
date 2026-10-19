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
import { TkSearchField } from "@/components/ds";
import { cn } from "@/lib/ds/cn";
import type {
  CollectionListMarketSnapshot,
  MarketplaceCollectionSummary,
  MarketplaceSearchCardHit,
} from "@/lib/core";
import { useMarketplaceCatalogSearch } from "@/hooks/marketplace";
import { useMarketsSnapshots } from "@/hooks/markets/useMarketsPageData";
import {
  resolveMarketsListingMarketChangePct,
  resolveMarketsListingMarketUsd,
} from "@/lib/markets/marketsListingMarketPrice";
import {
  resolveReferencePercentChangeDisplay,
} from "@/lib/market/priceChangePeriod";
import { useResolvedMediaUrlMap } from "@/hooks/media";
import { useGnbMobile } from "@/hooks/layout/useGnbMobile";
import {
  buildGnbSearchCollectionMeta,
  buildGnbSearchCollectionTitle,
} from "@/lib/markets/marketsCollectionTitle";
import { formatSearchCardHitDisplay } from "@/lib/markets/searchHitDisplay";
import { buildCollectionSearchHref } from "@/lib/markets/marketsUrlFilters";
import {
  collectionDetailHref,
  resolveCollectionDetailHref,
} from "@/lib/marketplace/collectionBrowseContext";
import { CollectionPsaSlabFrame } from "@/components/marketplace/collection-cover";
import { pickCollectionSummaryDisplayImageUrl } from "@/lib/marketplace/collectionDisplayImage";
import { parseCollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import { formatUsdCompact, formatUsdListing } from "@/lib/market/collectionMarketPricing";
import { trackEvent } from "@/lib/analytics/googleAnalytics";

const SEARCH_PLACEHOLDER = "Search cards by name";

/**
 * Mobile / overlay typeahead fetch size. The scroll viewport shows ~5 rows;
 * extra hits scroll under a sticky “View all results”. Full set is on /search.
 */
export const GNB_SEARCH_PREVIEW_LIMIT = 12;

/** Markets slim bar (≤820px) — open the same overlay as the GNB magnifier. */
export const GNB_SEARCH_OPEN_EVENT = "tokenable:gnb-search-open";

export function requestOpenGnbSearch(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(GNB_SEARCH_OPEN_EVENT));
}

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
  return buildGnbSearchCollectionMeta({
    collection: c,
    comp: c.components,
  });
}

type SearchHit =
  | { kind: "card"; card: MarketplaceSearchCardHit }
  | { kind: "collection"; collection: MarketplaceCollectionSummary };

function formatSearchPrice(
  c: MarketplaceCollectionSummary,
  snapshot: CollectionListMarketSnapshot | undefined,
): string | null {
  const usd = resolveMarketsListingMarketUsd(c, snapshot) ?? c.components.psaEstimateUsd;
  if (usd == null || !Number.isFinite(usd) || usd <= 0) return null;
  return formatUsdCompact(usd);
}

function snapshotFor(
  snapshotByKey: Map<string, CollectionListMarketSnapshot>,
  collectionKey: string | null | undefined,
): CollectionListMarketSnapshot | undefined {
  const k = collectionKey?.trim().toLowerCase();
  return k ? snapshotByKey.get(k) : undefined;
}

function SearchItemPrice({
  price,
  snapshot,
}: {
  price: string | null;
  snapshot: CollectionListMarketSnapshot | undefined;
}) {
  const pct = resolveMarketsListingMarketChangePct(snapshot);
  const change =
    pct != null && Number.isFinite(pct)
      ? resolveReferencePercentChangeDisplay(pct)
      : null;
  if (!price && !change) return null;
  return (
    <div className="gnb-search-item__price">
      {price ? <div className="gnb-search-item__price-val">{price}</div> : null}
      {change ? (
        <div
          className={cn(
            "gnb-search-item__price-chg",
            change.tone === "down" && "is-down",
            change.tone === "up" && "is-up",
            change.tone === "muted" && "is-muted",
          )}
        >
          {change.pctLabel}
        </div>
      ) : null}
    </div>
  );
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
  isSearching,
  coverUrlMap,
  snapshotByKey,
}: {
  hits: SearchHit[];
  highlightIdx: number;
  onHighlight: (idx: number) => void;
  onSelect: (hit: SearchHit) => void;
  isSearching: boolean;
  coverUrlMap: Map<string, string>;
  snapshotByKey: Map<string, CollectionListMarketSnapshot>;
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
    <div role="listbox" className="gnb-search-results-scroll">
      {hits.map((hit, i) => {
        const selected = i === highlightIdx;
        if (hit.kind === "card") {
          const card = hit.card;
          const src = card.imageUrl
            ? (coverUrlMap.get(card.imageUrl) ?? card.imageUrl)
            : null;
          const price = formatUsdListing(card.listedUsd);
          const display = formatSearchCardHitDisplay(card);
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
                  <div className="gnb-search-item__name">{display.line1}</div>
                  {display.line2 ? (
                    <div className="gnb-search-item__meta">{display.line2}</div>
                  ) : null}
                </div>
                <SearchItemPrice
                  price={price}
                  snapshot={snapshotFor(snapshotByKey, card.collectionKey)}
                />
              </button>
            </div>
          );
        }
        const c = hit.collection;
        const displayImageUrl = pickCollectionSummaryDisplayImageUrl(c);
        const snapshot = snapshotFor(snapshotByKey, c.collectionKey);
        const price = formatSearchPrice(c, snapshot);
        const meta = formatSearchMeta(c);
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
                {displayImageUrl ? (
                  <CollectionPsaSlabFrame
                    imageUrl={coverUrlMap.get(displayImageUrl) ?? displayImageUrl}
                    alt={buildGnbSearchCollectionTitle({ collection: c, comp: c.components })}
                    comp={parseCollectionComponents(c.components)}
                    displayLabel={c.displayLabel}
                    collectionKey={c.collectionKey}
                  />
                ) : (
                  <Thumb src={null} />
                )}
              </div>
              <div className="gnb-search-item__info">
                <div className="gnb-search-item__name">
                  {buildGnbSearchCollectionTitle({ collection: c, comp: c.components })}
                </div>
                {meta ? <div className="gnb-search-item__meta">{meta}</div> : null}
              </div>
              <SearchItemPrice price={price} snapshot={snapshot} />
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
  overlayMode,
}: {
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  /** Mobile viewport, or desktop when the 420px bar no longer fits. */
  overlayMode?: boolean;
}) {
  const gnbMobile = useGnbMobile();
  const useOverlay = overlayMode ?? gnbMobile;
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

  const searchActive = useOverlay ? mobileOverlayOpen : desktopOpen;
  const showResultsPanel =
    searchActive && query.trim().length > 0;

  const {
    cards,
    collections: filtered,
    isSearching,
  } = useMarketplaceCatalogSearch(query, {
    enabled: showResultsPanel,
    cardLimit: useOverlay ? GNB_SEARCH_PREVIEW_LIMIT : 8,
    collectionLimit: useOverlay ? GNB_SEARCH_PREVIEW_LIMIT : 8,
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
    if (useOverlay) {
      mobileInputRef.current?.focus();
    } else {
      desktopInputRef.current?.focus();
      setDesktopOpen(true);
    }
  }, [useOverlay, pathname, router]);

  useEffect(() => {
    if (!useOverlay) {
      setMobileOverlayOpen(false);
      return;
    }
    setDesktopOpen(false);
  }, [useOverlay, setMobileOverlayOpen]);

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
        if (useOverlay) {
          setMobileOverlayOpen(true);
        } else {
          setDesktopOpen(true);
          desktopInputRef.current?.focus();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [useOverlay, setMobileOverlayOpen]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        desktopWrapperRef.current &&
        !desktopWrapperRef.current.contains(e.target as Node)
      ) {
        setDesktopOpen(false);
      }
    }
    if (desktopOpen && !useOverlay) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [desktopOpen, useOverlay]);

  function liveQuery(): string {
    const el = useOverlay ? mobileInputRef.current : desktopInputRef.current;
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

  async function navigateHit(hit: SearchHit) {
    trackEvent("search_performed", {
      query: liveQuery(),
      results_count: hits.length,
    });
    if (hit.kind === "card") {
      router.push(
        await resolveCollectionDetailHref(hit.card.tokenId, hit.card.collectionKey),
      );
    } else {
      router.push(collectionDetailHref(hit.collection.collectionKey));
    }
    closeAll();
  }

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

  const showDesktopDropdown = !useOverlay && desktopOpen && query.trim().length > 0;
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
  const { snapshotByKey } = useMarketsSnapshots(
    snapshotKeys,
    showDesktopDropdown || showMobileResults,
  );

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
                    isSearching={isSearching}
                    coverUrlMap={coverUrlMap}
                    snapshotByKey={snapshotByKey}
                  />
                  {hits.length > 0 ? (
                    <button
                      type="button"
                      className="gnb-search-view-all"
                      onClick={goToSearchPage}
                    >
                      View all results
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {!useOverlay ? (
        <form
          ref={desktopWrapperRef}
          className="gnb-search-anchor"
          onSubmit={handleSubmit}
          role="search"
        >
          <TkSearchField
            ref={desktopInputRef}
            fieldSize="compact"
            icon={<SearchIcon />}
            name="q"
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
            trailing={
              query.length > 0 ? (
                <SearchClearButton
                  className="tk-search__clear"
                  onClick={clearQuery}
                />
              ) : null
            }
          />
          <div className={cn("gnb-search-dropdown", showDesktopDropdown && "open")}>
            <SearchResultsList
              hits={hits}
              highlightIdx={highlightIdx}
              onHighlight={setHighlightIdx}
              onSelect={navigateHit}
              isSearching={isSearching}
              coverUrlMap={coverUrlMap}
              snapshotByKey={snapshotByKey}
            />
            {hits.length > 0 ? (
              <button
                type="button"
                className="gnb-search-view-all"
                onClick={goToSearchPage}
              >
                View all results
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
      {mobileOverlay}
    </>
  );
}

export function TkHeaderSearchMobileButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn("gnb-search-mobile", className)}
      onClick={onClick}
      aria-label="Search collections"
    >
      <SearchIcon />
    </button>
  );
}
