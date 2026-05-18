"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  getActiveOrders,
  postMarketplaceCollectionSnapshotsBatched,
  type CollectionListMarketSnapshot,
  type CollectionUsdPoint,
  type MarketplaceCollectionSummary,
  type OrderListItem,
} from "@/lib/core";
import { rq, marketplaceRqPolicy } from "@/lib/core";
import { useMarketplaceCollectionsInfinite } from "@/hooks/useMarketplaceCollectionsInfinite";
import { CollectionCoverFrame } from "@/components/marketplace/CollectionCoverFrame";
import { useResolvedMediaUrlMap } from "@/hooks/useResolvedMediaUrl";
import { TrendingCollectionsCarousel } from "@/components/landing/TrendingCollectionsCarousel";
import { CollectionCategoryFilterBar } from "@/components/marketplace/CollectionCategoryFilterBar";
import { CollectionListSparkline } from "@/components/marketplace/CollectionListSparkline";
import {
  collectionMatchesCategoryFilter,
  inferCollectionSportBucket,
  type CollectionCategoryFilterId,
  type CollectionSportBucket,
} from "@/lib/market";
import { parseGradeScoreNumber, representativeGradeUsd } from "@/lib/market";
import { toCardDisplayUppercase } from "@/lib/marketplace/collectionFullDetailsTitle";

