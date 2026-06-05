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
import { useAccount, useConnect, useDisconnect, useBalance } from "wagmi";
import { formatUnits } from "viem";
import { ASSETS } from "@/constants/assets";
import {
  APP_MAIN_SHELL_CLASS,
  COLLECTION_DETAIL_SHELL_CLASS,
  isMarketplaceCollectionDetailPath,
} from "@/constants/layout";
import { sepolia } from "@/config/wagmi";
import type { MarketplaceCollectionSummary } from "@/lib/core";
import { ensureSepoliaNetwork } from "@/lib/network";
import {
  connectMetaMaskWallet,
  findMetaMaskConnector,
} from "@/lib/wallet/connectMetaMaskWallet";
import {
  isWalletSessionActive,
  isWalletSessionPending,
} from "@/lib/wallet/walletConnectionDisplay";
import { WalletAddressCompact } from "@/components/wallet/WalletAddressCompact";
import { useMarketplaceCollectionsInfinite } from "@/hooks/marketplace";
import { useResolvedMediaUrlMap } from "@/hooks/media";
import { useAppStore, selectUsdcBalance } from "@/store";
import { useShallow } from "zustand/react/shallow";
import { buildMarketsCollectionTitle } from "@/lib/markets/marketsCollectionTitle";
import { toCardDisplayUppercase } from "@/lib/marketplace/collectionFullDetailsTitle";

/** Hex bucket keys are ~64 chars; short queries (esp. single digits 0–9) match almost every key and melt React. */
const MIN_QUERY_LEN_FOR_KEY_MATCH = 4;
const SEARCH_MAX_RESULTS = 64;
/**
 * Local dev: loopback API often loads the full catalog into memory; scanning 5k+ rows every keystroke freezes the tab.
 * Prod: slower network yields fewer loaded pages, so typing stays responsive. Cap prefetch so dev matches prod-ish cost.
 */
const SEARCH_PREFETCH_MAX_PAGES = 8;

/** Exact path or nested routes (strip query/hash before compare). */
function isPrimaryHeaderNavActive(pathname: string | null | undefined, href: string): boolean {
  if (!pathname) return false;
  let pathOnly = pathname;
  const qIdx = pathOnly.indexOf("?");
  if (qIdx >= 0) pathOnly = pathOnly.slice(0, qIdx);
  const hIdx = pathOnly.indexOf("#");
  if (hIdx >= 0) pathOnly = pathOnly.slice(0, hIdx);
  if (pathOnly === href) return true;
  const base = href.replace(/\/$/, "");
  return pathOnly.startsWith(`${base}/`);
}

/** Listing catalog IA: Markets index plus collection detail (+ other pooled listings page). */
function isMarketsPrimaryNavActive(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (isPrimaryHeaderNavActive(pathname, "/markets")) return true;
  if (isMarketplaceCollectionDetailPath(pathname)) return true;
  let pathOnly = pathname;
  const qi = pathOnly.indexOf("?");
  if (qi >= 0) pathOnly = pathOnly.slice(0, qi);
  const hi = pathOnly.indexOf("#");
  if (hi >= 0) pathOnly = pathOnly.slice(0, hi);
  const hub = "/marketplace/other-listings";
  return pathOnly === hub || pathOnly.startsWith(`${hub}/`);
}

