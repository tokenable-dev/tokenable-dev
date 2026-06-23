"use client";

import Link from "next/link";
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useDeferredValue,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { ASSETS } from "@/constants/assets";
import {
  APP_MAIN_SHELL_CLASS,
  COLLECTION_DETAIL_SHELL_CLASS,
  isMarketplaceCollectionDetailPath,
} from "@/constants/layout";
import type { MarketplaceCollectionSummary } from "@/lib/core";
import { HeaderAuthModals } from "@/components/auth/HeaderAuthModals";
import { HeaderAuthControls } from "@/components/layout/header/HeaderAuthControls";
import { HeaderDesktopNav } from "@/components/layout/header/HeaderNav";
import { useMarketplaceCollectionsInfinite } from "@/hooks/marketplace";
import { useResolvedMediaUrlMap } from "@/hooks/media";
import { buildMarketsCollectionTitle } from "@/lib/markets/marketsCollectionTitle";
import { toCardDisplayUppercase } from "@/lib/marketplace/collectionFullDetailsTitle";
import { pickCollectionSummaryDisplayImageUrl } from "@/lib/marketplace/collectionDisplayImage";

/** Hex bucket keys are ~64 chars; short queries (esp. single digits 0–9) match almost every key and melt React. */
const MIN_QUERY_LEN_FOR_KEY_MATCH = 4;
const SEARCH_MAX_RESULTS = 64;
/**
 * Local dev: loopback API often loads the full catalog into memory; scanning 5k+ rows every keystroke freezes the tab.
 * Prod: slower network yields fewer loaded pages, so typing stays responsive. Cap prefetch so dev matches prod-ish cost.
 */
const SEARCH_PREFETCH_MAX_PAGES = 8;

/** Matches `<header className="… bg-gray-950/90">` — search + wallet controls sit flush on the bar. */
const HEADER_BAR_BG = "bg-gray-950/90";
const HEADER_BAR_BORDER = "border-gray-800/60";
const HEADER_BAR_BORDER_HOVER = "hover:border-gray-700/70";

/** Below `sm`: full-screen search overlay instead of a cramped header dropdown. */
function useNarrowViewport(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return narrow;
}

