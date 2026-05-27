"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  getActiveOrders,
  getApiUrl,
  postMarketplaceCollectionSnapshotsBatched,
  rq,
  marketplaceRqPolicy,
  type CollectionListMarketSnapshot,
  type MarketplaceCollectionSummary,
} from "@/lib/core";
import { useMarketplaceCollectionsInfinite } from "@/hooks/useMarketplaceCollectionsInfinite";
import { CollectionCoverFrame } from "@/components/marketplace/CollectionCoverFrame";
import { useResolvedMediaUrlMap } from "@/hooks/useResolvedMediaUrl";
import { CollectionCategoryFilterBar } from "@/components/marketplace/CollectionCategoryFilterBar";
import { CollectionListSparkline } from "@/components/marketplace/CollectionListSparkline";
import { ExchangeListingPriceWithChange } from "@/components/marketplace/ExchangeListingPrice";
import {
  collectionMatchesCategoryFilter,
  formatReferenceChangeCoverageHint,
  formatReferenceChangePeriodFromSnapshotMeta,
  MARKET_PRICE_CHANGE_SNAPSHOT_DURATION,
  referenceChangePeriodFromSnapshotMeta,
  MARKETS_CATEGORY_FILTERS,
  MARKETS_DEFAULT_CATEGORY_FILTER,
  type CollectionCategoryFilterId,
} from "@/lib/market";
import { parseGradeScoreNumber, representativeGradeUsd } from "@/lib/market";
import { toCardDisplayUppercase } from "@/lib/marketplace/collectionFullDetailsTitle";
import {
  bucketCardNameForDisplay,
  bucketCardSetForDisplay,
} from "@/lib/marketplace/bucketKey";

function buildMarketsCollectionTitle(params: {
  collection: MarketplaceCollectionSummary;
  comp: Record<string, unknown>;
}): string {
  const { collection, comp } = params;

  const extractYear = (s: string): number | null => {
    const m = /\b(18\d{2}|19\d{2}|20\d{2}|2100)\b/.exec(s);
    if (!m) return null;
    const y = Number(m[1]);
    return Number.isFinite(y) && y >= 1880 && y <= 2100 ? y : null;
  };

  const stripYearToken = (s: string, y: number | null): string => {
    const t = s.trim();
    if (!t || y == null) return t;
    return t.replace(new RegExp(`\\b${String(y)}\\b`), "").replace(/\s+/g, " ").trim();
  };

  let setName = bucketCardSetForDisplay(comp).trim();
  let cardName = bucketCardNameForDisplay(comp).trim();

  const dl =
    typeof collection.displayLabel === "string" ? collection.displayLabel.trim() : "";

  // Prefer structured year when present.
  const yearFromCompRaw = (comp as Record<string, unknown>).year;
  const yearFromComp =
    typeof yearFromCompRaw === "number" && Number.isFinite(yearFromCompRaw)
      ? yearFromCompRaw
      : typeof yearFromCompRaw === "string"
        ? extractYear(yearFromCompRaw)
        : null;

  // Legacy fallback: displayLabel encodes "CardName <year> SetName" (no delimiter).
  // Example: "Pikachu with Grey Felt Hat 2023 Pokemon Scarlet & ..."
  if (!setName && dl) {
    const m = /^(.*?)\b(18\d{2}|19\d{2}|20\d{2}|2100)\b\s+(.+)$/.exec(dl);
    if (m) {
      const left = (m[1] ?? "").trim();
      const year = (m[2] ?? "").trim();
      const right = (m[3] ?? "").trim();
      if (!cardName && left) cardName = left;
      if (right) setName = year ? `${year} ${right}` : right;
    }
  }

  // Legacy fallback: "CARD · SET" / "CARD | SET" / "CARD - SET"
  if (!setName && dl) {
    const parts = dl.split(/[-–·|]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length === 2) {
      const [left, right] = parts;
      if (!cardName && left) cardName = left;
      if (right) setName = right;
    }
  }

  const year =
    yearFromComp ??
    extractYear(setName) ??
    extractYear(dl) ??
    null;

  const setNoYear = stripYearToken(setName, year);
  const titleParts = [
    year != null ? String(year) : "",
    setNoYear,
    cardName,
  ].filter((s) => s && s.trim().length > 0);
  const out = titleParts.length > 0 ? titleParts.join(" ") : dl;
  return toCardDisplayUppercase(out);
}

function formatUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const digits = abs >= 1000 ? 0 : 2;
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })}`;
}

/** `(compare − ref) / ref × 100` — e.g. last sale vs external reference index */
function percentDiffVersusRef(
  compare: number | null | undefined,
  ref: number | null | undefined,
): number | null {
  if (
    compare == null ||
    ref == null ||
    !Number.isFinite(compare) ||
    !Number.isFinite(ref) ||
    ref <= 0
  ) {
    return null;
  }
  return ((compare - ref) / ref) * 100;
}

/** Grid / list layout toggle — selected: white; unselected: dark grey (no mint). */
const EXCHANGE_VIEW_TOGGLE_ACTIVE =
  "rounded-lg border border-white/75 bg-white/[0.06] text-white hover:border-white/90";
const EXCHANGE_VIEW_TOGGLE_INACTIVE =
  "rounded-lg border border-zinc-700/80 bg-zinc-900/50 text-zinc-500 hover:border-zinc-600/80 hover:text-zinc-400";

function ExchangeLayoutToggleButton({
  active,
  onClick,
  ariaLabel,
  children,
}: {
  active: boolean;
  onClick: () => void;
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={`inline-flex h-11 w-11 touch-manipulation items-center justify-center transition-colors sm:h-10 sm:w-10 ${
        active ? EXCHANGE_VIEW_TOGGLE_ACTIVE : EXCHANGE_VIEW_TOGGLE_INACTIVE
      }`}
    >
      {children}
    </button>
  );
}

/** No `display` here — callers set `inline-flex` / `hidden` so Tailwind does not conflict. */
const EXCHANGE_LAYOUT_TOGGLE_SHELL =
  "shrink-0 items-center gap-1 rounded-xl border border-zinc-700/80 bg-zinc-900/80 p-1";

const EXCHANGE_SORT_OPTIONS = [
  { id: "recent_listed", label: "Recent listed" },
  { id: "pct_change_high", label: "% Chg. (high)" },
  { id: "high_price", label: "High price" },
  { id: "low_price", label: "Low price" },
  { id: "recent_sold", label: "Recent sold" },
] as const;

type ExchangeSortId = (typeof EXCHANGE_SORT_OPTIONS)[number]["id"];

function ExchangeLayoutToggleGroup({
  viewMode,
  onGrid,
  onSortMenu,
  sortMenuOpen = false,
  className = "",
}: {
  viewMode: "list" | "grid";
  onGrid: () => void;
  onSortMenu: () => void;
  sortMenuOpen?: boolean;
  className?: string;
}) {
  return (
    <div
      className={[className, EXCHANGE_LAYOUT_TOGGLE_SHELL].filter(Boolean).join(" ")}
      role="group"
      aria-label="Collection layout and sort"
    >
      <ExchangeLayoutToggleButton
        active={viewMode === "grid"}
        onClick={onGrid}
        ariaLabel="Grid view"
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden>
          <rect x="1" y="1" width="6" height="6" rx="1" />
          <rect x="9" y="1" width="6" height="6" rx="1" />
          <rect x="1" y="9" width="6" height="6" rx="1" />
          <rect x="9" y="9" width="6" height="6" rx="1" />
        </svg>
      </ExchangeLayoutToggleButton>
      <ExchangeLayoutToggleButton
        active={sortMenuOpen}
        onClick={onSortMenu}
        ariaLabel="Sort collections"
        aria-haspopup="menu"
        aria-expanded={sortMenuOpen}
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden>
          <rect x="1" y="2" width="14" height="2" rx="1" />
          <rect x="1" y="7" width="14" height="2" rx="1" />
          <rect x="1" y="12" width="14" height="2" rx="1" />
        </svg>
      </ExchangeLayoutToggleButton>
    </div>
  );
}

function ExchangeSortMenu({
  open,
  sortId,
  onSelect,
  onClose,
}: {
  open: boolean;
  sortId: ExchangeSortId;
  onSelect: (id: ExchangeSortId) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[130] cursor-default bg-transparent"
        aria-label="Close sort menu"
        onClick={onClose}
      />
      <div
        role="menu"
        aria-label="Sort"
        className="absolute right-0 top-[calc(100%+0.5rem)] z-[131] w-[min(100vw-1.5rem,15.5rem)] overflow-hidden rounded-xl border border-zinc-700/80 bg-zinc-900/95 py-1.5 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.85)] ring-1 ring-white/[0.06] backdrop-blur-sm"
      >
        <p className="px-3.5 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Sort
        </p>
        {EXCHANGE_SORT_OPTIONS.map((opt) => {
          const selected = sortId === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              onClick={() => {
                onSelect(opt.id);
                onClose();
              }}
              className={`flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-[13px] font-medium transition-colors ${
                selected
                  ? "bg-white/[0.08] text-white"
                  : "text-zinc-300 hover:bg-white/[0.05] hover:text-white"
              }`}
            >
              <span>{opt.label}</span>
              {selected ? (
                <span className="text-mint" aria-hidden>
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </>
  );
}

function ExchangeMarketsViewToolbar({
  viewMode,
  onGrid,
  sortId,
  onSortChange,
  className = "",
}: {
  viewMode: "list" | "grid";
  onGrid: () => void;
  sortId: ExchangeSortId;
  onSortChange: (id: ExchangeSortId) => void;
  className?: string;
}) {
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  useEffect(() => {
    if (!sortMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSortMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sortMenuOpen]);

  return (
    <div className={`relative ${className}`.trim()}>
      <ExchangeLayoutToggleGroup
        viewMode={viewMode}
        onGrid={() => {
          setSortMenuOpen(false);
          onGrid();
        }}
        sortMenuOpen={sortMenuOpen}
        onSortMenu={() => setSortMenuOpen((open) => !open)}
      />
      <ExchangeSortMenu
        open={sortMenuOpen}
        sortId={sortId}
        onSelect={onSortChange}
        onClose={() => setSortMenuOpen(false)}
      />
    </div>
  );
}

/** Grid + list pills — never wrap; row scrolls horizontally when overflow. */
const EXCHANGE_CARD_BADGE_BASE =
  "box-border inline-flex min-h-[20px] shrink-0 items-center justify-center rounded-[4px] border px-1.5 py-0.5 text-[10px] font-semibold leading-none tracking-tight sm:min-h-[22px] sm:rounded-[3px] sm:px-[5px] sm:py-0 sm:text-[10px] md:text-[11px]";

/** Pop / Listed / window labels — neutral chrome; values styled per badge type */
const EXCHANGE_CARD_BADGE_NEUTRAL = `${EXCHANGE_CARD_BADGE_BASE} gap-0.5 whitespace-nowrap border-[rgba(255,255,255,0.22)] bg-black/50 text-zinc-400`;

const EXCHANGE_CARD_BADGE_KV_LABEL = "text-zinc-400";
const EXCHANGE_CARD_BADGE_KV_VALUE = "tabular-nums text-white";

/** Single-line badge strip — swipe/scroll on overflow instead of wrapping. */
const EXCHANGE_CARD_INFO_BADGE_ROW =
  "mobile-scroll-x-contain flex min-w-0 max-w-full flex-nowrap items-center gap-1 scroll-smooth touch-pan-x [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-[380px]:gap-0.5 sm:gap-1.5";

/** Grid cards use the same single-line scroll row (tighter gap on very narrow widths). */
const EXCHANGE_GRID_CARD_BADGE_ROW = EXCHANGE_CARD_INFO_BADGE_ROW;

function exchangePctValueClass(pct: number): string {
  return pct >= 0 ? "text-[rgba(16,211,51,1)]" : "text-rose-300";
}

/** Compact counts in pills (full value stays in `title`). */
function formatExchangeBadgeCount(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m >= 10 ? Math.round(m) : m.toFixed(1)}M`;
  }
  if (abs >= 10_000) {
    const k = n / 1_000;
    return `${k >= 100 ? Math.round(k) : k.toFixed(1)}k`;
  }
  return n.toLocaleString("en-US");
}

