"use client";

import { useMemo, useState } from "react";
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
  type CollectionCategoryFilterId,
} from "@/lib/market";
import { parseGradeScoreNumber, representativeGradeUsd } from "@/lib/market";
import { toCardDisplayUppercase } from "@/lib/marketplace/collectionFullDetailsTitle";

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

/** Markets copy — matches backend snapshot `marketChangeWindow` suffix (e.g. `1yr`). */
function formatMarketChangeWindowShort(
  w: CollectionListMarketSnapshot["marketChangeWindow"] | undefined | null,
): string {
  if (w == null) return "";
  const map: Record<string, string> = {
    "24h": "24h",
    "7d": "7d",
    "30d": "30d",
    "90d": "90d",
    "180d": "6mo",
    "365d": "1yr",
  };
  return map[w] ?? w;
}

/** Grid + list pills: same height, padding, radius, and font size */
const EXCHANGE_CARD_BADGE_BASE =
  "box-border inline-flex h-[26px] max-w-full min-w-0 shrink-0 items-center justify-center rounded-[4px] border px-2 text-[11px] font-bold leading-none";

/** Numeric / %-style badges — tabular figures */
const EXCHANGE_CARD_BADGE_NUMERIC = `${EXCHANGE_CARD_BADGE_BASE} whitespace-nowrap tabular-nums gap-1`;

