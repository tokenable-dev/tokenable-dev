"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  getActiveOrders,
  postMarketplaceCollectionSnapshotsBatched,
  type CollectionListMarketSnapshot,
  type CollectionUsdPoint,
  type MarketplaceCollectionSummary,
  type OrderListItem,
} from "@/lib/api";
import { rq, marketplaceRqPolicy } from "@/lib/queryKeys";
import { useMarketplaceCollectionsInfinite } from "@/hooks/useMarketplaceCollectionsInfinite";
import { CollectionCoverFrame } from "@/components/marketplace/CollectionCoverFrame";
import { CollectionCategoryFilterBar } from "@/components/marketplace/CollectionCategoryFilterBar";
import { CollectionListSparkline } from "@/components/marketplace/CollectionListSparkline";
import {
  collectionMatchesCategoryFilter,
  inferCollectionSportBucket,
  type CollectionCategoryFilterId,
} from "@/lib/collectionCategoryFilter";
import { parseGradeScoreNumber } from "@/lib/gradedCardMarketCap";
import { justtcgRepresentativeUsd } from "@/lib/externalMarketPrice";

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
  const comp = collection.components as {
    gradeScore?: string;
    gradingCompany?: string;
    cardSet?: string;
    cardNumber?: string;
  };

  const jtSpot = justtcgRepresentativeUsd(
    snapshot?.gradePrices ?? null,
    parseGradeScoreNumber(comp.gradeScore),
  );

  const subtitle = [
    comp.gradingCompany,
    comp.cardSet,
    comp.cardNumber ? `#${comp.cardNumber}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

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
      className="group flex items-center gap-5 rounded-3xl border border-zinc-700/70 bg-gradient-to-r from-[#0f1117] via-[#10131a] to-[#0e1218] px-5 py-5 transition-all hover:border-mint/35 hover:shadow-[0_0_26px_rgba(148,255,212,0.08)] sm:gap-6 sm:px-6 sm:py-6"
    >
      <div className="relative w-[156px] shrink-0 sm:w-[196px]">
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
        {subtitle ? (
          <p className="mt-1 truncate text-sm text-zinc-400 sm:text-base">{subtitle}</p>
        ) : null}
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
            <dt className="min-w-[9.5rem] shrink-0 text-zinc-400">Active Listings</dt>
            <dd className="tabular-nums text-base font-bold text-white sm:text-lg">{listingCount}</dd>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <dt className="min-w-[9.5rem] shrink-0 text-zinc-400">eBay Price</dt>
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
            <dt className="min-w-[9.5rem] shrink-0 text-zinc-400">Tokenable Price</dt>
            <dd
              className="tabular-nums text-base font-bold text-emerald-300 sm:text-lg"
              title={floor != null ? "Current Tokenable floor listing (active asks)." : "Most recent Tokenable trade (fallback when no active floor)."}
            >
              {tokenablePrice != null ? formatUsd(tokenablePrice) : "—"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <CollectionListSparkline
          points={sparklinePoints}
          positive={upTo1yChangePct == null ? undefined : upTo1yChangePct >= 0}
        />
      </div>
    </Link>
  );
}

function CollectionGridCard({
  collection,
  listingCount,
  snapshot,
}: {
  collection: MarketplaceCollectionSummary;
  listingCount: number;
  snapshot: CollectionListMarketSnapshot | undefined;
}) {
  const comp = collection.components as {
    gradeScore?: string;
    gradingCompany?: string;
    cardSet?: string;
    cardNumber?: string;
  };
  const subtitle = [comp.gradingCompany, comp.cardSet, comp.cardNumber ? `#${comp.cardNumber}` : null]
    .filter(Boolean)
    .join(" · ");
  const jtSpot = justtcgRepresentativeUsd(
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
        {subtitle ? <p className="truncate text-xs text-zinc-500">{subtitle}</p> : null}
        <div className="rounded-xl border border-zinc-800/70 bg-black/30 px-1.5 py-1">
          <CollectionListSparkline
            points={
              snapshot?.sparklineUsd != null && snapshot.sparklineUsd.length >= 2
                ? snapshot.sparklineUsd
                : mockSparkline
            }
            positive={
              snapshot?.marketChangePct != null
                ? snapshot.marketChangePct >= 0
                : percentChangeFromPoints(mockSparkline) != null
                  ? Number(percentChangeFromPoints(mockSparkline)) >= 0
                  : undefined
            }
            className="h-14 w-full"
          />
        </div>
        <div className="space-y-1.5 border-t border-zinc-800/80 pt-2 text-sm">
          <p className="flex items-center justify-between gap-2">
            <span className="text-zinc-500">Active Listings</span>
            <span className="font-semibold tabular-nums text-zinc-100">{listingCount}</span>
          </p>
          <p className="flex items-center justify-between gap-2">
            <span className="text-zinc-500">eBay Price</span>
            <span className="font-semibold tabular-nums text-cyan-300">
              {eBayUsd != null ? formatUsd(eBayUsd) : "—"}
            </span>
          </p>
          <p className="flex items-center justify-between gap-2">
            <span className="text-zinc-500">Tokenable Price</span>
            <span className="font-semibold tabular-nums text-emerald-300">
              {tokenablePrice != null ? formatUsd(tokenablePrice) : "—"}
            </span>
          </p>
        </div>
      </div>
    </Link>
  );
}