function ExchangeKvBadge({
  label,
  value,
  title,
  valueClassName,
}: {
  label: string;
  value: string;
  title?: string;
  valueClassName?: string;
}) {
  return (
    <span className={EXCHANGE_CARD_BADGE_NEUTRAL} title={title ?? `${label} ${value}`}>
      <span className={EXCHANGE_CARD_BADGE_KV_LABEL}>{label}</span>
      <span className={valueClassName ?? EXCHANGE_CARD_BADGE_KV_VALUE}>{value}</span>
    </span>
  );
}

function collectionKeyLower(c: MarketplaceCollectionSummary): string {
  return c.collectionKey?.trim().toLowerCase() ?? "";
}

/** Collection list card “Price” — tier-aware Cardhedger / grade strip from batch snapshots. */
function exchangeListMarketPriceUsd(
  collection: MarketplaceCollectionSummary,
  snapshot: CollectionListMarketSnapshot | undefined,
): number {
  const comp = collection.components as Record<string, unknown> & { gradeScore?: string };
  const usd = representativeGradeUsd(
    snapshot?.gradePrices ?? null,
    parseGradeScoreNumber(comp.gradeScore),
    comp.gradeScore,
  );
  if (usd != null && Number.isFinite(usd) && usd > 0) return usd;
  return Number.NEGATIVE_INFINITY;
}