function seeded01FromKey(key: string): number {
  if (!key) return 0.5;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

function isMockSportBucket(bucket: string): bucket is "nba" | "mlb" | "nfl" {
  return bucket === "nba" || bucket === "mlb" || bucket === "nfl";
}

function buildMockSportsSparkline(collectionKey: string, days = 365): CollectionUsdPoint[] {
  const seed = seeded01FromKey(collectionKey);
  const startUsd = 900;
  const endUsd = 1500;
  const spanUsd = endUsd - startUsd;
  const waveAmp = 0.008 + seed * 0.014;
  const n = Math.max(30, Math.min(365, Math.floor(days)));
  const now = Math.floor(Date.now() / 1000);
  const out: CollectionUsdPoint[] = [];
  for (let i = 0; i < n; i++) {
    const progress = i / Math.max(1, n - 1);
    const age = n - 1 - i;
    const t = now - age * 86400;
    const phase = progress * Math.PI * 6;
    const cyc = Math.sin(phase + seed * Math.PI * 2) * waveAmp;
    const base = startUsd + spanUsd * progress;
    out.push({ t, v: Math.max(1, Math.round(base * (1 + cyc) * 100) / 100) });
  }
  return out;
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
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
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
}: {
  collection: MarketplaceCollectionSummary;
  listingCount: number;
  snapshot: CollectionListMarketSnapshot | undefined;
  resolvedCoverUrl?: string;
}) {
  const comp = collection.components as { gradeScore?: string };

  const jtSpot = representativeGradeUsd(
    snapshot?.gradePrices ?? null,
    parseGradeScoreNumber(comp.gradeScore),
  );

  const pct = snapshot?.marketChangePct;
  const ms = snapshot?.marketStats ?? null;
  const floor =
    ms?.floor != null && Number.isFinite(ms.floor) && ms.floor > 0 ? ms.floor : null;
  const lastTrade =
    snapshot?.lastTokenableTradeUsdc != null &&
    Number.isFinite(snapshot.lastTokenableTradeUsdc)
      ? snapshot.lastTokenableTradeUsdc
      : null;
  const refUsd = jtSpot != null && Number.isFinite(jtSpot) && jtSpot > 0 ? jtSpot : null;
  const bucket = inferCollectionSportBucket(collection, snapshot);
  const mockSparkline = isMockSportBucket(bucket)
    ? buildMockSportsSparkline(collection.collectionKey, 365)
    : null;
  const sparklinePoints =
    snapshot?.sparklineUsd != null && snapshot.sparklineUsd.length >= 2
      ? snapshot.sparklineUsd
      : mockSparkline;
  const fallbackRefUsd = mockSparkline?.[mockSparkline.length - 1]?.v ?? null;
  const effectiveRefUsd = refUsd ?? fallbackRefUsd;
  const tokenablePrice = floor ?? lastTrade;
  const tokenableVsRefPct = percentDiffVersusRef(tokenablePrice, effectiveRefUsd);
  const changePct24h =
    pct != null && Number.isFinite(pct) ? pct : null;

  return (
    <Link
      href={`/marketplace/collections/${encodeURIComponent(collection.collectionKey)}`}
      className="group flex flex-col gap-3 rounded-2xl border border-zinc-700/70 bg-gradient-to-r from-[#0f1117] via-[#10131a] to-[#0e1218] px-3 py-3 transition-all hover:border-mint/35 hover:shadow-[0_0_26px_rgba(148,255,212,0.08)] sm:flex-row sm:items-center sm:gap-6 sm:rounded-3xl sm:px-6 sm:py-6"
    >
      <div className="relative w-full max-w-[min(156px,48vw)] shrink-0 self-center sm:w-[196px] sm:max-w-none sm:self-auto">
        {(resolvedCoverUrl || collection.coverImageUrl) ? (
          <div className="aspect-[3/4] w-full overflow-hidden rounded-2xl border border-gray-800/80">
            <CollectionCoverFrame
              imageUrl={resolvedCoverUrl || collection.coverImageUrl!}
              variant="compact"
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="aspect-[3/4] w-full rounded-2xl border border-gray-800 bg-gray-900" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 break-words text-lg font-extrabold uppercase tracking-tight text-white transition-colors group-hover:text-mint sm:line-clamp-1 sm:truncate sm:text-2xl">
          {toCardDisplayUppercase(collection.displayLabel)}
        </h3>
        {(tokenableVsRefPct != null || changePct24h != null) ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] leading-snug sm:text-xs">
            {tokenableVsRefPct != null ? (
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 font-bold tabular-nums ${
                  tokenableVsRefPct >= 0
                    ? "border-amber-300/35 bg-amber-500/20 text-amber-200"
                    : "border-emerald-300/35 bg-emerald-500/20 text-emerald-200"
                }`}
                title={`Tokenable Price (${tokenablePrice != null ? formatUsd(tokenablePrice) : "—"}) vs eBay (${effectiveRefUsd != null ? formatUsd(effectiveRefUsd) : "—"})`}
              >
                Market Gap {tokenableVsRefPct >= 0 ? "+" : ""}
                {tokenableVsRefPct.toFixed(1)}%
              </span>
            ) : null}
            {changePct24h != null ? (
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 font-bold tabular-nums ${
                  changePct24h >= 0
                    ? "border-emerald-300/30 bg-emerald-500/15 text-emerald-200"
                    : "border-rose-300/30 bg-rose-500/15 text-rose-200"
                }`}
                title="External reference: rolling ~24h vs latest Cardhedger history tick (no mock data)."
              >
                24h {changePct24h >= 0 ? "+" : ""}
                {changePct24h.toFixed(1)}%
              </span>
            ) : null}
          </div>
        ) : null}
        <dl className="mt-3 space-y-2 text-xs leading-snug text-zinc-300 sm:text-sm sm:leading-tight">
          <div className="flex items-baseline justify-between gap-2">
            <dt className="max-w-[58%] shrink-0 text-zinc-400">Active Listings</dt>
            <dd className="min-w-0 text-right tabular-nums text-sm font-bold text-white sm:text-base md:text-lg">
              {listingCount}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="max-w-[58%] shrink-0 text-zinc-400">Market Price</dt>
            <dd
              className="min-w-0 text-right tabular-nums text-sm font-bold text-cyan-300 sm:text-base md:text-lg"
              title="External eBay reference price."
            >
              {effectiveRefUsd != null ? (
                formatUsd(effectiveRefUsd)
              ) : (
                <span className="font-medium text-zinc-600">—</span>
              )}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="max-w-[58%] shrink-0 text-zinc-400">Tokenable Price</dt>
            <dd
              className="min-w-0 text-right tabular-nums text-sm font-bold text-emerald-300 sm:text-base md:text-lg"
              title={floor != null ? "Current Tokenable floor listing (active asks)." : "Most recent Tokenable trade (fallback when no active floor)."}
            >
              {tokenablePrice != null ? formatUsd(tokenablePrice) : "—"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex w-full min-w-0 shrink-0 flex-col items-stretch gap-1 sm:w-auto sm:items-end">
        <CollectionListSparkline
          points={sparklinePoints}
          positive={changePct24h == null ? undefined : changePct24h >= 0}
          className="h-14 w-full max-w-full sm:h-20 sm:w-40"
        />
      </div>
    </Link>
  );
}

