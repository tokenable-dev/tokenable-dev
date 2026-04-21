"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import type { Address } from "viem";
import { formatUnits } from "viem";
import {
  getCollectionMarketSeries,
  getCollectionMarketStats,
  getCollectionPoketraceNmHistory,
  getCollectionPoketracePreview,
  getCollectionPlatformTrades,
  getMarketplaceCollectionDetail,
  type Order,
} from "@/lib/api";
import {
  coefficientOfVariationPctFromUsdSeries,
  resolveExternalMarketUsd,
} from "@/lib/externalMarketPrice";
import { CollectionOverviewBoard } from "@/components/marketplace/CollectionOverviewBoard";
import { CollectionPriceMetricsStrip } from "@/components/marketplace/CollectionPriceMetricsStrip";
import type { BookRowSelection } from "@/components/marketplace/CollectionTradeTicket";
import { CollectionUnifiedOrderBook } from "@/components/marketplace/CollectionUnifiedOrderBook";
import { CollectionTradingTabs } from "@/components/marketplace/CollectionTradingTabs";
import { CollectionTradeGuide } from "@/components/marketplace/CollectionTradeGuide";
import { CollectionOwnedRwaListModal } from "@/components/marketplace/CollectionOwnedRwaListModal";
import {
  TradeCelebrationModal,
  type TradeCelebrationKind,
} from "@/components/marketplace/TradeCelebrationModal";
import { CollectionDualPriceChart } from "@/components/marketplace/CollectionDualPriceChart";
import { CollectionRwaCard } from "@/components/marketplace/CollectionRwaCard";
import { CollectionPoketracePanel } from "@/components/marketplace/CollectionPoketracePanel";
import { useAppStore, selectWallet } from "@/store";
import { isCriteriaCollectionBid } from "@/lib/seaport/criteriaMatch";
import {
  computeCollectionMarketCapUsd,
  formatMarketCapUsd,
  parseGradeScoreNumber,
} from "@/lib/gradedCardMarketCap";

/** Same fill can appear from session overlay + DB poll with timestamps minutes apart */
const SESSION_FILL_DEDUP_SEC = 300;

function bestAskByToken(asks: Order[]): Map<number, Order> {
  const m = new Map<number, Order>();
  for (const o of asks) {
    const id = Number(o.tokenId);
    if (!Number.isFinite(id)) continue;
    const prev = m.get(id);
    if (!prev) {
      m.set(id, o);
      continue;
    }
    try {
      if (BigInt(o.considerationAmount) < BigInt(prev.considerationAmount)) {
        m.set(id, o);
      }
    } catch {
      m.set(id, o);
    }
  }
  return m;
}