function exchangeHasListMarketPrice(
  collection: MarketplaceCollectionSummary,
  snapshot: CollectionListMarketSnapshot | undefined,
): boolean {
  return exchangeListMarketPriceUsd(collection, snapshot) !== Number.NEGATIVE_INFINITY;
}

function compareExchangeByLabel(
  a: MarketplaceCollectionSummary,
  b: MarketplaceCollectionSummary,
): number {
  return (a.displayLabel ?? "").localeCompare(b.displayLabel ?? "");
}

function compareExchangeByMarketPriceDesc(
  a: MarketplaceCollectionSummary,
  b: MarketplaceCollectionSummary,
  snapByKey: Map<string, CollectionListMarketSnapshot>,
): number {
  const pa = exchangeListMarketPriceUsd(a, snapByKey.get(collectionKeyLower(a)));
  const pb = exchangeListMarketPriceUsd(b, snapByKey.get(collectionKeyLower(b)));
  if (pa !== pb) return pb - pa;
  return compareExchangeByLabel(a, b);
}

function compareExchangeByMarketPriceAsc(
  a: MarketplaceCollectionSummary,
  b: MarketplaceCollectionSummary,
  snapByKey: Map<string, CollectionListMarketSnapshot>,
): number {
  return compareExchangeByMarketPriceDesc(b, a, snapByKey);
}

function compareExchangeByMarketChangePct(
  a: MarketplaceCollectionSummary,
  b: MarketplaceCollectionSummary,
  snapByKey: Map<string, CollectionListMarketSnapshot>,
): number {
  const pa = snapByKey.get(collectionKeyLower(a))?.marketChangePct;
  const pb = snapByKey.get(collectionKeyLower(b))?.marketChangePct;
  const na =
    pa != null && Number.isFinite(pa) ? pa : Number.NEGATIVE_INFINITY;
  const nb =
    pb != null && Number.isFinite(pb) ? pb : Number.NEGATIVE_INFINITY;
  if (na !== nb) return nb - na;
  return compareExchangeByLabel(a, b);
}

function compareExchangeByRecentSold(
  a: MarketplaceCollectionSummary,
  b: MarketplaceCollectionSummary,
  snapByKey: Map<string, CollectionListMarketSnapshot>,
): number {
  const ta = snapByKey.get(collectionKeyLower(a))?.lastTokenableTradeAtSec ?? 0;
  const tb = snapByKey.get(collectionKeyLower(b))?.lastTokenableTradeAtSec ?? 0;
  if (ta !== tb) return tb - ta;
  return compareExchangeByLabel(a, b);
}