function formatSignedPct2(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function exchangeGridCategoryPillLabel(
  collection: MarketplaceCollectionSummary,
  snapshot: CollectionListMarketSnapshot | undefined,
): string {
  const raw = snapshot?.categoryLabel?.trim();
  if (raw) return raw;
  const b = inferCollectionSportBucket(collection, snapshot);
  const map: Record<string, string> = {
    pokemon: "Pokemon",
    mlb: "MLB",
    nba: "NBA",
    nfl: "NFL",
    soccer: "Soccer",
    other: "Trading card",
  };
  return map[b] ?? "Trading card";
}

function exchangeGridSportBadge(bucket: CollectionSportBucket): {
  label: string;
  className: string;
} | null {
  switch (bucket) {
    case "pokemon":
      return null;
    case "mlb":
      return { label: "MLB", className: "bg-[#5c4024] text-gray-100" };
    case "nba":
      return { label: "NBA", className: "bg-[#2e3a6b] text-gray-100" };
    case "nfl":
      return { label: "NFL", className: "bg-[#4a3520] text-gray-100" };
    case "soccer":
      return { label: "Soccer", className: "bg-[#264a3a] text-gray-100" };
    default:
      return null;
  }
}

function CollectionGridCard({
  collection,
  snapshot,
  resolvedCoverUrl,
  listingCount,
}: {
  collection: MarketplaceCollectionSummary;
  snapshot: CollectionListMarketSnapshot | undefined;
  resolvedCoverUrl?: string;
  listingCount: number;
}) {
  const comp = collection.components as { gradeScore?: string };
  const jtSpot = representativeGradeUsd(
    snapshot?.gradePrices ?? null,
    parseGradeScoreNumber(comp.gradeScore),
  );
  const bucket = inferCollectionSportBucket(collection, snapshot);
  const mockSparkline = isMockSportBucket(bucket)
    ? buildMockSportsSparkline(collection.collectionKey, 365)
    : null;
  const fallbackRefUsd = mockSparkline?.[mockSparkline.length - 1]?.v ?? null;
  const marketPriceUsd =
    jtSpot != null && Number.isFinite(jtSpot) && jtSpot > 0 ? jtSpot : fallbackRefUsd;

  const trendPct =
    snapshot?.marketChangePct != null && Number.isFinite(snapshot.marketChangePct)
      ? snapshot.marketChangePct
      : null;

  const categoryFallback = exchangeGridCategoryPillLabel(collection, snapshot);
  const sportBadge = exchangeGridSportBadge(bucket);
  const categoryLabel =
    bucket === "other" ? categoryFallback : (sportBadge?.label ?? categoryFallback);

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
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-2.5 sm:gap-3 sm:p-4">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-[10px]">
          {trendPct != null && Number.isFinite(trendPct) ? (
            <span
              className={`box-border inline-flex h-[24px] max-w-full min-w-0 shrink-0 items-center justify-center rounded-[4px] border px-1.5 text-[10px] font-bold leading-none tabular-nums sm:h-[26px] sm:min-w-[72px] sm:px-2 sm:text-xs ${
                trendPct >= 0
                  ? "border-[rgb(0,187,61)] bg-black/50 text-[rgb(0,187,61)]"
                  : "border-[rgb(220,55,55)] bg-black/50 text-[rgb(220,55,55)]"
              }`}
              title={
                snapshot?.marketChangeWindow
                  ? `External reference (${snapshot.marketChangeWindow}): latest vs ~24h prior on Cardhedger history`
                  : "External reference: rolling ~24h vs latest Cardhedger tick"
              }
            >
              {formatSignedPct2(trendPct)}
            </span>
          ) : null}
          {bucket === "pokemon" ? (
            <span
              className="box-border inline-flex h-[24px] max-w-full min-w-0 shrink-0 items-center justify-center overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.9)] px-1.5 py-0.5 text-[9px] font-semibold leading-none text-white sm:h-[26px] sm:w-[72px] sm:px-2 sm:text-[11px]"
              title="Pokemon"
            >
              <span className="block max-w-full truncate">Pokemon</span>
            </span>
          ) : (
            <span
              className={`inline-flex min-w-0 max-w-full items-center truncate rounded-md px-2 py-1 text-[11px] font-semibold sm:text-xs ${
                sportBadge
                  ? sportBadge.className
                  : "bg-zinc-900/90 text-zinc-200 ring-1 ring-zinc-700/80"
              }`}
              title={categoryLabel}
            >
              <span className="truncate">{categoryLabel}</span>
            </span>
          )}
        </div>

        <h3
          className="line-clamp-2 min-h-[2.5rem] break-words text-[0.8125rem] font-bold leading-snug text-white sm:min-h-[3rem] sm:text-[1.05rem]"
          title={collection.displayLabel}
        >
          {collection.displayLabel}
        </h3>

        <div className="mt-auto border-t border-zinc-700/80 pt-2 sm:pt-3">
          <dl className="grid gap-2 text-[11px] text-white sm:gap-3 sm:text-sm">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 gap-y-0 sm:gap-x-3">
              <dt className="min-w-0 truncate text-white/85">Active listing</dt>
              <dd className="tabular-nums text-xs font-semibold text-white sm:text-base">
                {listingCount}
              </dd>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 gap-y-0 sm:gap-x-3">
              <dt className="min-w-0 truncate text-white/85">Market Price</dt>
              <dd
                className="max-w-[100%] text-right text-base font-bold tabular-nums leading-none text-cyan-300 sm:max-w-none sm:text-xl"
                title={
                  marketPriceUsd != null ? formatUsd(marketPriceUsd) : "External reference (eBay strip)"
                }
              >
                {marketPriceUsd != null ? formatUsd(marketPriceUsd) : "—"}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </Link>
  );
}

