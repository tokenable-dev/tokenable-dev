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
import { TrendingCollectionsCarousel } from "@/components/landing/TrendingCollectionsCarousel";
import { CollectionCategoryFilterBar } from "@/components/marketplace/CollectionCategoryFilterBar";
import { CollectionListSparkline } from "@/components/marketplace/CollectionListSparkline";
import {
  collectionMatchesCategoryFilter,
  inferCollectionSportBucket,
  type CollectionCategoryFilterId,
} from "@/lib/market";
import { parseGradeScoreNumber, representativeGradeUsd } from "@/lib/market";

const USDC_DECIMALS = 1_000_000;

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

function percentChangeFromPoints(points: CollectionUsdPoint[] | null | undefined): number | null {
  const arr = points ?? [];
  if (arr.length < 2) return null;
  const first = arr[0]?.v;
  const last = arr[arr.length - 1]?.v;
  if (!Number.isFinite(first) || !Number.isFinite(last) || !first || first <= 0) return null;
  return ((last - first) / first) * 100;
}

function useMarketStats(orders: OrderListItem[], collectionsCount: number) {
  return useMemo(() => {
    const askOrders = orders.filter((o) => String(o.side ?? "ask").toLowerCase() !== "bid");

    let totalValueMicros = BigInt(0);
    for (const o of askOrders) {
      try {
        totalValueMicros += BigInt(o.price ?? "0");
      } catch {
        /* skip */
      }
    }
    const totalValue = Number(totalValueMicros) / USDC_DECIMALS;
    const totalListings = askOrders.length;

    return {
      totalValue,
      totalListings,
      totalCollections: collectionsCount,
    };
  }, [orders, collectionsCount]);
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/50 px-5 py-7 text-center sm:px-6 sm:py-8">
      <p className="mb-3 text-sm font-medium text-gray-400 sm:text-base">{label}</p>
      <p className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
        {value}
      </p>
    </div>
  );
}

/** Mobile-only: three headline stats in one horizontal row inside a single card. */
function MarketsStatsMobileStrip(props: {
  marketCapDisplay: string;
  listingsDisplay: string;
  collectionsDisplay: string;
}) {
  const cell = (
    label: string,
    value: string,
  ) => (
    <div className="flex min-h-[3.75rem] min-w-0 flex-col items-center justify-center gap-0.5 px-1.5 text-center">
      <p className="line-clamp-2 text-[0.6875rem] font-medium leading-tight text-gray-400">
        {label}
      </p>
      <p className="truncate text-base font-extrabold tabular-nums tracking-tight text-white">
        {value}
      </p>
    </div>
  );

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/50 px-2 py-3 sm:hidden">
      <div className="grid min-w-0 grid-cols-3 divide-x divide-gray-700/70">
        {cell("Market CAP", props.marketCapDisplay)}
        {cell("Active listings", props.listingsDisplay)}
        {cell("Collections", props.collectionsDisplay)}
      </div>
    </div>
  );
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
}: {
  collection: MarketplaceCollectionSummary;
  listingCount: number;
  snapshot: CollectionListMarketSnapshot | undefined;
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
  const upTo1yChangePct = pct != null && Number.isFinite(pct) ? pct : percentChangeFromPoints(sparklinePoints);

  return (
    <Link
      href={`/marketplace/collections/${encodeURIComponent(collection.collectionKey)}`}
      className="group flex flex-col gap-4 rounded-3xl border border-zinc-700/70 bg-gradient-to-r from-[#0f1117] via-[#10131a] to-[#0e1218] px-4 py-4 transition-all hover:border-mint/35 hover:shadow-[0_0_26px_rgba(148,255,212,0.08)] sm:flex-row sm:items-center sm:gap-6 sm:px-6 sm:py-6"
    >
      <div className="relative w-full max-w-[156px] shrink-0 self-center sm:w-[196px] sm:max-w-none sm:self-auto">
        {collection.coverImageUrl ? (
          <div className="aspect-[3/4] w-full overflow-hidden rounded-2xl border border-gray-800/80">
            <CollectionCoverFrame
              imageUrl={collection.coverImageUrl}
              variant="compact"
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="aspect-[3/4] w-full rounded-2xl border border-gray-800 bg-gray-900" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-xl font-extrabold tracking-tight text-white transition-colors group-hover:text-mint sm:text-2xl">
          {collection.displayLabel}
        </h3>
        {(tokenableVsRefPct != null || upTo1yChangePct != null) ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] sm:text-xs">
            {tokenableVsRefPct != null ? (
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 font-bold tabular-nums ${
                  tokenableVsRefPct >= 0
                    ? "border-amber-300/35 bg-amber-500/20 text-amber-200"
                    : "border-emerald-300/35 bg-emerald-500/20 text-emerald-200"
                }`}
                title={`Tokenable (${tokenablePrice != null ? formatUsd(tokenablePrice) : "—"}) vs eBay (${effectiveRefUsd != null ? formatUsd(effectiveRefUsd) : "—"})`}
              >
                Market Gap {tokenableVsRefPct >= 0 ? "+" : ""}
                {tokenableVsRefPct.toFixed(1)}%
              </span>
            ) : null}
            {upTo1yChangePct != null ? (
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 font-bold tabular-nums ${
                  upTo1yChangePct >= 0
                    ? "border-emerald-300/30 bg-emerald-500/15 text-emerald-200"
                    : "border-rose-300/30 bg-rose-500/15 text-rose-200"
                }`}
                title="External history change: oldest visible point to latest point (up to 1 year)"
              >
                1Y Trend {upTo1yChangePct >= 0 ? "+" : ""}
                {upTo1yChangePct.toFixed(1)}%
              </span>
            ) : null}
          </div>
        ) : null}
        <dl className="mt-3 grid gap-y-2 text-sm leading-tight text-zinc-300 sm:text-base">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <dt className="min-w-[7.25rem] shrink-0 text-zinc-400 sm:min-w-[9.5rem]">Active Listings</dt>
            <dd className="tabular-nums text-base font-bold text-white sm:text-lg">{listingCount}</dd>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <dt className="min-w-[7.25rem] shrink-0 text-zinc-400 sm:min-w-[9.5rem]">Market Price</dt>
            <dd
              className="tabular-nums text-base font-bold text-cyan-300 sm:text-lg"
              title="External eBay reference price."
            >
              {effectiveRefUsd != null ? (
                formatUsd(effectiveRefUsd)
              ) : (
                <span className="font-medium text-zinc-600">—</span>
              )}
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <dt className="min-w-[7.25rem] shrink-0 text-zinc-400 sm:min-w-[9.5rem]">Tokenable Price</dt>
            <dd
              className="tabular-nums text-base font-bold text-emerald-300 sm:text-lg"
              title={floor != null ? "Current Tokenable floor listing (active asks)." : "Most recent Tokenable trade (fallback when no active floor)."}
            >
              {tokenablePrice != null ? formatUsd(tokenablePrice) : "—"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex w-full shrink-0 flex-col items-stretch gap-1 sm:w-auto sm:items-end">
        <CollectionListSparkline
          points={sparklinePoints}
          positive={upTo1yChangePct == null ? undefined : upTo1yChangePct >= 0}
          className="h-16 w-full sm:h-20 sm:w-40"
        />
      </div>
    </Link>
  );
}