function exchangeListMarketRecencyMs(
  collection: MarketplaceCollectionSummary,
  snapshot: CollectionListMarketSnapshot | undefined,
): number {
  const synced = snapshot?.syncedAt ? Date.parse(snapshot.syncedAt) : Number.NaN;
  if (Number.isFinite(synced)) return synced;
  const created = Date.parse(collection.createdAt);
  return Number.isFinite(created) ? created : 0;
}

/** Newest collection-list market rows first (snapshot sync / registration; not ask orders). */
function compareExchangeByRecentListed(
  a: MarketplaceCollectionSummary,
  b: MarketplaceCollectionSummary,
  snapByKey: Map<string, CollectionListMarketSnapshot>,
): number {
  const ta = exchangeListMarketRecencyMs(a, snapByKey.get(collectionKeyLower(a)));
  const tb = exchangeListMarketRecencyMs(b, snapByKey.get(collectionKeyLower(b)));
  if (ta !== tb) return tb - ta;
  return compareExchangeByLabel(a, b);
}

function compareExchangeCollections(
  a: MarketplaceCollectionSummary,
  b: MarketplaceCollectionSummary,
  sortId: ExchangeSortId,
  snapByKey: Map<string, CollectionListMarketSnapshot>,
): number {
  const snapA = snapByKey.get(collectionKeyLower(a));
  const snapB = snapByKey.get(collectionKeyLower(b));
  const hasPriceA = exchangeHasListMarketPrice(a, snapA);
  const hasPriceB = exchangeHasListMarketPrice(b, snapB);
  if (hasPriceA !== hasPriceB) {
    return hasPriceA ? -1 : 1;
  }

  switch (sortId) {
    case "recent_listed":
      return compareExchangeByRecentListed(a, b, snapByKey);
    case "pct_change_high":
      return compareExchangeByMarketChangePct(a, b, snapByKey);
    case "low_price":
      return compareExchangeByMarketPriceAsc(a, b, snapByKey);
    case "recent_sold":
      return compareExchangeByRecentSold(a, b, snapByKey);
    case "high_price":
    default:
      return compareExchangeByMarketPriceDesc(a, b, snapByKey);
  }
}