export default function ExchangePage() {
  const [categoryFilter, setCategoryFilter] = useState<CollectionCategoryFilterId>("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");

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
    queryKey: rq.collectionSnapshots(snapshotKeysSorted, "365d"),
    queryFn: () =>
      postMarketplaceCollectionSnapshotsBatched(snapshotKeysSorted, "365d"),
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
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-3 pb-20 pt-5 max-[380px]:px-2 sm:px-6 sm:py-10 sm:pb-24">
        <div className="mb-8 sm:mb-14">
          <TrendingCollectionsCarousel snapshotByKey={snapshotByKey} />
        </div>

        {/* Collection list */}
        <div className="mb-6 sm:mb-10">
          <h2 className="mb-3 text-xl font-bold leading-tight tracking-tight sm:mb-5 sm:text-3xl">
            Card Trading List
          </h2>
          {showMarketSnapshotLoadingBar ? (
            <div
              className="mb-4 space-y-2"
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
                <div className="absolute left-0 top-0 h-full w-[32%] rounded-full bg-mint/90 shadow-[0_0_14px_rgba(148,255,212,0.35)] exchange-snapshot-loading-fill" />
              </div>
            </div>
          ) : null}
          {!isLoading && sortedForRank.length > 0 ? (
            <div className="mb-4 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:flex-nowrap sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0 w-full sm:flex-1">
                <CollectionCategoryFilterBar value={categoryFilter} onChange={setCategoryFilter} />
              </div>
              <div
                className="-mx-0.5 inline-flex shrink-0 items-center gap-1 self-stretch rounded-xl border border-zinc-700/80 bg-zinc-900/80 p-1 sm:mx-0 sm:self-auto"
                role="group"
                aria-label="List layout"
              >
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  aria-label="Grid view"
                  className={`inline-flex h-11 w-11 touch-manipulation items-center justify-center rounded-lg transition-colors sm:h-10 sm:w-10 ${
                    viewMode === "grid"
                      ? "bg-mint text-[#061018]"
                      : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                  }`}
                >
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden>
                    <rect x="1" y="1" width="6" height="6" rx="1" />
                    <rect x="9" y="1" width="6" height="6" rx="1" />
                    <rect x="1" y="9" width="6" height="6" rx="1" />
                    <rect x="9" y="9" width="6" height="6" rx="1" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  aria-label="List view"
                  className={`inline-flex h-11 w-11 touch-manipulation items-center justify-center rounded-lg transition-colors sm:h-10 sm:w-10 ${
                    viewMode === "list"
                      ? "bg-mint text-[#061018]"
                      : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                  }`}
                >
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden>
                    <rect x="1" y="2" width="14" height="2" rx="1" />
                    <rect x="1" y="7" width="14" height="2" rx="1" />
                    <rect x="1" y="12" width="14" height="2" rx="1" />
                  </svg>
                </button>
              </div>
            </div>
          ) : null}
        </div>

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
              Categories use listing text and snapshot metadata — try ALL or Others.
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 gap-3 pt-1 min-[400px]:gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
            {filteredSorted.map((c) => (
              <CollectionGridCard
                key={c.collectionKey}
                collection={c}
                snapshot={snapshotByKey.get(c.collectionKey.toLowerCase())}
                resolvedCoverUrl={c.coverImageUrl ? resolvedCoverMap.get(c.coverImageUrl) : undefined}
                listingCount={c.activeListingCount}
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