/** Pop / Listed neutral chrome */
const EXCHANGE_CARD_BADGE_KV = `${EXCHANGE_CARD_BADGE_BASE} gap-1 whitespace-nowrap border-[rgba(255,255,255,0.22)] bg-black/50 text-white`;

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
  const comp = collection.components as Record<string, unknown> & { gradeScore?: string };

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
  const sparklinePoints =
    snapshot?.sparklineUsd != null && snapshot.sparklineUsd.length >= 2
      ? snapshot.sparklineUsd
      : null;
  const effectiveRefUsd = refUsd;
  const tokenablePrice = floor ?? lastTrade;
  const tokenableVsRefPct = percentDiffVersusRef(tokenablePrice, effectiveRefUsd);
  const changePctExternal =
    pct != null && Number.isFinite(pct) ? pct : null;
  const changeWinShort = formatMarketChangeWindowShort(snapshot?.marketChangeWindow);

  const trendPct =
    snapshot?.marketChangePct != null && Number.isFinite(snapshot.marketChangePct)
      ? snapshot.marketChangePct
      : null;
  const pop = parsePsaPopulationFromComponents(comp);

  return (
    <Link
      href={`/marketplace/collections/${encodeURIComponent(collection.collectionKey)}`}
      className="group flex flex-col gap-3 rounded-2xl border border-zinc-700/70 bg-gradient-to-r from-[#0f1117] via-[#10131a] to-[#0e1218] px-3 py-3 transition-all hover:border-mint/35 hover:shadow-[0_0_26px_rgba(135,255,72,0.12)] sm:flex-row sm:items-center sm:gap-6 sm:rounded-3xl sm:px-6 sm:py-6"
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
        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
          {trendPct != null ? (
            <span
              className={`${EXCHANGE_CARD_BADGE_NUMERIC} ${
                trendPct >= 0
                  ? "border border-[rgba(0,187,61,1)] bg-[rgba(0,0,0,0.5)] text-[rgba(0,187,61,1)]"
                  : "border-rose-400/45 bg-black/50 text-rose-300"
              }`}
              title={
                snapshot?.marketChangeWindow
                  ? `External reference (${snapshot.marketChangeWindow})`
                  : "External reference vs prior window"
              }
            >
              {formatSignedPct2(trendPct)}
              {changeWinShort ? ` ${changeWinShort}` : ""}
            </span>
          ) : null}
          {pop != null ? (
            <span className={EXCHANGE_CARD_BADGE_KV} title={`PSA population: ${pop.toLocaleString()}`}>
              <span>Pop</span>
              <span className="tabular-nums">{pop.toLocaleString()}</span>
            </span>
          ) : null}
          <span
            className={EXCHANGE_CARD_BADGE_KV}
            title={`${listingCount} listing${listingCount !== 1 ? "s" : ""} on Tokenable`}
          >
            <span>Listed</span>
            <span className="tabular-nums">{listingCount}</span>
          </span>
        </div>
        {(tokenableVsRefPct != null || changePctExternal != null) ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {tokenableVsRefPct != null ? (
              <span
                className={`${EXCHANGE_CARD_BADGE_NUMERIC} ${
                  tokenableVsRefPct >= 0
                    ? "border border-[rgba(0,187,61,1)] bg-[rgba(0,0,0,0.5)] text-[rgba(0,187,61,1)]"
                    : "border-mint/35 bg-mint/20 text-white/95"
                }`}
                title={`Tokenable Price (${tokenablePrice != null ? formatUsd(tokenablePrice) : "—"}) vs eBay (${effectiveRefUsd != null ? formatUsd(effectiveRefUsd) : "—"})`}
              >
                Market Gap {tokenableVsRefPct >= 0 ? "+" : ""}
                {tokenableVsRefPct.toFixed(1)}%
              </span>
            ) : null}
            {changePctExternal != null ? (
              <span
                className={`${EXCHANGE_CARD_BADGE_NUMERIC} ${
                  changePctExternal >= 0
                    ? "border border-[rgba(0,187,61,1)] bg-[rgba(0,0,0,0.5)] text-[rgba(0,187,61,1)]"
                    : "border-rose-300/30 bg-rose-500/15 text-rose-200"
                }`}
                title={
                  snapshot?.marketChangeWindow != null && snapshot.marketChangeWindow.length > 0
                    ? `External reference (${snapshot.marketChangeWindow}): interpolated change on Cardhedger history`
                    : "External reference: interpolated change on Cardhedger history"
                }
              >
                {changeWinShort ? `${changeWinShort} ` : ""}
                {changePctExternal >= 0 ? "+" : ""}
                {changePctExternal.toFixed(1)}%
              </span>
            ) : null}
          </div>
        ) : null}
        <dl className="mt-3 space-y-2 text-xs leading-snug text-zinc-300 sm:text-sm sm:leading-tight">
          <div className="flex items-baseline justify-between gap-2">
            <dt className="max-w-[58%] shrink-0 text-white">Price</dt>
            <dd
              className="min-w-0 text-right tabular-nums text-sm font-bold text-[rgba(135,255,72,1)] sm:text-base md:text-lg"
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

      <div className="flex w-full min-w-0 shrink-0 flex-col items-stretch gap-1 sm:w-auto sm:items-end">
        <CollectionListSparkline
          points={sparklinePoints}
          positive={changePctExternal == null ? undefined : changePctExternal >= 0}
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
}: {
  collection: MarketplaceCollectionSummary;
  snapshot: CollectionListMarketSnapshot | undefined;
  resolvedCoverUrl?: string;
  listingCount: number;
}) {
  const comp = collection.components as Record<string, unknown> & { gradeScore?: string };
  const jtSpot = representativeGradeUsd(
    snapshot?.gradePrices ?? null,
    parseGradeScoreNumber(comp.gradeScore),
  );
  const marketPriceUsd =
    jtSpot != null && Number.isFinite(jtSpot) && jtSpot > 0 ? jtSpot : null;

  const trendPct =
    snapshot?.marketChangePct != null && Number.isFinite(snapshot.marketChangePct)
      ? snapshot.marketChangePct
      : null;

  const windowShort = formatMarketChangeWindowShort(snapshot?.marketChangeWindow);
  const pop = parsePsaPopulationFromComponents(comp);

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
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-2.5 sm:gap-2 sm:p-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
          {trendPct != null ? (
            <span
              className={`${EXCHANGE_CARD_BADGE_NUMERIC} ${
                trendPct >= 0
                  ? "border border-[rgba(0,187,61,1)] bg-[rgba(0,0,0,0.5)] text-[rgba(0,187,61,1)]"
                  : "border-rose-400/45 bg-black/50 text-rose-300"
              }`}
              title={
                snapshot?.marketChangeWindow
                  ? `External reference (${snapshot.marketChangeWindow})`
                  : "External reference vs prior window"
              }
            >
              {formatSignedPct2(trendPct)}
              {windowShort ? ` ${windowShort}` : ""}
            </span>
          ) : null}
          {pop != null ? (
            <span
              className={EXCHANGE_CARD_BADGE_KV}
              title={`PSA population: ${pop.toLocaleString()}`}
            >
              <span>Pop</span>
              <span className="tabular-nums">{pop.toLocaleString()}</span>
            </span>
          ) : null}
          <span
            className={EXCHANGE_CARD_BADGE_KV}
            title={`${listingCount} listing${listingCount !== 1 ? "s" : ""} on Tokenable`}
          >
            <span>Listed</span>
            <span className="tabular-nums">{listingCount}</span>
          </span>
        </div>

        <h3
          className="line-clamp-2 break-words text-[0.8125rem] font-bold leading-snug text-white sm:text-[1.05rem]"
          title={collection.displayLabel}
        >
          {collection.displayLabel}
        </h3>

        <div className="mt-auto flex items-baseline justify-between gap-2 pt-0.5">
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-white sm:text-[11px]">
            Price
          </span>
          <span
            className="min-w-0 truncate text-right text-[0.9375rem] font-bold tabular-nums leading-none text-[rgba(135,255,72,1)] sm:text-lg"
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
      <div className="mx-auto max-w-6xl px-3 pb-20 pt-8 max-[380px]:px-2 sm:px-6 sm:pb-24 sm:pt-12">
        {!isLoading && sortedForRank.length > 0 ? (
          <>
            <h2 className="mb-3 text-xl font-bold leading-tight tracking-tight text-white sm:mb-5 sm:text-3xl">
              Card Trading List
            </h2>
            <div className="mb-4 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:flex-nowrap sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0 w-full sm:flex-1">
                <CollectionCategoryFilterBar
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  toolbarAriaLabel="Filter card trading list category"
                  mobileSectionHeading="Trading list"
                />
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
              <div className="absolute left-0 top-0 h-full w-[32%] rounded-full bg-mint/90 shadow-[0_0_14px_rgba(135,255,72,0.4)] exchange-snapshot-loading-fill" />
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