function CollectionRow({
  collection,
  listingCount,
  snapshot,
  resolvedCoverUrl,
  marketChangeLoading = false,
}: {
  collection: MarketplaceCollectionSummary;
  listingCount: number;
  snapshot: CollectionListMarketSnapshot | undefined;
  resolvedCoverUrl?: string;
  marketChangeLoading?: boolean;
}) {
  const comp = collection.components as Record<string, unknown> & { gradeScore?: string };

  const jtSpot = representativeGradeUsd(
    snapshot?.gradePrices ?? null,
    parseGradeScoreNumber(comp.gradeScore),
    comp.gradeScore,
  );

  const ms = snapshot?.marketStats ?? null;
  const floor =
    ms?.floor != null && Number.isFinite(ms.floor) && ms.floor > 0 ? ms.floor : null;
  const lastTrade =
    snapshot?.lastTokenableTradeUsdc != null &&
    Number.isFinite(snapshot.lastTokenableTradeUsdc)
      ? snapshot.lastTokenableTradeUsdc
      : null;
  const refUsd = jtSpot != null && Number.isFinite(jtSpot) && jtSpot > 0 ? jtSpot : null;
  const sparklinePoints =
    snapshot?.sparklineUsd != null && snapshot.sparklineUsd.length >= 2
      ? snapshot.sparklineUsd
      : null;
  const effectiveRefUsd = refUsd;
  const tokenablePrice = floor ?? lastTrade;
  const tokenableVsRefPct = percentDiffVersusRef(tokenablePrice, effectiveRefUsd);
  const changePctExternal =
    snapshot?.marketChangePct != null && Number.isFinite(snapshot.marketChangePct)
      ? snapshot.marketChangePct
      : null;
  const changePeriodMeta = referenceChangePeriodFromSnapshotMeta(snapshot);
  const changeWindowShort = formatReferenceChangePeriodFromSnapshotMeta(snapshot);
  const changeCoverageHint = formatReferenceChangeCoverageHint(changePeriodMeta);
  const pop = parsePsaPopulationFromComponents(comp);
  const marketsTitle = buildMarketsCollectionTitle({ collection, comp });

  return (
    <Link
      href={`/marketplace/collections/${encodeURIComponent(collection.collectionKey)}`}
      className="group flex flex-col gap-3 rounded-2xl border border-zinc-700/70 bg-gradient-to-r from-[#0f1117] via-[#10131a] to-[#0e1218] px-3 py-3 transition-all hover:border-mint/35 hover:shadow-[0_0_26px_rgba(16,211,51,0.12)] sm:flex-row sm:items-center sm:gap-6 sm:rounded-3xl sm:px-6 sm:py-6"
    >
      <div className="flex min-w-0 flex-row items-start gap-3 sm:contents">
        <div className="relative w-[min(96px,26vw)] shrink-0 sm:w-[196px] sm:shrink-0">
          {(resolvedCoverUrl || collection.coverImageUrl) ? (
            <div className="aspect-[3/4] w-full overflow-hidden rounded-xl border border-gray-800/80 sm:rounded-2xl">
              <CollectionCoverFrame
                imageUrl={resolvedCoverUrl || collection.coverImageUrl!}
                variant="compact"
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="aspect-[3/4] w-full rounded-xl border border-gray-800 bg-gray-900 sm:rounded-2xl" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 break-words text-base font-extrabold uppercase leading-snug tracking-tight text-white transition-colors group-hover:text-mint sm:line-clamp-1 sm:truncate sm:text-2xl">
            {marketsTitle}
          </h3>
          <div className={`mt-1.5 ${EXCHANGE_CARD_INFO_BADGE_ROW}`}>
          {pop != null ? (
            <ExchangeKvBadge
              label="Pop"
              value={formatExchangeBadgeCount(pop)}
              title={`PSA population: ${pop.toLocaleString()}`}
            />
          ) : null}
          <ExchangeKvBadge
            label="Listed"
            value={formatExchangeBadgeCount(listingCount)}
            title={`${listingCount} listing${listingCount !== 1 ? "s" : ""} on Tokenable`}
          />
          {tokenableVsRefPct != null ? (
            <span
              className={EXCHANGE_CARD_BADGE_NEUTRAL}
              title={`Tokenable Price (${tokenablePrice != null ? formatUsd(tokenablePrice) : "—"}) vs eBay (${effectiveRefUsd != null ? formatUsd(effectiveRefUsd) : "—"})`}
            >
              <span>Gap </span>
              <span className={`tabular-nums ${exchangePctValueClass(tokenableVsRefPct)}`}>
                {tokenableVsRefPct >= 0 ? "+" : ""}
                {tokenableVsRefPct.toFixed(1)}%
              </span>
            </span>
          ) : null}
        </div>
        <div className="mt-2.5 flex items-baseline justify-between gap-2 sm:mt-3">
          <span className="shrink-0 text-sm text-white">Price</span>
          <ExchangeListingPriceWithChange
            priceUsd={effectiveRefUsd}
            changePct={changePctExternal}
            loading={marketChangeLoading}
            windowShort={changeWindowShort}
            titleDetail={changeCoverageHint}
            priceTitle="External eBay reference price."
          />
        </div>
        </div>
      </div>

      <div className="flex w-full min-w-0 shrink-0 flex-col items-stretch gap-1 sm:w-auto sm:items-end">
        <CollectionListSparkline
          points={sparklinePoints}
          positive={changePctExternal == null ? undefined : changePctExternal >= 0}
          className="h-12 w-full max-w-full sm:h-20 sm:w-40"
        />
      </div>
    </Link>
  );
}

function parsePsaPopulationFromComponents(components: Record<string, unknown>): number | null {
  const raw = components.psaTotalPopulation;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    return Math.floor(raw);
  }
  if (typeof raw === "string" && raw.trim()) {
    const n = Number(String(raw).replace(/,/g, ""));
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return null;
}

function CollectionGridCard({
  collection,
  snapshot,
  resolvedCoverUrl,
  listingCount,
  marketChangeLoading = false,
}: {
  collection: MarketplaceCollectionSummary;
  snapshot: CollectionListMarketSnapshot | undefined;
  resolvedCoverUrl?: string;
  listingCount: number;
  marketChangeLoading?: boolean;
}) {
  const comp = collection.components as Record<string, unknown> & { gradeScore?: string };
  const jtSpot = representativeGradeUsd(
    snapshot?.gradePrices ?? null,
    parseGradeScoreNumber(comp.gradeScore),
    comp.gradeScore,
  );
  const marketPriceUsd =
    jtSpot != null && Number.isFinite(jtSpot) && jtSpot > 0 ? jtSpot : null;

  const changePctExternal =
    snapshot?.marketChangePct != null && Number.isFinite(snapshot.marketChangePct)
      ? snapshot.marketChangePct
      : null;
  const changePeriodMeta = referenceChangePeriodFromSnapshotMeta(snapshot);
  const changeWindowShort = formatReferenceChangePeriodFromSnapshotMeta(snapshot);
  const changeCoverageHint = formatReferenceChangeCoverageHint(changePeriodMeta);
  const pop = parsePsaPopulationFromComponents(comp);
  const marketsTitle = buildMarketsCollectionTitle({ collection, comp });

  return (
    <Link
      href={`/marketplace/collections/${encodeURIComponent(collection.collectionKey)}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl bg-black outline-none transition-[background-color,box-shadow] duration-200 ease-out hover:bg-zinc-950/90 hover:shadow-[0_10px_28px_-14px_rgba(0,0,0,0.75)] hover:ring-1 hover:ring-white/[0.08] focus-visible:ring-2 focus-visible:ring-mint/35"
    >
      <div className="aspect-[3/4] shrink-0 bg-[#0a0a0a]">
        {(resolvedCoverUrl || collection.coverImageUrl) ? (
          <CollectionCoverFrame
            imageUrl={resolvedCoverUrl || collection.coverImageUrl!}
            variant="flat"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-zinc-900" />
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-2 max-[380px]:p-1.5 sm:gap-2 sm:p-3">
        <div className={EXCHANGE_GRID_CARD_BADGE_ROW}>
          {pop != null ? (
            <ExchangeKvBadge
              label="Pop"
              value={formatExchangeBadgeCount(pop)}
              title={`PSA population: ${pop.toLocaleString()}`}
            />
          ) : null}
          <ExchangeKvBadge
            label="Listed"
            value={formatExchangeBadgeCount(listingCount)}
            title={`${listingCount} listing${listingCount !== 1 ? "s" : ""} on Tokenable`}
          />
        </div>

        <h3
          className="line-clamp-2 min-w-0 break-words text-[0.8125rem] font-bold leading-snug text-white max-[380px]:text-xs sm:text-[1.05rem]"
          title={marketsTitle}
        >
          {marketsTitle}
        </h3>

        <div className="mt-auto flex min-w-0 items-baseline justify-between gap-1.5 pt-0.5 sm:gap-2">
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-zinc-400 sm:text-[11px] sm:text-white">
            Price
          </span>
          <ExchangeListingPriceWithChange
            priceUsd={marketPriceUsd}
            changePct={changePctExternal}
            loading={marketChangeLoading}
            windowShort={changeWindowShort}
            titleDetail={changeCoverageHint}
            priceClassName="text-[0.875rem] font-bold leading-none max-[380px]:text-[0.8125rem] sm:text-lg"
            priceTitle="External eBay reference price."
          />
        </div>
      </div>
    </Link>
  );
}

export default function ExchangePage() {
  const [categoryFilter, setCategoryFilter] = useState<CollectionCategoryFilterId>(
    MARKETS_DEFAULT_CATEGORY_FILTER,
  );
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [sortId, setSortId] = useState<ExchangeSortId>("high_price");

  const ordersQuery = useQuery({
    queryKey: rq.ordersActive(),
    queryFn: getActiveOrders,
    refetchInterval: marketplaceRqPolicy.ordersRefetchMs,
    staleTime: marketplaceRqPolicy.ordersStaleMs,
  });
  const orders = ordersQuery.data ?? [];

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

  // Batch-resolve all cover image URLs (handles ipfs:// → HTTPS in a single request)
  const coverRawUrls = useMemo(
    () => collectionSummaries.map((c) => c.coverImageUrl),
    [collectionSummaries],
  );
  const { map: resolvedCoverMap } = useResolvedMediaUrlMap(coverRawUrls, {
    enabled: collectionSummaries.length > 0,
  });

  const ordersInitialLoading = ordersQuery.isLoading;
  const isInitialLoading = ordersInitialLoading || colInitialLoading;
  const loadFailed = ordersQuery.isError || colLoadError;
  const loadError = ordersQuery.error ?? colError;
  const showLoadingShell = isInitialLoading && !loadFailed;

  const snapshotKeysSorted = useMemo(() => {
    const u = new Set<string>();
    for (const c of collectionSummaries) {
      const k = c.collectionKey?.trim().toLowerCase();
      if (k) u.add(k);
    }
    return [...u].sort();
  }, [collectionSummaries]);

  const { data: snapshotPack, isPending: snapshotsPending } = useQuery({
    queryKey: rq.collectionSnapshots(snapshotKeysSorted, MARKET_PRICE_CHANGE_SNAPSHOT_DURATION),
    queryFn: () =>
      postMarketplaceCollectionSnapshotsBatched(
        snapshotKeysSorted,
        MARKET_PRICE_CHANGE_SNAPSHOT_DURATION,
      ),
    enabled: snapshotKeysSorted.length > 0 && !isInitialLoading,
    staleTime: marketplaceRqPolicy.snapshotsStaleMs,
  });

  /** Snapshots (pool stats + external market bundle + sparkline) — show bar while this request runs */
  const showMarketSnapshotLoadingBar =
    snapshotKeysSorted.length > 0 && !isInitialLoading && snapshotsPending;

  const snapshotByKey = useMemo(() => {
    const m = new Map<string, CollectionListMarketSnapshot>();
    for (const it of snapshotPack?.items ?? []) {
      const k = it.collectionKey?.trim().toLowerCase();
      if (k) m.set(k, it);
    }
    return m;
  }, [snapshotPack]);

  const sortedForRank = useMemo(() => {
    return [...collectionSummaries].sort((a, b) =>
      compareExchangeCollections(a, b, sortId, snapshotByKey),
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
            <code className="rounded bg-zinc-900 px-1 text-mint">{getApiUrl()}</code>. Start the
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
        {!showLoadingShell && sortedForRank.length > 0 ? (
          <>
            <div className="mb-3 flex items-center justify-between gap-3 sm:mb-5">
              <h2 className="min-w-0 text-xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
                All Collections
              </h2>
              <ExchangeMarketsViewToolbar
                className="inline-flex sm:hidden"
                viewMode={viewMode}
                onGrid={() => setViewMode("grid")}
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
              <ExchangeMarketsViewToolbar
                className="hidden sm:inline-flex"
                viewMode={viewMode}
                onGrid={() => setViewMode("grid")}
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
              <Link href="/vault" className="text-mint hover:underline">
                Vault
              </Link>
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
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 gap-2.5 pt-1 min-[400px]:gap-3 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
            {filteredSorted.map((c) => (
              <CollectionGridCard
                key={c.collectionKey}
                collection={c}
                snapshot={snapshotByKey.get(collectionKeyLower(c))}
                resolvedCoverUrl={c.coverImageUrl ? resolvedCoverMap.get(c.coverImageUrl) : undefined}
                listingCount={c.activeListingCount}
                marketChangeLoading={showMarketSnapshotLoadingBar}
              />
            ))}
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
        ) : (
          <div className="space-y-6 pt-1 sm:space-y-7">
            {filteredSorted.map((c) => (
              <CollectionRow
                key={c.collectionKey}
                collection={c}
                listingCount={c.activeListingCount}
                snapshot={snapshotByKey.get(collectionKeyLower(c))}
                resolvedCoverUrl={c.coverImageUrl ? resolvedCoverMap.get(c.coverImageUrl) : undefined}
                marketChangeLoading={showMarketSnapshotLoadingBar}
              />
            ))}
            {hasNextPage ? (
              <div className="flex justify-center pt-4">
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
            {categoryFilter === "all" && orphanAsks.length > 0 && (
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
            )}
          </div>
        )}
      </div>

    </div>
  );
}
