"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { TkInput } from "@/components/ds";
import { cn } from "@/lib/ds/cn";
import type { MarketplaceCollectionSummary } from "@/lib/core";
import { useMarketplaceCollectionSearch } from "@/hooks/marketplace";
import { useResolvedMediaUrlMap } from "@/hooks/media";
import { useGnbMobile } from "@/hooks/layout/useGnbMobile";
import { buildMarketsCollectionTitle } from "@/lib/markets/marketsCollectionTitle";
import { toCardDisplayUppercase } from "@/lib/marketplace/collectionFullDetailsTitle";
import { pickCollectionSummaryDisplayImageUrl } from "@/lib/marketplace/collectionDisplayImage";
import { trackEvent } from "@/lib/analytics/googleAnalytics";

const SEARCH_PLACEHOLDER = "Search cards, sets, players…";

function SearchIcon({ muted = false }: { muted?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      aria-hidden
      style={muted ? { opacity: 0.4 } : undefined}
    >
      <circle cx={11} cy={11} r={7} stroke="currentColor" strokeWidth={2} />
      <line x1={16.5} y1={16.5} x2={21} y2={21} stroke="currentColor" strokeWidth={2} />
    </svg>
  );
}

function SearchResultsList({
  filtered,
  highlightIdx,
  onHighlight,
  onSelect,
  searchTruncated,
  isSearching,
  coverUrlMap,
}: {
  filtered: MarketplaceCollectionSummary[];
  highlightIdx: number;
  onHighlight: (idx: number) => void;
  onSelect: (c: MarketplaceCollectionSummary) => void;
  searchTruncated: boolean;
  isSearching: boolean;
  coverUrlMap: Map<string, string>;
}) {
  if (filtered.length === 0) {
    return (
      <div className="gnb-search-overlay__empty">
        <p>{isSearching ? "Searching…" : "No collections found"}</p>
      </div>
    );
  }

  return (
    <div role="listbox">
      {searchTruncated ? (
        <p className="gnb-search-truncated">
          Showing top matches — type more to narrow.
        </p>
      ) : null}
      {filtered.map((c, i) => {
        const displayImageUrl = pickCollectionSummaryDisplayImageUrl(c);
        const selected = i === highlightIdx;
        return (
          <button
            key={c.collectionKey}
            type="button"
            role="option"
            aria-selected={selected}
            onMouseEnter={() => onHighlight(i)}
            onClick={() => onSelect(c)}
            className="gnb-search-item"
          >
            <div className="gnb-search-item__thumb">
              {displayImageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={coverUrlMap.get(displayImageUrl) ?? displayImageUrl}
                  alt=""
                  loading="lazy"
                />
              ) : (
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" opacity={0.4}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                  />
                </svg>
              )}
            </div>
            <div className="gnb-search-item__info">
              <div className="gnb-search-item__name">
                {buildMarketsCollectionTitle({ collection: c, comp: c.components })}
              </div>
              <div className="gnb-search-item__meta">
                {c.activeListingCount} listing{c.activeListingCount !== 1 ? "s" : ""}
                {c.queryUsed ? ` · ${toCardDisplayUppercase(c.queryUsed)}` : ""}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function TkHeaderSearch({
  compact = false,
  mobileOpen,
  onMobileOpenChange,
}: {
  compact?: boolean;
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
  const desktopWrapperRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const searchActive = gnbMobile ? mobileOverlayOpen : desktopOpen;
  const showResultsPanel =
    searchActive && query.trim().length > 0;

  const {
    items: filtered,
    isSearching,
    truncated: searchTruncated,
  } = useMarketplaceCollectionSearch(query, {
    enabled: showResultsPanel,
  });

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

  function navigate(c: MarketplaceCollectionSummary) {
    trackEvent("search_performed", { query, results_count: filtered.length });
    router.push(`/marketplace/collections/${encodeURIComponent(c.collectionKey)}`);
    closeAll();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      closeAll();
      return;
    }
    if (!filtered.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((p) => (p + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((p) => (p <= 0 ? filtered.length - 1 : p - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIdx >= 0 && highlightIdx < filtered.length) {
        navigate(filtered[highlightIdx]);
      }
    }
  }

  const showDesktopDropdown = !gnbMobile && desktopOpen && query.trim().length > 0;
  const showMobileResults = mobileOverlayOpen && query.trim().length > 0;

  const coverSources = useMemo(
    () => filtered.map((c) => pickCollectionSummaryDisplayImageUrl(c)),
    [filtered],
  );
  const { map: coverUrlMap } = useResolvedMediaUrlMap(coverSources, {
    enabled: (showDesktopDropdown || showMobileResults) && filtered.length > 0,
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
              <input
                ref={mobileInputRef}
                className="gnb-search-overlay__input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={SEARCH_PLACEHOLDER}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="search"
              />
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
                <SearchResultsList
                  filtered={filtered}
                  highlightIdx={highlightIdx}
                  onHighlight={setHighlightIdx}
                  onSelect={navigate}
                  searchTruncated={searchTruncated}
                  isSearching={isSearching}
                  coverUrlMap={coverUrlMap}
                />
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {!gnbMobile ? (
        <div ref={desktopWrapperRef} className="gnb-search-anchor">
          <div className={cn("tk-search", compact && "tk-search--compact")}>
            <span className="tk-search__icon">
              <SearchIcon />
            </span>
            <TkInput
              ref={desktopInputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!desktopOpen) setDesktopOpen(true);
              }}
              onFocus={() => setDesktopOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder={SEARCH_PLACEHOLDER}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <div className={cn("gnb-search-dropdown", showDesktopDropdown && "open")}>
            <SearchResultsList
              filtered={filtered}
              highlightIdx={highlightIdx}
              onHighlight={setHighlightIdx}
              onSelect={navigate}
              searchTruncated={searchTruncated}
              isSearching={isSearching}
              coverUrlMap={coverUrlMap}
            />
          </div>
        </div>
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