const MAIN_HEADER_NAV = [
  { href: "/markets", label: "Markets" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/vault", label: "Sell" },
] as const satisfies readonly { readonly href: string; readonly label: string }[];

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
      {filtered.map((c, i) => (
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
            {c.coverImageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={coverUrlMap.get(c.coverImageUrl.trim()) ?? c.coverImageUrl.trim()}
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
      ))}
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
    () => filtered.map((c) => c.coverImageUrl),
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

const DROPDOWN_ITEMS = [
  { label: "Portfolio", href: "/portfolio", icon: "wallet" as const, available: true },
  { label: "Transaction History", href: "#", icon: "history" as const, available: false },
  { label: "Watchlist", href: "#", icon: "star" as const, available: false },
  { label: "Notifications", href: "#", icon: "bell" as const, available: false },
  { label: "Rewards", href: "#", icon: "gift" as const, available: false },
  { label: "Settings", href: "#", icon: "settings" as const, available: false },
] as const;

type IconName = (typeof DROPDOWN_ITEMS)[number]["icon"];

function DropdownIcon({ name, className }: { name: IconName; className?: string }) {
  const c = className ?? "w-4 h-4";
  switch (name) {
    case "wallet":
      return <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 110-6h3.75A2.25 2.25 0 0121 6v6zm0 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18V6a2.25 2.25 0 012.25-2.25h13.5" /><circle cx="17.25" cy="12" r="1" fill="currentColor" /></svg>;
    case "history":
      return <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    case "star":
      return <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>;
    case "bell":
      return <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>;
    case "gift":
      return <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H4.5a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>;
    case "settings":
      return <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
  }
}

function WalletDropdown() {
  const {
    address,
    isConnected,
    isConnecting,
    isReconnecting,
    chain,
    connector,
  } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address, chainId: sepolia.id });
  const { usdcBalanceFormatted } = useAppStore(useShallow(selectUsdcBalance));
  const [open, setOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isWrongNetwork = isConnected && chain?.id !== sepolia.id;

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);

  async function handleSwitchToSepolia() {
    if (!connector) return;
    setIsSwitching(true);
    try {
      const provider = (await connector.getProvider()) as {
        request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      } | null;
      if (provider?.request) {
        await ensureSepoliaNetwork(
          provider as Parameters<typeof ensureSepoliaNetwork>[0],
        );
      }
    } finally {
      setIsSwitching(false);
    }
  }

  const sessionActive = isWalletSessionActive({
    address,
    isConnected,
    isConnecting,
    isReconnecting,
  });
  const sessionPending = isWalletSessionPending({
    address,
    isConnected,
    isConnecting,
    isReconnecting,
  });

  if (sessionPending) {
    return (
      <button
        type="button"
        disabled
        className={`flex h-10 min-w-0 touch-manipulation items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-semibold text-zinc-400 sm:w-[164px] sm:gap-2 sm:px-4 ${HEADER_BAR_BORDER} ${HEADER_BAR_BG}`}
      >
        {isReconnecting ? "Reconnecting…" : "Connecting…"}
      </button>
    );
  }

  if (!sessionActive || !address) {
    return (
      <button
        type="button"
        onClick={() => connectMetaMaskWallet(connect, connectors)}
        disabled={isPending || !findMetaMaskConnector(connectors)}
        className={`flex h-10 min-w-0 touch-manipulation items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-semibold text-mint transition-colors hover:text-mint-dim active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 sm:w-[164px] sm:gap-2 sm:px-4 ${HEADER_BAR_BORDER} ${HEADER_BAR_BORDER_HOVER} ${HEADER_BAR_BG}`}
      >
        <svg className="hidden h-4 w-4 sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 110-6h3.75A2.25 2.25 0 0121 6v6zm0 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18V6a2.25 2.25 0 012.25-2.25h13.5" />
        </svg>
        {isPending ? "Connecting…" : "Connect"}
      </button>
    );
  }

  const ethBal =
    balance
      ? `${parseFloat(formatUnits(balance.value, balance.decimals)).toFixed(4)} ETH`
      : "—";
  const usdcBal = parseFloat(usdcBalanceFormatted).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((p) => !p)}
        className={`flex h-10 w-max max-w-[min(100vw-7rem,17rem)] items-center justify-between gap-2 rounded-xl border px-2.5 sm:min-w-[10.5rem] sm:px-3 text-sm transition-colors ${HEADER_BAR_BG} ${
          open
            ? "border-gray-700/70"
            : `${HEADER_BAR_BORDER} ${HEADER_BAR_BORDER_HOVER}`
        }`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${isWrongNetwork ? "bg-red-400" : "bg-mint"}`}
            aria-hidden
          />
          <WalletAddressCompact address={address} />
        </span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-gray-700/60 bg-gray-900/98 shadow-2xl shadow-black/40 backdrop-blur-lg overflow-hidden z-[60]">
          {/* Wallet summary */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-800/60">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-mint/15 border border-mint/25">
                <svg className="w-4 h-4 text-mint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 110-6h3.75A2.25 2.25 0 0121 6v6zm0 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18V6a2.25 2.25 0 012.25-2.25h13.5" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="min-w-0 whitespace-nowrap">
                  <WalletAddressCompact address={address} variant="panel" />
                </div>
                <p className="text-[11px] text-gray-500">Ethereum Sepolia</p>
              </div>
              {isWrongNetwork && (
                <span className="ml-auto text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full">
                  Wrong Network
                </span>
              )}
            </div>
            {/* Balances */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-gray-800/60 px-3 py-2">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">ETH</p>
                <p className="text-sm font-medium text-white">{ethBal}</p>
              </div>
              <div className="rounded-lg bg-gray-800/60 px-3 py-2">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">USDC</p>
                <p className="text-sm font-medium text-white">{usdcBal}</p>
              </div>
            </div>
          </div>

          {/* Wrong network action */}
          {isWrongNetwork && (
            <div className="px-4 py-2 border-b border-gray-800/60">
              <button
                onClick={() => void handleSwitchToSepolia()}
                disabled={isSwitching}
                className="w-full rounded-lg bg-red-500/15 border border-red-500/30 py-2 text-xs font-medium text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-50"
              >
                {isSwitching ? "Switching..." : "Switch to Sepolia"}
              </button>
            </div>
          )}

          {/* Menu items */}
          <div className="py-1">
            {DROPDOWN_ITEMS.map((item) => {
              const inner = (
                <div className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-gray-800/50 group">
                  <DropdownIcon
                    name={item.icon}
                    className={`w-4 h-4 ${item.available ? "text-gray-400 group-hover:text-white" : "text-gray-600"}`}
                  />
                  <span className={item.available ? "text-gray-300 group-hover:text-white" : "text-gray-600"}>
                    {item.label}
                  </span>
                  {!item.available && (
                    <span className="ml-auto text-[10px] text-gray-600 border border-gray-700/60 rounded px-1.5 py-0.5">
                      Soon
                    </span>
                  )}
                </div>
              );
              if (item.available) {
                return (
                  <Link key={item.label} href={item.href} onClick={close}>
                    {inner}
                  </Link>
                );
              }
              return (
                <div key={item.label} className="cursor-default">
                  {inner}
                </div>
              );
            })}
          </div>

          {/* Disconnect */}
          <div className="border-t border-gray-800/60 p-2">
            <button
              onClick={() => {
                disconnect();
                close();
              }}
              className="w-full flex items-center justify-center gap-2 rounded-lg py-2 text-sm text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3-3l3-3m0 0l-3-3m3 3H9" />
              </svg>
              Disconnect Wallet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AppHeader() {
  const pathname = usePathname();
  const isCollectionDetailHeader = isMarketplaceCollectionDetailPath(pathname);
  const headerShellClass = isCollectionDetailHeader
    ? COLLECTION_DETAIL_SHELL_CLASS
    : APP_MAIN_SHELL_CLASS;

  return (
    <header className="border-b border-gray-800/60 backdrop-blur-sm sticky top-0 z-50 bg-gray-950/90">
      <div
        className={`${headerShellClass} h-16 flex items-center justify-between gap-3 sm:gap-4`}
      >
        {/* Left: logo + nav */}
        <div className="flex h-full min-h-0 min-w-0 items-center gap-3 sm:gap-5">
          <Link href="/" className="mr-1 flex h-full shrink-0 items-center gap-3 sm:mr-1.5">
            <img
              src={ASSETS.logo.tokenable}
              alt="Tokenable"
              className="h-8 w-auto object-contain"
            />
          </Link>
          <div className="hidden sm:ml-1 sm:flex h-full items-center gap-8 md:ml-3">
            {MAIN_HEADER_NAV.map(({ href, label }) => {
              const active =
                href === "/markets"
                  ? isMarketsPrimaryNavActive(pathname)
                  : isPrimaryHeaderNavActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex h-full items-center text-[15px] font-semibold leading-normal tracking-tight transition-colors sm:text-base ${
                    active ? "text-mint" : "text-gray-400 hover:text-white"
                  }`}
                >
                  {label}
                  {active ? (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute bottom-[10px] left-1/2 h-[3px] w-[calc(100%+12px)] max-w-none -translate-x-1/2 rounded-t-[2px] bg-mint sm:bottom-3 sm:rounded-t-[1px]"
                    />
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right: search + wallet */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <SearchBar compact={isCollectionDetailHeader} />
          <WalletDropdown />
        </div>
      </div>
    </header>
  );
}