export default function ExchangePage() {
  const [categoryFilter, setCategoryFilter] = useState<CollectionCategoryFilterId>("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

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

  /** Snapshots (pool stats + PokéTrace bundle + sparkline) — show bar while this request runs */
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

  const trendingNow = useMemo(() => {
    return [...collectionSummaries]
      .sort((a, b) => {
        const ta = new Date(a.createdAt).getTime();
        const tb = new Date(b.createdAt).getTime();
        if (ta !== tb) return tb - ta;
        return a.displayLabel.localeCompare(b.displayLabel);
      })
      .slice(0, 10);
  }, [collectionSummaries]);

  const trendingRailRef = useRef<HTMLDivElement | null>(null);
  const scrollTrending = (dir: "left" | "right") => {
    const el = trendingRailRef.current;
    if (!el) return;
    const delta = Math.max(260, Math.floor(el.clientWidth * 0.78));
    el.scrollBy({ left: dir === "left" ? -delta : delta, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 pb-24">
        {/* Title */}
        <div className="mb-10 sm:mb-12">
          <h1 className="mb-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Exchange
          </h1>
        </div>

        {/* Stats */}
        <div className="mb-14 sm:mb-16 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
          <StatCard
            label="Total Market CAP"
            value={
              stats.totalValue > 0
                ? `$${stats.totalValue >= 1000 ? `${(stats.totalValue / 1000).toFixed(1)}K` : stats.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                : "$0"
            }
          />
          <StatCard
            label="Active Listings"
            value={stats.totalListings.toString()}
          />
          <StatCard
            label="Collections"
            value={stats.totalCollections.toString()}
          />
        </div>

        {/* Trending slider */}
        {trendingNow.length > 0 ? (
          <section className="mb-16 mt-2 sm:mb-20 sm:mt-4" aria-label="Trending now collections">
            <div className="mb-6 sm:mb-7">
              <h2 className="text-3xl font-extrabold tracking-tight text-white">Trending Now</h2>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => scrollTrending("left")}
                aria-label="Scroll trending left"
                className="absolute left-0 top-1/2 z-20 -translate-y-1/2 rounded-full border border-zinc-700/80 bg-zinc-950/85 p-2 text-zinc-300 transition-colors hover:border-mint/40 hover:text-mint"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => scrollTrending("right")}
                aria-label="Scroll trending right"
                className="absolute right-0 top-1/2 z-20 -translate-y-1/2 rounded-full border border-zinc-700/80 bg-zinc-950/85 p-2 text-zinc-300 transition-colors hover:border-mint/40 hover:text-mint"
              >
                ›
              </button>

              <div
                ref={trendingRailRef}
                className="flex snap-x snap-mandatory justify-center gap-5 overflow-x-auto overflow-y-hidden px-12 pb-2 pt-1 scrollbar-platform"
              >
              {trendingNow.map((c) => {
                const s = snapshotByKey.get(c.collectionKey.toLowerCase());
                const ms = s?.marketStats ?? null;
                const tokenablePrice =
                  ms?.floor != null && Number.isFinite(ms.floor) && ms.floor > 0
                    ? ms.floor
                    : s?.lastTokenableTradeUsdc != null &&
                        Number.isFinite(s.lastTokenableTradeUsdc) &&
                        s.lastTokenableTradeUsdc > 0
                      ? s.lastTokenableTradeUsdc
                      : null;
                const comp = c.components as { gradeScore?: string };
                const eBayPrice = justtcgRepresentativeUsd(
                  s?.gradePrices ?? null,
                  parseGradeScoreNumber(comp.gradeScore),
                );
                return (
                  <Link
                    key={c.collectionKey}
                    href={`/marketplace/collections/${encodeURIComponent(c.collectionKey)}`}
                    className="group w-[220px] shrink-0 snap-start"
                  >
                    <div className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-[#0d1118] transition-colors group-hover:border-mint/35">
                      <div className="aspect-[3/4] bg-[#0a0e14]">
                        {c.coverImageUrl ? (
                          <CollectionCoverFrame
                            imageUrl={c.coverImageUrl}
                            variant="compact"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full bg-zinc-900" />
                        )}
                      </div>
                      <div className="space-y-1.5 p-3">
                        <p className="truncate text-lg font-semibold text-white">{c.displayLabel}</p>
                        <div className="space-y-1 text-sm">
                          <p className="flex items-center justify-between gap-2">
                            <span className="text-zinc-500">Market Price</span>
                            <span className="font-semibold tabular-nums text-cyan-300">
                              {eBayPrice != null && Number.isFinite(eBayPrice) && eBayPrice > 0
                                ? formatUsd(eBayPrice)
                                : "—"}
                            </span>
                          </p>
                          <p className="flex items-center justify-between gap-2">
                            <span className="text-zinc-500">Tokenable</span>
                            <span className="font-semibold tabular-nums text-emerald-300">
                              {tokenablePrice != null ? formatUsd(tokenablePrice) : "—"}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
              </div>
            </div>
          </section>
        ) : null}

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
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <CollectionCategoryFilterBar value={categoryFilter} onChange={setCategoryFilter} />
              <div className="inline-flex items-center gap-1 rounded-lg border border-zinc-700/80 bg-zinc-900/80 p-1">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  aria-label="Grid view"
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
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
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
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
                listingCount={c.activeListingCount}
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
