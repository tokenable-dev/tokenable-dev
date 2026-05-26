"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  getActiveOrders,
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
import {
  collectionMatchesCategoryFilter,
  formatReferenceChangeCoverageHint,
  formatReferenceChangePeriodFromSnapshotMeta,
  MARKET_PRICE_CHANGE_PERIOD_SHORT,
  MARKET_PRICE_CHANGE_SNAPSHOT_DURATION,
  referenceChangePeriodFromSnapshotMeta,
  REFERENCE_CHANGE_UNAVAILABLE_HINT,
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

function formatSignedPct(pct: number): string {
  if (Number.isFinite(pct) && Math.abs(pct) < 0.05) {
    return "0.0%";
  }
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
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

function ExchangeLayoutToggleGroup({
  viewMode,
  onGrid,
  onList,
  className = "",
}: {
  viewMode: "list" | "grid";
  onGrid: () => void;
  onList: () => void;
  className?: string;
}) {
  return (
    <div
      className={[className, EXCHANGE_LAYOUT_TOGGLE_SHELL].filter(Boolean).join(" ")}
      role="group"
      aria-label="List layout"
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
        active={false}
        onClick={onList}
        ariaLabel="List view"
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

function ExchangeTrendPctBadge({
  pct,
  windowShort,
  title,
}: {
  pct: number;
  windowShort?: string;
  title?: string;
}) {
  return (
    <span className={EXCHANGE_CARD_BADGE_NEUTRAL} title={title}>
      <span className={`tabular-nums ${exchangePctValueClass(pct)}`}>
        {formatSignedPct(pct)}
      </span>
      {windowShort ? <span>{` ${windowShort}`}</span> : null}
    </span>
  );
}

/** Always show reference % on list/grid cards — 0% when history is insufficient (see title). */
function ExchangeMarketChangeBadge({
  pct,
  loading = false,
  windowShort = MARKET_PRICE_CHANGE_PERIOD_SHORT,
  titleDetail,
}: {
  pct: number | null;
  loading?: boolean;
  windowShort?: string;
  titleDetail?: string;
}) {
  const win = windowShort;
  const title = titleDetail?.trim()
    ? `External reference (${win} change) — ${titleDetail.trim()}`
    : `External reference (${win} change)`;
  if (loading && pct == null) {
    return (
      <ExchangeKvBadge
        label={win}
        value="…"
        title="Loading external reference change"
      />
    );
  }
  if (pct != null && Number.isFinite(pct)) {
    return (
      <ExchangeTrendPctBadge
        pct={pct}
        windowShort={win}
        title={title}
      />
    );
  }
  return (
    <span className={EXCHANGE_CARD_BADGE_NEUTRAL} title={REFERENCE_CHANGE_UNAVAILABLE_HINT}>
      <span className="tabular-nums text-white">{formatSignedPct(0)}</span>
      {win ? <span>{` ${win}`}</span> : null}
    </span>
  );
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

/** On-platform listing pool: highest “price tier” first (floor → median → p75); rows without stats last. */
function exchangePoolPriceSortKey(s: CollectionListMarketSnapshot | undefined): [number, number, number] {
  const ms = s?.marketStats;
  if (!ms) return [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  const n = (x: number | null | undefined) =>
    x != null && Number.isFinite(x) && x > 0 ? x : Number.NEGATIVE_INFINITY;
  return [n(ms.floor), n(ms.median), n(ms.p75)];
}

function compareExchangeByPoolPrice(
  a: MarketplaceCollectionSummary,
  b: MarketplaceCollectionSummary,
  snapByKey: Map<string, CollectionListMarketSnapshot>,
): number {
  const ka = exchangePoolPriceSortKey(snapByKey.get(a.collectionKey.toLowerCase()));
  const kb = exchangePoolPriceSortKey(snapByKey.get(b.collectionKey.toLowerCase()));
  for (let i = 0; i < 3; i++) {
    if (ka[i] !== kb[i]) return kb[i] - ka[i];
  }
  return a.displayLabel.localeCompare(b.displayLabel);
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
          <ExchangeMarketChangeBadge
            pct={changePctExternal}
            loading={marketChangeLoading}
            windowShort={changeWindowShort}
            titleDetail={changeCoverageHint}
          />
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
        <dl className="mt-2.5 space-y-2 text-xs leading-snug text-zinc-300 sm:mt-3 sm:text-sm sm:leading-tight">
          <div className="flex items-baseline justify-between gap-2">
            <dt className="max-w-[45%] shrink-0 text-sm text-white sm:max-w-[58%]">Price</dt>
            <dd
              className="min-w-0 text-right tabular-nums text-sm font-bold text-[rgba(16,211,51,1)] sm:text-base md:text-lg"
              title="External eBay reference price."
            >
              {effectiveRefUsd != null ? (
                formatUsd(effectiveRefUsd)
              ) : (
                <span className="font-medium text-zinc-600">—</span>
              )}
            </dd>
          </div>
        </dl>
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
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-800/90 bg-black transition-colors hover:border-zinc-600"
    >
      <div className="aspect-[3/4] shrink-0 bg-[#0a0a0a]">
        {(resolvedCoverUrl || collection.coverImageUrl) ? (
          <CollectionCoverFrame
            imageUrl={resolvedCoverUrl || collection.coverImageUrl!}
            variant="compact"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-zinc-900" />
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-2 max-[380px]:p-1.5 sm:gap-2 sm:p-3">
        <div className={EXCHANGE_GRID_CARD_BADGE_ROW}>
          <ExchangeMarketChangeBadge
            pct={changePctExternal}
            loading={marketChangeLoading}
            windowShort={changeWindowShort}
            titleDetail={changeCoverageHint}
          />
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
          <span
            className="min-w-0 truncate text-right text-[0.875rem] font-bold tabular-nums leading-none text-[rgba(16,211,51,1)] max-[380px]:text-[0.8125rem] sm:text-lg"
            title={
              marketPriceUsd != null ? formatUsd(marketPriceUsd) : "External reference (eBay strip)"
            }
          >
            {marketPriceUsd != null ? formatUsd(marketPriceUsd) : "—"}
          </span>
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
  const [listLayoutComingSoonOpen, setListLayoutComingSoonOpen] = useState(false);

  useEffect(() => {
    if (!listLayoutComingSoonOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setListLayoutComingSoonOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [listLayoutComingSoonOpen]);

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: rq.ordersActive(),
    queryFn: getActiveOrders,
    refetchInterval: marketplaceRqPolicy.ordersRefetchMs,
    staleTime: marketplaceRqPolicy.ordersStaleMs,
  });

  const {
    data: colPages,
    isLoading: colLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMarketplaceCollectionsInfinite();

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

  const isLoading = ordersLoading || colLoading;

  const snapshotKeysSorted = useMemo(() => {
    const u = new Set<string>();
    for (const c of collectionSummaries) u.add(c.collectionKey.toLowerCase());
    return [...u].sort();
  }, [collectionSummaries]);

  const { data: snapshotPack, isPending: snapshotsPending } = useQuery({
    queryKey: rq.collectionSnapshots(snapshotKeysSorted, MARKET_PRICE_CHANGE_SNAPSHOT_DURATION),
    queryFn: () =>
      postMarketplaceCollectionSnapshotsBatched(
        snapshotKeysSorted,
        MARKET_PRICE_CHANGE_SNAPSHOT_DURATION,
      ),
    enabled: snapshotKeysSorted.length > 0 && !isLoading,
    staleTime: marketplaceRqPolicy.snapshotsStaleMs,
  });

  /** Snapshots (pool stats + external market bundle + sparkline) — show bar while this request runs */
  const showMarketSnapshotLoadingBar =
    snapshotKeysSorted.length > 0 && !isLoading && snapshotsPending;

  const snapshotByKey = useMemo(() => {
    const m = new Map<string, CollectionListMarketSnapshot>();
    for (const it of snapshotPack?.items ?? []) {
      m.set(it.collectionKey.toLowerCase(), it);
    }
    return m;
  }, [snapshotPack]);

  /**
   * Highest on-platform listing prices first (`marketStats` from batch snapshots). Rows with no
   * pool data stay at the bottom until stats load or if the collection has no priced listings.
   */
  const sortedForRank = useMemo(() => {
    return [...collectionSummaries].sort((a, b) => compareExchangeByPoolPrice(a, b, snapshotByKey));
  }, [collectionSummaries, snapshotByKey]);

  const orphanAsks = orders.filter(
    (o) => o.side !== "bid" && (!o.collectionKey || !String(o.collectionKey).trim()),
  );

  const filteredSorted = useMemo(() => {
    return sortedForRank.filter((c) =>
      collectionMatchesCategoryFilter(
        categoryFilter,
        c,
        snapshotByKey.get(c.collectionKey.toLowerCase()),
      ),
    );
  }, [sortedForRank, snapshotByKey, categoryFilter]);

  return (
    <div className="min-h-screen min-w-0 overflow-x-clip bg-black text-white">
      <div className="mx-auto w-full max-w-6xl min-w-0 px-3 pb-20 pt-8 max-[380px]:px-2 sm:px-6 sm:pb-24 sm:pt-12">
        {!isLoading && sortedForRank.length > 0 ? (
          <>
            <div className="mb-3 flex items-center justify-between gap-3 sm:mb-5">
              <h2 className="min-w-0 text-xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
                All Collections
              </h2>
              <ExchangeLayoutToggleGroup
                className="inline-flex sm:hidden"
                viewMode={viewMode}
                onGrid={() => setViewMode("grid")}
                onList={() => setListLayoutComingSoonOpen(true)}
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
              <ExchangeLayoutToggleGroup
                className="hidden sm:inline-flex"
                viewMode={viewMode}
                onGrid={() => setViewMode("grid")}
                onList={() => setListLayoutComingSoonOpen(true)}
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

        {isLoading ? (
          <div className="space-y-5">
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
                snapshot={snapshotByKey.get(c.collectionKey.toLowerCase())}
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
                snapshot={snapshotByKey.get(c.collectionKey.toLowerCase())}
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

      {listLayoutComingSoonOpen ? (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="list-layout-coming-soon-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/75 backdrop-blur-[1px]"
            aria-label="Close"
            onClick={() => setListLayoutComingSoonOpen(false)}
          />
          <div className="relative z-10 w-full max-w-[min(100%,22rem)] rounded-2xl border border-zinc-600/70 bg-[#161616] px-5 py-6 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.85)] ring-1 ring-white/[0.06]">
            <h2
              id="list-layout-coming-soon-title"
              className="text-lg font-semibold tracking-tight text-white"
            >
              List view — coming soon
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">
              Not available yet. Use grid view for now.
            </p>
            <button
              type="button"
              onClick={() => setListLayoutComingSoonOpen(false)}
              className="mt-6 w-full rounded-xl bg-zinc-100 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-white"
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