function CollectionGridCard({
  collection,
  snapshot,
}: {
  collection: MarketplaceCollectionSummary;
  snapshot: CollectionListMarketSnapshot | undefined;
}) {
  const comp = collection.components as { gradeScore?: string };

  const jtSpot = representativeGradeUsd(
    snapshot?.gradePrices ?? null,
    parseGradeScoreNumber(comp.gradeScore),
  );
  const ms = snapshot?.marketStats ?? null;
  const tokenablePrice =
    ms?.floor != null && Number.isFinite(ms.floor) && ms.floor > 0
      ? ms.floor
      : snapshot?.lastTokenableTradeUsdc != null &&
          Number.isFinite(snapshot.lastTokenableTradeUsdc) &&
          snapshot.lastTokenableTradeUsdc > 0
        ? snapshot.lastTokenableTradeUsdc
        : null;
  const bucket = inferCollectionSportBucket(collection, snapshot);
  const mockSparkline = isMockSportBucket(bucket)
    ? buildMockSportsSparkline(collection.collectionKey, 365)
    : null;
  const fallbackRefUsd = mockSparkline?.[mockSparkline.length - 1]?.v ?? null;
  const eBayUsd =
    jtSpot != null && Number.isFinite(jtSpot) && jtSpot > 0 ? jtSpot : fallbackRefUsd;

  const sparkPoints =
    snapshot?.sparklineUsd != null && snapshot.sparklineUsd.length >= 2
      ? snapshot.sparklineUsd
      : mockSparkline;
  const gridSparkPctChange = percentChangeFromPoints(mockSparkline);
  const pctPositive =
    snapshot?.marketChangePct != null
      ? snapshot.marketChangePct >= 0
      : gridSparkPctChange != null
        ? gridSparkPctChange >= 0
        : undefined;

  return (
    <Link
      href={`/marketplace/collections/${encodeURIComponent(collection.collectionKey)}`}
      className="group overflow-hidden rounded-2xl border border-zinc-800/80 bg-[#0d1118] transition-colors hover:border-mint/35"
    >
      <div className="aspect-[3/4] bg-[#0a0f16]">
        {collection.coverImageUrl ? (
          <CollectionCoverFrame
            imageUrl={collection.coverImageUrl}
            variant="compact"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-zinc-900" />
        )}
      </div>
      <div className="space-y-2 p-3">
        <h3 className="truncate text-lg font-semibold text-white">{collection.displayLabel}</h3>
        <div className="flex min-w-0 items-stretch gap-2 rounded-xl border border-zinc-800/70 bg-black/30 px-2 py-1.5">
          <dl className="min-w-0 flex-1 space-y-1.5 text-[10px] leading-tight tabular-nums sm:text-[11px]">
            <div className="min-w-0">
              <dt className="text-zinc-500">Market price</dt>
              <dd
                className="truncate text-xs font-semibold text-cyan-300 sm:text-sm"
                title={eBayUsd != null ? formatUsd(eBayUsd) : undefined}
              >
                {eBayUsd != null ? formatUsd(eBayUsd) : "—"}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-zinc-500">Tokenable</dt>
              <dd
                className="truncate text-xs font-semibold text-emerald-300 sm:text-sm"
                title={tokenablePrice != null ? formatUsd(tokenablePrice) : undefined}
              >
                {tokenablePrice != null ? formatUsd(tokenablePrice) : "—"}
              </dd>
            </div>
          </dl>
          <div className="flex w-[38%] max-w-[5.75rem] min-w-[4.25rem] shrink-0 flex-col justify-center border-l border-zinc-800/60 pl-2">
            <CollectionListSparkline
              points={sparkPoints}
              positive={pctPositive}
              className="h-10 min-h-[2.5rem] w-full min-w-0"
            />
          </div>
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

  const isLoading = ordersLoading || colLoading;
  const stats = useMarketStats(orders, collectionSummaries.length);

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

  const marketCapDisplay =
    stats.totalValue > 0
      ? `$${stats.totalValue >= 1000 ? `${(stats.totalValue / 1000).toFixed(1)}K` : stats.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      : "$0";

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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 pb-24">
        {/* Title */}
        <div className="mb-10 sm:mb-12">
          <h1 className="mb-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Markets
          </h1>
        </div>

        {/* Stats: one compact row on mobile; three cards from sm */}
        <div className="mb-10 space-y-0 sm:mb-16">
          <MarketsStatsMobileStrip
            marketCapDisplay={marketCapDisplay}
            listingsDisplay={stats.totalListings.toString()}
            collectionsDisplay={stats.totalCollections.toString()}
          />
          <div className="hidden grid-cols-3 gap-5 sm:grid">
            <StatCard label="Total Market CAP" value={marketCapDisplay} />
            <StatCard label="Active Listings" value={stats.totalListings.toString()} />
            <StatCard label="Collections" value={stats.totalCollections.toString()} />
          </div>
        </div>

        <TrendingCollectionsCarousel snapshotByKey={snapshotByKey} />

        {/* Collection list */}
        <div className="mb-8 sm:mb-10">
          <h2 className="mb-4 text-2xl font-bold sm:mb-5 sm:text-3xl">Card Trading List</h2>
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
                className="inline-flex shrink-0 items-center gap-1 self-end rounded-xl border border-zinc-700/80 bg-zinc-900/80 p-1 sm:self-auto"
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
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4 pt-1">
            {filteredSorted.map((c) => (
              <CollectionGridCard
                key={c.collectionKey}
                collection={c}
                snapshot={snapshotByKey.get(c.collectionKey.toLowerCase())}
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
                className="group flex items-center gap-5 rounded-2xl border border-gray-800/50 bg-[#0d0d0d] px-5 py-5 transition-colors hover:border-gray-700/80 hover:bg-[#121212] sm:gap-6 sm:px-6 sm:py-6"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center text-lg text-gray-600">
                  ○
                </div>
                <div className="flex aspect-[3/4] w-[108px] shrink-0 items-center justify-center rounded-2xl border border-gray-700/50 bg-gray-800/60 text-xl text-gray-600 sm:w-[136px]">
                  ?
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xl font-bold text-gray-300 transition-colors group-hover:text-mint sm:text-2xl">
                    Other Listings
                  </h3>
                  <p className="mt-1.5 text-base text-gray-500 sm:text-lg">
                    No collection metadata
                  </p>
                </div>
                <div className="hidden text-base sm:block sm:text-lg">
                  <span className="text-gray-500">Orders </span>
                  <span className="font-bold text-white">{orphanAsks.length}</span>
                </div>
                <span className="shrink-0 text-xl text-gray-600 transition-colors group-hover:text-mint sm:text-2xl">
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