/** Individual listing strip: oldest active ask first (not lowest token id). */
function sortedTokenIdsByOldestListing(asks: Order[]): number[] {
  const rows = asks.filter(
    (o) => String(o.side ?? "ask").toLowerCase() !== "bid",
  );
  rows.sort((a, b) => {
    const ta = new Date(a.createdAt ?? 0).getTime();
    const tb = new Date(b.createdAt ?? 0).getTime();
    if (ta !== tb) return ta - tb;
    return Number(a.tokenId) - Number(b.tokenId);
  });
  const seen = new Set<number>();
  const out: number[] = [];
  for (const o of rows) {
    const id = Number(o.tokenId);
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function bidDisplayUsdc(b: Order): number {
  let display = Number(b.considerationAmount) / 1_000_000;
  try {
    const offer0 = b.parameters?.offer?.[0];
    if (offer0?.startAmount) display = Number(formatUnits(BigInt(offer0.startAmount), 6));
  } catch {
    /* keep considerationAmount */
  }
  return display;
}

export default function MarketplaceCollectionPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const { address } = useAppStore(useShallow(selectWallet));
  const raw = params.collectionKey;
  const collectionKey = Array.isArray(raw) ? raw[0] : raw;
  const key = typeof collectionKey === "string" ? decodeURIComponent(collectionKey) : "";
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sellModalOpen, setSellModalOpen] = useState(false);
  const [tradeCelebration, setTradeCelebration] = useState<TradeCelebrationKind | null>(null);
  const [bookSelection, setBookSelection] = useState<BookRowSelection | null>(null);
  /** Last fill this session (fixed timestamp) — merged into chart until series refetch includes it. */
  const [sessionFillPoint, setSessionFillPoint] = useState<{
    t: number;
    v: number;
  } | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["marketplace-collection", key],
    queryFn: () => getMarketplaceCollectionDetail(key),
    enabled: key.length > 0,
    retry: false,
  });

  const {
    data: poketracePreview,
    isLoading: poketraceLoading,
    isError: poketraceQueryError,
    error: poketraceQueryErr,
  } = useQuery({
    queryKey: ["collection-poketrace", key],
    queryFn: () => getCollectionPoketracePreview(key),
    enabled: key.length > 0 && !isLoading && !isError && !!data,
    staleTime: 900_000,
    /** PokeTrace free/public tiers are strict — align with server preview cache; no refetch spam */
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const { data: marketSeriesHeader, isLoading: marketSeriesLoading } = useQuery({
    queryKey: ["collection-market-series", key],
    queryFn: () => getCollectionMarketSeries(key, "90d"),
    enabled: key.length > 0 && !isLoading && !isError && !!data,
    staleTime: 120_000,
  });

  const { data: nmHistory, isLoading: nmHistoryLoading } = useQuery({
    queryKey: ["collection-poketrace-nm-history", key, 90],
    queryFn: () => getCollectionPoketraceNmHistory(key, 90),
    enabled: key.length > 0 && !isLoading && !isError && !!data,
    staleTime: 300_000,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const { data: marketStats, isLoading: marketStatsLoading } = useQuery({
    queryKey: ["collection-market-stats", key],
    queryFn: () => getCollectionMarketStats(key),
    enabled: key.length > 0 && !isLoading && !isError && !!data,
    staleTime: 60_000,
    refetchInterval: 45_000,
    refetchIntervalInBackground: false,
  });

  const pokeHistPts = nmHistory?.points ?? [];
  const pokeHistOk = pokeHistPts.length >= 2;
  const jtHistPts = marketSeriesHeader?.externalUsd ?? [];
  const jtHistOk = jtHistPts.length >= 2;

  const chartExternalRollingUsd = useMemo(() => {
    if (pokeHistOk) return pokeHistPts;
    if (jtHistOk) return jtHistPts;
    return [];
  }, [pokeHistOk, pokeHistPts, jtHistOk, jtHistPts]);

  const chartExternalWindowDays = useMemo(() => {
    if (pokeHistOk) return nmHistory?.days ?? 90;
    return null;
  }, [pokeHistOk, nmHistory?.days]);

  const externalVolatilityCvPct = useMemo(
    () => (pokeHistOk ? coefficientOfVariationPctFromUsdSeries(pokeHistPts) : null),
    [pokeHistOk, pokeHistPts],
  );

  const nmHistApprox = nmHistory?.matchConfidence === "approximate";

  const chartExternalLegend = pokeHistOk
    ? nmHistApprox
      ? "PokéTrace NM (daily · approximate match)"
      : "PokéTrace NM (daily)"
    : jtHistOk
      ? "JustTCG (external)"
      : "External market (NM)";

  const chartExternalShort = pokeHistOk
    ? nmHistApprox
      ? "PokéTrace NM ~"
      : "PokéTrace NM"
    : jtHistOk
      ? "JustTCG"
      : "External NM";

  const chartExternalRollingKind = pokeHistOk || jtHistOk ? "history" : "snapshot";

  /** DB-only — chart points + Trades tab tape. */
  const { data: platformTradesData, isLoading: platformTradesLoading } = useQuery({
    queryKey: ["collection-platform-trades", key],
    queryFn: () => getCollectionPlatformTrades(key),
    enabled: key.length > 0,
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });

  const platformPtsBase = useMemo(
    () => platformTradesData?.platformUsd ?? [],
    [platformTradesData?.platformUsd]
  );

  const displayPlatformUsd = useMemo(() => {
    const raw = platformPtsBase;
    const pts: { t: number; v: number }[] = [...raw];
    if (
      sessionFillPoint != null &&
      Number.isFinite(sessionFillPoint.v) &&
      sessionFillPoint.v > 0
    ) {
      const alreadyInSeries = pts.some(
        (p) =>
          Math.abs(p.v - sessionFillPoint.v) < 1e-4 &&
          Math.abs(p.t - sessionFillPoint.t) <= SESSION_FILL_DEDUP_SEC
      );
      if (!alreadyInSeries) pts.push(sessionFillPoint);
    }
    pts.sort((a, b) => a.t - b.t);
    const deduped: { t: number; v: number }[] = [];
    for (const p of pts) {
      if (deduped.length && deduped[deduped.length - 1].t === p.t) {
        deduped[deduped.length - 1] = p;
      } else {
        deduped.push(p);
      }
    }
    return deduped;
  }, [platformPtsBase, sessionFillPoint]);

  const platformPriceSamples = useMemo(
    () => displayPlatformUsd.map((p) => p.v),
    [displayPlatformUsd]
  );

  /** 메트릭 Current Price — 플랫폼 체결 시계열의 최신점(세션 오버레이 포함) */
  const lastPlatformTradePriceUsd = useMemo(() => {
    const pts = displayPlatformUsd;
    if (!pts.length) return null;
    const last = pts[pts.length - 1];
    return typeof last.v === "number" && Number.isFinite(last.v) && last.v > 0
      ? last.v
      : null;
  }, [displayPlatformUsd]);

  /** 직전 체결 → 최근 체결 사이 변동률 % (동일 시계열) */
  const lastTwoTradesPriceChangePct = useMemo(() => {
    const pts = displayPlatformUsd;
    if (pts.length < 2) return null;
    const prev = pts[pts.length - 2].v;
    const last = pts[pts.length - 1].v;
    if (!(typeof prev === "number" && Number.isFinite(prev) && prev > 0)) return null;
    if (!(typeof last === "number" && Number.isFinite(last))) return null;
    return ((last - prev) / prev) * 100;
  }, [displayPlatformUsd]);

  function invalidateCollection() {
    void queryClient.invalidateQueries({ queryKey: ["marketplace-collection", key] });
    void queryClient.invalidateQueries({ queryKey: ["collection-platform-trades", key] });
    void queryClient.invalidateQueries({ queryKey: ["collection-market-series", key] });
    void queryClient.invalidateQueries({ queryKey: ["collection-market-stats", key] });
    void queryClient.invalidateQueries({ queryKey: ["collection-poketrace", key] });
    void queryClient.invalidateQueries({ queryKey: ["collection-poketrace-nm-history", key] });
    void queryClient.invalidateQueries({ queryKey: ["merkle-set", key] });
    void queryClient.invalidateQueries({ queryKey: ["merkle-set"] });
  }

  const asks = useMemo(
    () => (data ? data.listings.filter((o) => o.side !== "bid") : []),
    [data]
  );

  const collectionBids = useMemo(() => {
    if (!data?.collectionBids) return [];
    return data.collectionBids.filter((b) => b.status === "active");
  }, [data?.collectionBids]);

  const criteriaBidCount = useMemo(
    () => collectionBids.filter((b) => isCriteriaCollectionBid(b)).length,
    [collectionBids]
  );

  const askMap = useMemo(() => bestAskByToken(asks), [asks]);
  const tokenIds = useMemo(
    () => (data ? sortedTokenIdsByOldestListing(asks) : []),
    [data, asks],
  );

  const comp = useMemo(() => {
    const raw = data?.collection?.components as
      | {
          cardName?: string;
          gradingCompany?: string;
          gradeScore?: string;
          cardSet?: string;
          cardNumber?: string;
          variant?: string;
          psaTotalPopulation?: number;
        }
      | undefined;
    return raw ?? {};
  }, [data?.collection?.components]);

  const resolvedExternal = useMemo(
    () =>
      resolveExternalMarketUsd({
        poketracePreview,
        gradePrices: marketSeriesHeader?.gradePrices ?? null,
        gradeScore: parseGradeScoreNumber(comp.gradeScore),
      }),
    [poketracePreview, marketSeriesHeader?.gradePrices, comp.gradeScore],
  );

  const chartExternalRefTag =
    resolvedExternal.source === "poketrace"
      ? resolvedExternal.poketraceMatchConfidence === "approximate"
        ? "PokéTrace NM ~"
        : "PokéTrace NM"
      : resolvedExternal.source === "justtcg"
        ? "JustTCG"
        : "External NM";

  const marketCapComputation = useMemo(
    () =>
      data?.collection
        ? computeCollectionMarketCapUsd({
            components: data.collection.components as Record<string, unknown>,
            gradeScoreStr: comp.gradeScore,
            poketraceCard: poketracePreview?.card ?? null,
            poketraceMatchConfidence: poketracePreview?.matchConfidence,
            gradePrices: marketSeriesHeader?.gradePrices ?? null,
          })
        : null,
    [
      data?.collection,
      comp.gradeScore,
      poketracePreview?.card,
      poketracePreview?.matchConfidence,
      marketSeriesHeader?.gradePrices,
    ],
  );

  const metadataRows = useMemo(() => {
    const rows: { label: string; value: string }[] = [];
    if (comp.cardName) rows.push({ label: "Card", value: comp.cardName });
    if (comp.cardSet) rows.push({ label: "Set", value: comp.cardSet });
    if (comp.cardNumber) rows.push({ label: "Card #", value: comp.cardNumber });
    if (comp.variant) rows.push({ label: "Variant", value: comp.variant });
    if (comp.gradingCompany) rows.push({ label: "Grader", value: comp.gradingCompany });
    if (comp.gradeScore) rows.push({ label: "Grade", value: comp.gradeScore });
    return rows;
  }, [comp]);

  const subtitle = useMemo(() => {
    const parts = [comp.cardSet, comp.cardNumber].filter(
      (x): x is string => typeof x === "string" && x.trim().length > 0
    );
    return parts.length ? parts.join(" · ") : null;
  }, [comp.cardSet, comp.cardNumber]);

  /** Latest on-platform sale (DB poll or initial bundle). */
  const lastPlatformSaleUsdc = useMemo(() => {
    const pts = platformPtsBase;
    if (!pts.length) return null;
    const last = pts[pts.length - 1];
    return typeof last.v === "number" && Number.isFinite(last.v) && last.v > 0 ? last.v : null;
  }, [platformPtsBase]);

  const orderBookLastSaleUsdc = sessionFillPoint?.v ?? lastPlatformSaleUsdc;

  useEffect(() => {
    setSessionFillPoint(null);
  }, [key]);

  /** Clear session overlay once DB poll includes this fill (timestamps often differ by more than a few seconds). */
  useEffect(() => {
    if (!sessionFillPoint || !platformPtsBase.length) return;
    const found = platformPtsBase.some(
      (p) =>
        Math.abs(p.v - sessionFillPoint.v) < 1e-4 &&
        Math.abs(p.t - sessionFillPoint.t) <= SESSION_FILL_DEDUP_SEC
    );
    if (found) setSessionFillPoint(null);
  }, [platformPtsBase, sessionFillPoint]);

  const marketMetrics = useMemo(() => {
    const askPrices = asks
      .filter((o) => String(o.side ?? "ask").toLowerCase() !== "bid")
      .map((o) => Number(o.considerationAmount) / 1_000_000)
      .filter((n) => Number.isFinite(n));
    const floor = askPrices.length ? Math.min(...askPrices) : null;
    const listingsNotional = askPrices.reduce((a, b) => a + b, 0);

    let bestBid: number | null = null;
    for (const b of collectionBids) {
      if (!isCriteriaCollectionBid(b) || b.status !== "active") continue;
      const d = bidDisplayUsdc(b);
      if (bestBid == null || d > bestBid) bestBid = d;
    }

    let spreadPct: number | null = null;
    if (floor != null && bestBid != null && floor > 0 && bestBid > 0) {
      const mid = (floor + bestBid) / 2;
      if (mid > 0) spreadPct = (Math.abs(floor - bestBid) / mid) * 100;
    }

    return { floor, listingsNotional, spreadPct };
  }, [asks, collectionBids]);

  /** Sync buy/bid price field when user clicks a row in the order book (ask or bid). */
  const presetPriceFromBook = useMemo(() => {
    if (bookSelection == null) return null;
    return bookSelection.price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [bookSelection]);

  /** Sell flow: prefill list price only when a bid (green) row is selected — match that bid by listing at the same USDC. */
  const listPricePresetUsdc = useMemo(() => {
    if (bookSelection?.side !== "bid") return null;
    return presetPriceFromBook;
  }, [bookSelection, presetPriceFromBook]);

  /** First bid order at the selected depth — drives list-then-match priority (same price, multiple bids). */
  const preferredBidOrderHash = useMemo(() => {
    if (bookSelection?.side !== "bid" || !bookSelection.orders.length) return null;
    return bookSelection.orders[0]?.orderHash ?? null;
  }, [bookSelection]);

  if (!key) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-gray-500 text-sm">
        Invalid collection.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white">
        <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-5 lg:px-8 xl:px-10 py-8 pb-20">
          <div className="h-4 w-40 bg-gray-800/80 rounded animate-pulse mb-6" />
          <div className="rounded-2xl border border-gray-800/90 bg-[#0b0e11] overflow-hidden animate-pulse mb-10">
            <div className="border-b border-gray-800/80 px-4 py-4 sm:px-6">
              <div className="h-10 w-48 rounded-md bg-gray-800/50" />
            </div>
            <div className="grid gap-6 p-6 lg:grid-cols-[minmax(180px,240px)_minmax(0,1fr)_minmax(300px,420px)]">
              <div className="flex justify-center">
                <div className="aspect-[3/4] w-full max-w-[240px] rounded-2xl bg-gray-800/60" />
              </div>
              <div className="space-y-4 min-w-0">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(260px,304px)] gap-3">
                  <div className="h-72 min-h-[280px] lg:h-96 lg:min-h-[320px] rounded-xl bg-gray-800/40" />
                  <div className="h-72 min-h-[280px] lg:h-96 lg:min-h-[320px] rounded-xl bg-gray-800/35 border border-gray-800/80" />
                </div>
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-900/40 min-h-[260px]" />
            </div>
          </div>
          <div className="flex gap-4 overflow-hidden">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-72 w-[200px] shrink-0 rounded-2xl bg-gray-800/40 border border-gray-800/80"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !data || !data.collection) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center">
        <p className="text-red-400 text-sm mb-4">
          {isError && error instanceof Error
            ? error.message
            : "Collection not found (no summary row for this bucket yet). List an NFT in this bucket or open it from the exchange after the first listing."}
        </p>
        <Link href="/exchange" className="text-mint text-sm hover:underline">
          ← Back to Exchange
        </Link>
      </div>
    );
  }

  const { collection, representativeImageUrl } = data;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-5 lg:px-8 xl:px-10 py-8 pb-20">
        <Link
          href="/exchange"
          className="inline-flex text-sm text-mint/90 hover:text-mint mb-6"
        >
          ← Back to Exchange
        </Link>

        <CollectionOverviewBoard
          title={collection.displayLabel}
          subtitle={subtitle}
          badgeLabel="Collection"
          imageUrl={representativeImageUrl}
          metadataRows={metadataRows}
          stats={[]}
          chartMetricsRow={
            <CollectionPriceMetricsStrip
              externalMarketUsd={resolvedExternal.usd}
              externalPriceSource={resolvedExternal.source}
              externalPoketraceMatchConfidence={resolvedExternal.poketraceMatchConfidence}
              externalPriceLoading={
                poketraceLoading || nmHistoryLoading || marketSeriesLoading
              }
              externalVolatilityCvPct={externalVolatilityCvPct}
              marketStats={marketStats ?? null}
              marketStatsLoading={marketStatsLoading}
              lastPlatformTradeUsd={lastPlatformTradePriceUsd}
              priceChangePct={lastTwoTradesPriceChangePct}
              platformPriceSamples={platformPriceSamples}
              bookSpreadPct={marketMetrics.spreadPct}
              marketCapUsd={marketCapComputation?.usd ?? null}
              formatMarketCap={formatMarketCapUsd}
            />
          }
          heroCoverLoupe
          metadataExpand={{
            collectionKey: collection.collectionKey,
            displayLabel: collection.displayLabel,
            queryUsed: collection.queryUsed,
            createdAt: collection.createdAt,
            representativeImageUrl,
            components: collection.components,
            marketSeriesMeta: null,
          }}
          listingCount={asks.length}
          priceChart={
            <CollectionDualPriceChart
              variant="exchange"
              platformUsd={displayPlatformUsd}
              externalMarketUsd={
                chartExternalRollingUsd.length >= 2 ? null : resolvedExternal.usd
              }
              externalWindowDays={chartExternalWindowDays}
              externalRollingUsd={
                chartExternalRollingUsd.length > 0 ? chartExternalRollingUsd : null
              }
              externalRollingKind={chartExternalRollingKind}
              externalLegendLabel={chartExternalLegend}
              externalSeriesShortLabel={chartExternalShort}
              externalRefLineTag={chartExternalRefTag}
              isLoading={
                platformTradesLoading || nmHistoryLoading || marketSeriesLoading
              }
              errorMessage={null}
            />
          }
          orderBookNextToChart={
            <CollectionUnifiedOrderBook
              collectionKey={collection.collectionKey}
              asks={asks}
              collectionBids={collectionBids}
              onSelectLevel={(sel) => setBookSelection(sel)}
              selectedLevelKey={bookSelection?.levelKey ?? null}
              compact
              lastTradePriceUsdc={orderBookLastSaleUsdc}
              lastTradeSide="buy"
              tapeFills={platformTradesData?.trades ?? []}
              tapeLoading={platformTradesLoading}
            />
          }
          tradePanel={
            <CollectionTradingTabs
              bookSelection={bookSelection}
              address={address as Address | undefined}
              onBuySuccess={() => {
                setSellModalOpen(false);
                setTradeCelebration("purchase");
                void invalidateCollection();
              }}
              onOpenSellModal={() => setSellModalOpen(true)}
              collectionKey={collection.collectionKey}
              collectionLabel={collection.displayLabel}
              asks={asks}
              collectionBids={collectionBids}
              connectedAddress={address ?? undefined}
              onInvalidate={invalidateCollection}
              onInstantBuyFillUsdc={(usdc) =>
                setSessionFillPoint({ t: Math.floor(Date.now() / 1000), v: usdc })
              }
              onPurchaseFilled={() => {
                setSellModalOpen(false);
                setTradeCelebration("purchase");
              }}
              presetPriceFromBook={presetPriceFromBook}
              listingCount={asks.length}
            />
          }
        />

        <section className="mt-8 max-w-3xl" aria-label="PokeTrace reference">
          <h3 className="text-sm font-semibold text-zinc-400 mb-2">
            PokeTrace NM detail
          </h3>
          <p className="text-[11px] text-zinc-600 mb-3 leading-relaxed">
            eBay / TCGPlayer Near Mint bands and metadata for the matched catalog card. The strip
            and chart use this (and JustTCG when needed) as the external market path — not listing
            pool medians.
          </p>
          <CollectionPoketracePanel
            data={poketracePreview}
            isLoading={poketraceLoading}
            error={
              poketraceQueryErr instanceof Error
                ? poketraceQueryErr
                : poketraceQueryError
                  ? new Error("Failed to load PokeTrace reference")
                  : null
            }
          />
        </section>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/[0.06] px-3 py-1 font-medium text-rose-200/90 tabular-nums">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400/90" aria-hidden />
            {asks.length} listing{asks.length === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1 font-medium text-emerald-200/90 tabular-nums">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" aria-hidden />
            {criteriaBidCount} collection bid{criteriaBidCount === 1 ? "" : "s"}
          </span>
        </div>

        <section
          className="mb-10 mt-12 border-t border-gray-800/80 pt-10"
          id="collection-listings"
          aria-label="Individual listings"
        >
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-white tracking-tight">Individual listings</h2>
            <p className="text-xs text-gray-500 mt-1">
              Each listed token ({tokenIds.length}) — trade from the chart / book / right panel, or
              open a card for details.
            </p>
          </div>

          {tokenIds.length === 0 ? (
            <div className="rounded-2xl border border-gray-800 bg-gray-900/30 px-4 py-8 text-center text-sm text-gray-400">
              No listings yet. List an asset from{" "}
              <Link href="/portfolio" className="text-mint hover:underline">
                My Assets
              </Link>
              .
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2 pt-1 snap-x scrollbar-platform">
              {tokenIds.map((tid) => (
                <div
                  key={tid}
                  className="w-[min(100%,240px)] shrink-0 snap-start sm:w-[220px]"
                >
                  <CollectionRwaCard
                    tokenId={tid}
                    collectionKey={key}
                    listing={askMap.get(tid) ?? null}
                    collectionBidCount={criteriaBidCount}
                    address={address}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="mt-10 border-t border-gray-800/80 pt-8">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold text-gray-300 hover:text-white py-2"
          >
            <span>Advanced: trading guide</span>
            <span className="text-gray-500 tabular-nums">{showAdvanced ? "−" : "+"}</span>
          </button>

          {showAdvanced && (
            <div className="mt-4">
              <CollectionTradeGuide />
            </div>
          )}
        </div>
      </div>

      <TradeCelebrationModal
        open={tradeCelebration != null}
        kind={tradeCelebration ?? "purchase"}
        onClose={() => setTradeCelebration(null)}
      />

      <CollectionOwnedRwaListModal
        open={sellModalOpen}
        onClose={() => setSellModalOpen(false)}
        collectionKey={collection.collectionKey}
        collectionLabel={collection.displayLabel}
        collectionBids={collectionBids}
        listPricePresetUsdc={listPricePresetUsdc}
        preferredBidOrderHash={preferredBidOrderHash}
        onSaleCelebration={() => setTradeCelebration("sale")}
      />
    </div>
  );
}