function SearchResultsList({
  filtered,
  highlightIdx,
  onHighlight,
  onSelect,
  searchTruncated,
  coverUrlMap,
  variant = "dropdown",
}: {
  filtered: MarketplaceCollectionSummary[];
  highlightIdx: number;
  onHighlight: (idx: number) => void;
  onSelect: (c: MarketplaceCollectionSummary) => void;
  searchTruncated: boolean;
  coverUrlMap: Map<string, string>;
  variant?: "dropdown" | "sheet";
}) {
  const rowPad = variant === "sheet" ? "px-4 py-3" : "px-2.5 py-1.5";
  const thumbSize = variant === "sheet" ? "h-11 w-11" : "h-7 w-7";

  if (filtered.length === 0) {
    return (
      <div
        className={
          variant === "sheet"
            ? "px-4 py-12 text-center text-sm text-gray-500"
            : "px-3 py-4 text-center text-xs text-gray-500"
        }
      >
        No collections found
      </div>
    );
  }

  return (
    <ul
      className={
        variant === "sheet"
          ? "divide-y divide-gray-800/80"
          : "max-h-[min(280px,50vh)] overflow-y-auto overscroll-contain py-1"
      }
      role="listbox"
    >
      {searchTruncated ? (
        <li
          className={
            variant === "sheet"
              ? "px-4 py-2 text-[11px] text-amber-200/90 bg-amber-500/[0.06]"
              : "px-2.5 py-1.5 text-[10px] text-amber-200/90 border-b border-gray-800/80"
          }
        >
          Showing first {SEARCH_MAX_RESULTS} matches — type more to narrow.
        </li>
      ) : null}
      {filtered.map((c, i) => {
        const displayImageUrl = pickCollectionSummaryDisplayImageUrl(c);
        return (
        <li
          key={c.collectionKey}
          role="option"
          aria-selected={i === highlightIdx}
          onMouseEnter={() => onHighlight(i)}
          onClick={() => onSelect(c)}
          className={`flex cursor-pointer items-center gap-3 transition-colors ${rowPad} ${
            i === highlightIdx
              ? "bg-mint/10"
              : variant === "sheet"
                ? "hover:bg-gray-800/50 active:bg-gray-800/70"
                : "hover:bg-gray-800/60"
          }`}
        >
          <div
            className={`${thumbSize} shrink-0 overflow-hidden rounded-lg border border-gray-700/50 bg-gray-800 flex items-center justify-center`}
          >
            {displayImageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={coverUrlMap.get(displayImageUrl) ?? displayImageUrl}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                />
              </svg>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={`font-medium uppercase text-white truncate ${
                variant === "sheet" ? "text-sm" : "text-xs"
              }`}
            >
              {buildMarketsCollectionTitle({ collection: c, comp: c.components })}
            </p>
            <p className={`truncate text-gray-500 ${variant === "sheet" ? "text-xs mt-0.5" : "text-[10px]"}`}>
              {c.activeListingCount} listing{c.activeListingCount !== 1 ? "s" : ""}
              {c.queryUsed ? ` · ${toCardDisplayUppercase(c.queryUsed)}` : ""}
            </p>
          </div>
          <svg
            className={`shrink-0 text-gray-600 ${variant === "sheet" ? "h-4 w-4" : "h-3 w-3"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </li>
      );
      })}
    </ul>
  );
}

function SearchBar({ compact = false }: { compact?: boolean }) {
  const narrowViewport = useNarrowViewport();
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const desktopWrapperRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const searchActive = narrowViewport ? mobileSheetOpen : desktopOpen;

  const colInfinite = useMarketplaceCollectionsInfinite();
  const collections = useMemo<MarketplaceCollectionSummary[]>(
    () => colInfinite.data?.pages.flatMap((p) => p.items) ?? [],
    [colInfinite.data],
  );
  const pagesLoaded = colInfinite.data?.pages.length ?? 0;

  useEffect(() => {
    if (!searchActive) return;
    if (pagesLoaded >= SEARCH_PREFETCH_MAX_PAGES) return;
    if (!colInfinite.hasNextPage) return;
    void colInfinite.fetchNextPage();
  }, [searchActive, pagesLoaded, colInfinite.hasNextPage, colInfinite.fetchNextPage]);

  const { filtered, searchTruncated } = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return { filtered: [] as MarketplaceCollectionSummary[], searchTruncated: false };
    const matchKey = q.length >= MIN_QUERY_LEN_FOR_KEY_MATCH;
    const matches: MarketplaceCollectionSummary[] = [];
    for (const c of collections) {
      const label = c.displayLabel.toLowerCase();
      const key = c.collectionKey.toLowerCase();
      const qUsed = (c.queryUsed ?? "").toLowerCase();
      const hit =
        label.includes(q) ||
        qUsed.includes(q) ||
        (matchKey && key.includes(q));
      if (hit) {
        matches.push(c);
        if (matches.length >= SEARCH_MAX_RESULTS) break;
      }
    }
    const searchTruncated = matches.length >= SEARCH_MAX_RESULTS;
    return { filtered: matches, searchTruncated };
  }, [deferredQuery, collections]);

  useEffect(() => {
    setHighlightIdx(-1);
  }, [query]);

  const closeAll = useCallback(() => {
    setQuery("");
    setDesktopOpen(false);
    setMobileSheetOpen(false);
    setHighlightIdx(-1);
    desktopInputRef.current?.blur();
    mobileInputRef.current?.blur();
  }, []);

  const openMobileSheet = useCallback(() => {
    setMobileSheetOpen(true);
  }, []);

  useEffect(() => {
    if (!mobileSheetOpen) return;
    const t = window.setTimeout(() => mobileInputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [mobileSheetOpen]);

  useEffect(() => {
    if (!mobileSheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileSheetOpen]);

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (narrowViewport) {
          setMobileSheetOpen(true);
        } else {
          setDesktopOpen(true);
          desktopInputRef.current?.focus();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [narrowViewport]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        desktopWrapperRef.current &&
        !desktopWrapperRef.current.contains(e.target as Node)
      ) {
        setDesktopOpen(false);
      }
    }
    if (desktopOpen && !narrowViewport) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [desktopOpen, narrowViewport]);

  function navigate(c: MarketplaceCollectionSummary) {
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

  const showDesktopDropdown = !narrowViewport && desktopOpen && query.trim().length > 0;
  const showMobileResults = mobileSheetOpen && query.trim().length > 0;

  const coverSources = useMemo(
    () => filtered.map((c) => pickCollectionSummaryDisplayImageUrl(c)),
    [filtered],
  );
  const { map: coverUrlMap } = useResolvedMediaUrlMap(coverSources, {
    enabled: (showDesktopDropdown || showMobileResults) && filtered.length > 0,
  });

  const mobileSheet =
    mobileSheetOpen && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[120] flex flex-col bg-gray-950 sm:hidden" role="dialog" aria-modal aria-label="Search collections">
            <div className="flex shrink-0 items-center gap-2 border-b border-gray-800/80 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
              <button
                type="button"
                onClick={closeAll}
                className="shrink-0 rounded-lg px-2 py-2 text-sm font-medium text-zinc-400 transition-colors hover:text-white active:bg-white/[0.06]"
              >
                Cancel
              </button>
              <div
                className={`flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 ${HEADER_BAR_BORDER} ${HEADER_BAR_BG}`}
              >
                <svg className="h-4 w-4 shrink-0 text-mint" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={mobileInputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search collections..."
                  className="min-w-0 flex-1 bg-transparent text-base text-white placeholder-gray-500 outline-none"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="search"
                />
                {query.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="shrink-0 rounded p-1 text-zinc-500 hover:text-zinc-200"
                    aria-label="Clear search"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                ) : null}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
              {!query.trim() ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm font-medium text-zinc-300">Find a collection</p>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                    Search by card name, set, or player.
                  </p>
                  {colInfinite.isFetching && pagesLoaded < SEARCH_PREFETCH_MAX_PAGES ? (
                    <p className="mt-4 text-[11px] text-zinc-600">Loading catalog…</p>
                  ) : null}
                </div>
              ) : (
                <SearchResultsList
                  filtered={filtered}
                  highlightIdx={highlightIdx}
                  onHighlight={setHighlightIdx}
                  onSelect={navigate}
                  searchTruncated={searchTruncated}
                  coverUrlMap={coverUrlMap}
                  variant="sheet"
                />
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {narrowViewport ? (
        <button
          type="button"
          onClick={openMobileSheet}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-mint transition-colors active:bg-white/[0.04] ${HEADER_BAR_BORDER} ${HEADER_BAR_BORDER_HOVER} ${HEADER_BAR_BG}`}
          aria-label="Search collections"
        >
          <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      ) : null}

      <div
        ref={desktopWrapperRef}
        className={`relative shrink-0 min-w-0 ${
          narrowViewport ? "hidden sm:block" : ""
        } ${compact ? "w-[108px] sm:w-[200px]" : "w-[124px] sm:w-[280px]"}`}
      >
        <div
          className={`flex h-10 w-full items-center gap-2 rounded-lg border px-3 transition-colors ${HEADER_BAR_BG} ${
            desktopOpen
              ? "border-gray-700/70"
              : `${HEADER_BAR_BORDER} ${HEADER_BAR_BORDER_HOVER}`
          }`}
          onClick={() => {
            if (!desktopOpen) setDesktopOpen(true);
          }}
        >
          <input
            ref={desktopInputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!desktopOpen) setDesktopOpen(true);
            }}
            onFocus={() => setDesktopOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search..."
            className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none cursor-text"
          />
          {!desktopOpen ? (
            <kbd className="hidden sm:inline-flex shrink-0 rounded border border-gray-700 px-1 py-0.5 font-mono text-[10px] text-gray-600">
              ⌘K
            </kbd>
          ) : null}
          <svg className="h-3.5 w-3.5 shrink-0 text-mint" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {showDesktopDropdown ? (
          <div className="absolute left-0 right-0 top-full z-[70] mt-1.5 overflow-hidden rounded-xl border border-gray-700/60 bg-gray-900/98 shadow-2xl shadow-black/50 backdrop-blur-lg sm:min-w-[280px]">
            <SearchResultsList
              filtered={filtered}
              highlightIdx={highlightIdx}
              onHighlight={setHighlightIdx}
              onSelect={navigate}
              searchTruncated={searchTruncated}
              coverUrlMap={coverUrlMap}
              variant="dropdown"
            />
          </div>
        ) : null}
      </div>

      {mobileSheet}
    </>
  );
}

export function AppHeader() {
  const pathname = usePathname();
  if (pathname === "/site-access" || pathname.startsWith("/site-access/")) {
    return null;
  }
  if (pathname.startsWith("/marketplace/admin")) {
    return null;
  }
  const isCollectionDetailHeader = isMarketplaceCollectionDetailPath(pathname);
  const headerShellClass = isCollectionDetailHeader
    ? COLLECTION_DETAIL_SHELL_CLASS
    : APP_MAIN_SHELL_CLASS;

  return (
    <>
      <HeaderAuthModals />
      <header className="border-b border-gray-800/60 backdrop-blur-sm sticky top-0 z-50 bg-gray-950/90">
        <div
          className={`${headerShellClass} h-16 flex items-center justify-between gap-3 sm:gap-4`}
        >
          <div className="flex h-full min-h-0 min-w-0 items-center gap-2 sm:gap-5">
            <Link href="/" className="mr-0.5 flex h-full shrink-0 items-center sm:mr-1.5">
              <img
                src={ASSETS.logo.tokenable}
                alt="Tokenable"
                className="h-8 w-auto object-contain"
              />
            </Link>
            <HeaderDesktopNav />
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <SearchBar compact={isCollectionDetailHeader} />
            <HeaderAuthControls />
          </div>
        </div>
      </header>
    </>
  );
}
