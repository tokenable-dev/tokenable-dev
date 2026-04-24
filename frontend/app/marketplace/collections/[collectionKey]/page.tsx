"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import type { Address } from "viem";
import { formatUnits } from "viem";
import {
  getCollectionMarketSeries,
  getCollectionMarketStats,
  getCollectionPoketracePriceHistory,
  getCollectionPoketracePreview,
  getCollectionPlatformTrades,
  getMarketplaceCollectionDetail,
  type Order,
} from "@/lib/api";
import {
  coefficientOfVariationPctFromUsdSeries,
  percentChangeFromUsdPoints,
  resolveExternalMarketUsd,
} from "@/lib/externalMarketPrice";
import { inferSportBucketFromHaystack } from "@/lib/collectionCategoryFilter";
import {
  poketraceHistoryTierFromComponents,
  poketraceTierDisplayLabel,
} from "@/lib/poketraceHistoryTier";
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
import {
  CHART_EXTERNAL_HISTORY,
  CHART_EXTERNAL_HISTORY_DAYS,
} from "@/components/marketplace/chartTimeRange";
import { CollectionRwaCard } from "@/components/marketplace/CollectionRwaCard";
import { useAppStore, selectWallet } from "@/store";
import { isCriteriaCollectionBid } from "@/lib/seaport/criteriaMatch";
import {
  computeCollectionMarketCapUsd,
  formatMarketCapUsd,
  parseGradeScoreNumber,
} from "@/lib/gradedCardMarketCap";

/** Same fill can appear from session overlay + DB poll with timestamps minutes apart */
const SESSION_FILL_DEDUP_SEC = 300;

function seeded01FromKey(key: string): number {
  if (!key) return 0.5;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

function buildSyntheticSportsHistory(
  _spotUsd: number,
  collectionKey: string,
  _days: number,
): { t: number; v: number }[] {
  const out: { t: number; v: number }[] = [];
  const now = Math.floor(Date.now() / 1000);
  const n = 365; // demo: fixed 1Y history
  const seed = seeded01FromKey(collectionKey);
  const waveAmp = 0.008 + seed * 0.014; // subtle daily wiggle
  const startUsd = 900;
  const endUsd = 1500;
  const spanUsd = endUsd - startUsd;
  for (let i = 0; i < n; i++) {
    const age = n - 1 - i;
    const t = now - age * 86400;
    const progress = i / Math.max(1, n - 1);
    const phase = progress * Math.PI * 6;
    const cyc = Math.sin(phase + seed * Math.PI * 2) * waveAmp;
    const base = startUsd + spanUsd * progress;
    const v = Math.max(1, base * (1 + cyc));
    out.push({ t, v: Math.round(v * 100) / 100 });
  }
  return out;
}

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
  const [showAiInsights, setShowAiInsights] = useState(false);
  const [aiInsightStatus, setAiInsightStatus] = useState<"idle" | "loading" | "ready">("idle");
  const [aiInsightResult, setAiInsightResult] = useState<{
    title: string;
    summary: string;
    bullets: string[];
    generatedAt: string;
  } | null>(null);
  const aiTimerRef = useRef<number | null>(null);
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

  const pokeHistoryTier = useMemo(
    () => poketraceHistoryTierFromComponents(comp as Record<string, unknown>),
    [comp],
  );

  const { data: poketracePreview, isLoading: poketraceLoading } = useQuery({
    queryKey: ["collection-poketrace", key],
    queryFn: () => getCollectionPoketracePreview(key),
    enabled: key.length > 0 && !isLoading && !isError && !!data,
  });

  const { data: marketSeriesHeader, isLoading: marketSeriesLoading } = useQuery({
    queryKey: ["collection-market-series", key, CHART_EXTERNAL_HISTORY],
    queryFn: () => getCollectionMarketSeries(key, CHART_EXTERNAL_HISTORY),
    enabled: key.length > 0 && !isLoading && !isError && !!data,
    staleTime: 120_000,
  });

  const { data: nmHistory, isLoading: nmHistoryLoading } = useQuery({
    queryKey: [
      "collection-poketrace-price-history",
      key,
      pokeHistoryTier,
      CHART_EXTERNAL_HISTORY,
      CHART_EXTERNAL_HISTORY_DAYS,
    ],
    queryFn: () =>
      getCollectionPoketracePriceHistory(key, {
        tier: pokeHistoryTier,
        period: CHART_EXTERNAL_HISTORY,
        maxDays: CHART_EXTERNAL_HISTORY_DAYS,
      }),
    enabled: key.length > 0 && !isLoading && !isError && !!data,
  });

  const { data: pokeYearHistory, isLoading: pokeYearHistoryLoading } = useQuery({
    queryKey: [
      "collection-poketrace-price-history",
      key,
      pokeHistoryTier,
      "1y",
      365,
    ],
    queryFn: () =>
      getCollectionPoketracePriceHistory(key, {
        tier: pokeHistoryTier,
        period: "1y",
        maxDays: 365,
      }),
    enabled: key.length > 0 && !isLoading && !isError && !!data,
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
  const pokeYearPts = pokeYearHistory?.points ?? [];
  const pokeYearOk = pokeYearPts.length >= 2;
  const jtHistPts = marketSeriesHeader?.externalUsd ?? [];
  const jtHistOk = jtHistPts.length >= 2;

  const chartExternalRollingUsd = useMemo(() => {
    if (pokeHistOk) return pokeHistPts;
    if (jtHistOk) return jtHistPts;
    return [];
  }, [pokeHistOk, pokeHistPts, jtHistOk, jtHistPts]);

  const collectionSportBucket = useMemo(() => {
    const hay = [
      data?.collection?.displayLabel,
      data?.collection?.queryUsed,
      comp.cardName,
      comp.cardSet,
      comp.cardNumber,
    ]
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .join(" ")
      .toLowerCase();
    return inferSportBucketFromHaystack(hay);
  }, [data?.collection?.displayLabel, data?.collection?.queryUsed, comp.cardName, comp.cardSet, comp.cardNumber]);

  const chartExternalWindowDays = useMemo(() => {
    if (pokeHistOk) return nmHistory?.days ?? CHART_EXTERNAL_HISTORY_DAYS;
    /** Bundle `externalUsd` is fetched for up to `marketChangeWindow`; fixed x-axis avoids clipping vs platform-only smart domain. */
    if (jtHistOk) {
      const w = marketSeriesHeader?.marketChangeWindow;
      if (w === "7d") return 7;
      if (w === "30d") return 30;
      if (w === "90d") return 90;
      if (w === "180d") return 180;
      if (w === "365d") return 365;
      return CHART_EXTERNAL_HISTORY_DAYS;
    }
    if (
      (collectionSportBucket === "nba" ||
        collectionSportBucket === "mlb" ||
        collectionSportBucket === "nfl") &&
      !pokeHistOk &&
      !jtHistOk
    ) {
      // Sports fallback chart is synthetic 1Y history; lock x-axis to 365d.
      return 365;
    }
    return null;
  }, [
    pokeHistOk,
    nmHistory?.days,
    jtHistOk,
    marketSeriesHeader?.marketChangeWindow,
    collectionSportBucket,
  ]);

  const externalVolatilityCvPct = useMemo(() => {
    const y = coefficientOfVariationPctFromUsdSeries(pokeYearPts);
    if (y != null) return y;
    return pokeHistOk ? coefficientOfVariationPctFromUsdSeries(pokeHistPts) : null;
  }, [pokeHistOk, pokeHistPts, pokeYearPts]);

  const nmHistApprox = nmHistory?.matchConfidence === "approximate";
  const pokeTierLabel = poketraceTierDisplayLabel(pokeHistoryTier);

  const externalPriceChange1yPct = useMemo(
    () => (pokeYearOk ? percentChangeFromUsdPoints(pokeYearPts) : null),
    [pokeYearOk, pokeYearPts],
  );

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

  const sportsFallbackSpotUsd = useMemo(() => {
    if (
      !(
        collectionSportBucket === "nba" ||
        collectionSportBucket === "mlb" ||
        collectionSportBucket === "nfl"
      )
    ) {
      return null;
    }
    const floor = marketStats?.floor;
    const median = marketStats?.median;
    if (floor != null && Number.isFinite(floor) && floor > 0) return floor;
    if (median != null && Number.isFinite(median) && median > 0) return median;
    const lastTrade =
      platformPtsBase.length > 0 ? platformPtsBase[platformPtsBase.length - 1]?.v : null;
    if (lastTrade != null && Number.isFinite(lastTrade) && lastTrade > 0) return lastTrade;
    const seed = seeded01FromKey(key);
    const base =
      collectionSportBucket === "nba" ? 220 : collectionSportBucket === "nfl" ? 190 : 170;
    const span =
      collectionSportBucket === "nba" ? 520 : collectionSportBucket === "nfl" ? 470 : 420;
    return Math.round(base + span * seed);
  }, [collectionSportBucket, marketStats?.floor, marketStats?.median, platformPtsBase, key]);

  const sportsFallbackSeries = useMemo(() => {
    if (sportsFallbackSpotUsd == null) return [];
    return buildSyntheticSportsHistory(sportsFallbackSpotUsd, key, CHART_EXTERNAL_HISTORY_DAYS);
  }, [sportsFallbackSpotUsd, key]);

  const useSportsFallback = useMemo(
    () =>
      (collectionSportBucket === "nba" ||
        collectionSportBucket === "mlb" ||
        collectionSportBucket === "nfl") &&
      !pokeHistOk &&
      !jtHistOk &&
      sportsFallbackSeries.length >= 2,
    [collectionSportBucket, pokeHistOk, jtHistOk, sportsFallbackSeries.length],
  );

  const effectiveExternalRollingUsd = useMemo(
    () =>
      chartExternalRollingUsd.length > 0
        ? chartExternalRollingUsd
        : useSportsFallback
          ? sportsFallbackSeries
          : [],
    [chartExternalRollingUsd, useSportsFallback, sportsFallbackSeries],
  );

  const chartExternalLegend = pokeHistOk
    ? nmHistApprox
      ? `PokéTrace ${pokeTierLabel} (daily · approximate match)`
      : `PokéTrace ${pokeTierLabel} (daily)`
    : jtHistOk
      ? `PokéTrace ${pokeTierLabel} (bundle series)`
      : useSportsFallback
        ? "Sports estimate (demo synthetic series)"
      : `External market (${pokeTierLabel})`;

  const chartExternalShort = pokeHistOk
    ? nmHistApprox
      ? `PokéTrace ${pokeTierLabel} ~`
      : `PokéTrace ${pokeTierLabel}`
    : jtHistOk
      ? `PokéTrace ${pokeTierLabel}`
      : useSportsFallback
        ? "Sports estimate"
      : `PokéTrace ${pokeTierLabel}`;

  const chartExternalRollingKind =
    pokeHistOk || jtHistOk || useSportsFallback ? "history" : "snapshot";

  const platformPriceSamples = useMemo(
    () => displayPlatformUsd.map((p) => p.v),
    [displayPlatformUsd]
  );

  const orderBookTapeFills = useMemo(() => {
    const raw = platformTradesData?.trades ?? [];
    if (raw.length > 0) return raw;
    if (displayPlatformUsd.length === 0) return [];
    return [...displayPlatformUsd]
      .sort((a, b) => b.t - a.t)
      .slice(0, 80)
      .map((p, i) => ({
        t: p.t,
        priceUsdc: p.v,
        tokenId: "—",
        orderHash: `synthetic-${p.t}-${i}`,
        tapeAggressor: "buy" as const,
      }));
  }, [platformTradesData?.trades, displayPlatformUsd]);

  const volatilityFootnote = useMemo(() => {
    const yPos = pokeYearPts.filter((p) => p.v > 0).length;
    if (yPos >= 3) return "~1y PokéTrace tier daily closes";
    const sPos = pokeHistPts.filter((p) => p.v > 0).length;
    if (sPos >= 3) return "PokéTrace chart-window tier daily closes";
    return null;
  }, [pokeYearPts, pokeHistPts]);

  function invalidateCollection() {
    void queryClient.invalidateQueries({ queryKey: ["marketplace-collection", key] });
    void queryClient.invalidateQueries({ queryKey: ["collection-platform-trades", key] });
    void queryClient.invalidateQueries({
      queryKey: ["collection-market-series", key, CHART_EXTERNAL_HISTORY],
    });
    void queryClient.invalidateQueries({ queryKey: ["collection-market-stats", key] });
    void queryClient.invalidateQueries({ queryKey: ["collection-poketrace", key] });
    void queryClient.invalidateQueries({
      queryKey: ["collection-poketrace-price-history", key],
    });
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

  const askMap = useMemo(() => bestAskByToken(asks), [asks]);
  const tokenIds = useMemo(
    () => (data ? sortedTokenIdsByOldestListing(asks) : []),
    [data, asks],
  );

  const resolvedExternal = useMemo(
    () =>
      resolveExternalMarketUsd({
        poketracePreview,
        gradePrices: marketSeriesHeader?.gradePrices ?? null,
        gradeScore: parseGradeScoreNumber(comp.gradeScore),
        components: comp as Record<string, unknown>,
      }),
    [
      poketracePreview,
      marketSeriesHeader?.gradePrices,
      comp.gradeScore,
      comp,
    ],
  );

  const resolvedExternalForDisplay = useMemo(() => {
    if (resolvedExternal.usd != null) return resolvedExternal;
    if (useSportsFallback && sportsFallbackSpotUsd != null) {
      return {
        usd: sportsFallbackSpotUsd,
        source: null,
        poketraceMatchConfidence: undefined,
      };
    }
    return resolvedExternal;
  }, [resolvedExternal, useSportsFallback, sportsFallbackSpotUsd]);

  const chartExternalRefTag =
    resolvedExternalForDisplay.source === "poketrace"
      ? resolvedExternal.poketraceMatchConfidence === "approximate"
        ? `PokéTrace ${pokeTierLabel} ~`
        : `PokéTrace ${pokeTierLabel}`
      : useSportsFallback
        ? "Sports estimate"
      : `External ${pokeTierLabel}`;

  const effectiveExternalPriceChange1yPct = useMemo(() => {
    if (externalPriceChange1yPct != null && Number.isFinite(externalPriceChange1yPct)) {
      return externalPriceChange1yPct;
    }
    return useSportsFallback ? percentChangeFromUsdPoints(sportsFallbackSeries) : null;
  }, [externalPriceChange1yPct, useSportsFallback, sportsFallbackSeries]);

  const effectiveExternalVolatilityCvPct = useMemo(() => {
    if (externalVolatilityCvPct != null && Number.isFinite(externalVolatilityCvPct)) {
      return externalVolatilityCvPct;
    }
    return useSportsFallback ? coefficientOfVariationPctFromUsdSeries(sportsFallbackSeries) : null;
  }, [externalVolatilityCvPct, useSportsFallback, sportsFallbackSeries]);

  const effectiveVolatilityFootnote = useMemo(() => {
    if (volatilityFootnote) return volatilityFootnote;
    return useSportsFallback ? "Demo synthetic sports series (prototype fallback)" : null;
  }, [volatilityFootnote, useSportsFallback]);

  const marketCapComputation = useMemo(
    () =>
      data?.collection
        ? computeCollectionMarketCapUsd({
            components: data.collection.components as Record<string, unknown>,
            gradeScoreStr: comp.gradeScore,
            poketraceCard: poketracePreview?.card ?? null,
            poketraceMatchConfidence: poketracePreview?.matchConfidence,
            gradePrices: marketSeriesHeader?.gradePrices ?? null,
            poketracePreview: poketracePreview ?? null,
          })
        : null,
    [
      data?.collection,
      comp.gradeScore,
      poketracePreview,
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
    if (
      comp.psaTotalPopulation != null &&
      Number.isFinite(comp.psaTotalPopulation) &&
      comp.psaTotalPopulation > 0
    ) {
      rows.push({
        label: "PSA Population",
        value: Number(comp.psaTotalPopulation).toLocaleString("en-US"),
      });
    }
    return rows;
  }, [comp]);

  const subtitle = useMemo(() => {
    const parts = [comp.cardSet, comp.cardNumber].filter(
      (x): x is string => typeof x === "string" && x.trim().length > 0
    );
    return parts.length ? parts.join(" · ") : null;
  }, [comp.cardSet, comp.cardNumber]);

  const aiInsightLines = useMemo(() => {
    const displayName = data?.collection?.displayLabel ?? "this collection";
    const floor = marketStats?.floor;
    const median = marketStats?.median;
    const listingCount = asks.length;
    const trendPct = effectiveExternalPriceChange1yPct;
    const trendText =
      trendPct != null && Number.isFinite(trendPct)
        ? `${trendPct >= 0 ? "+" : ""}${trendPct.toFixed(1)}% over the past year`
        : "mixed over the recent history window";

    return [
      `The ${displayName} market is currently showing healthy two-sided activity around live asks and collection bids.`,
      `Current order book snapshot indicates ${listingCount} active listing${listingCount === 1 ? "" : "s"} with floor near ${floor != null && Number.isFinite(floor) ? `$${floor.toFixed(2)}` : "N/A"} and median around ${median != null && Number.isFinite(median) ? `$${median.toFixed(2)}` : "N/A"}.`,
      `External reference momentum appears ${trendText}.`,
      "Prototype note: this AI insight card currently uses mock-generated text and is not calling a live LLM endpoint yet.",
    ];
  }, [
    asks.length,
    data?.collection?.displayLabel,
    effectiveExternalPriceChange1yPct,
    marketStats?.floor,
    marketStats?.median,
  ]);

  const runMockAiInsights = () => {
    if (aiTimerRef.current != null) {
      window.clearTimeout(aiTimerRef.current);
      aiTimerRef.current = null;
    }
    setShowAiInsights(true);
    setAiInsightStatus("loading");

    const floor = marketStats?.floor;
    const median = marketStats?.median;
    const spread = marketMetrics.spreadPct;
    const trendPct = effectiveExternalPriceChange1yPct;
    const listingCount = asks.length;
    const title = data?.collection?.displayLabel ?? "Collection";
    const nowIso = new Date().toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const trendText =
      trendPct != null && Number.isFinite(trendPct)
        ? `${trendPct >= 0 ? "+" : ""}${trendPct.toFixed(1)}% 1Y trend`
        : "mixed long-window trend";
    const spreadText =
      spread != null && Number.isFinite(spread)
        ? `${spread >= 0 ? "+" : ""}${spread.toFixed(1)}% spread`
        : "spread not stable";

    const delayMs = 900 + Math.floor(Math.random() * 600);
    aiTimerRef.current = window.setTimeout(() => {
      setAiInsightResult({
        title: `${title} — AI Market Brief`,
        summary: `Model review suggests this collection is currently in a ${listingCount > 6 ? "high-liquidity" : "thin-liquidity"} phase with ${trendText}.`,
        bullets: [
          `Order book snapshot: ${listingCount} active listings, floor ${floor != null && Number.isFinite(floor) ? `$${floor.toFixed(2)}` : "N/A"}, median ${median != null && Number.isFinite(median) ? `$${median.toFixed(2)}` : "N/A"}.`,
          `Execution quality signal: ${spreadText}; tighter spreads usually imply faster fills near quoted levels.`,
          "Prototype mode: insight text is mock-generated to simulate live AI analysis for demo purposes.",
        ],
        generatedAt: nowIso,
      });
      setAiInsightStatus("ready");
      aiTimerRef.current = null;
    }, delayMs);
  };

  useEffect(() => {
    return () => {
      if (aiTimerRef.current != null) {
        window.clearTimeout(aiTimerRef.current);
      }
    };
  }, []);

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
              externalMarketUsd={resolvedExternalForDisplay.usd}
              externalPriceSource={resolvedExternalForDisplay.source}
              poketraceTierDisplay={pokeTierLabel}
              externalPoketraceMatchConfidence={resolvedExternal.poketraceMatchConfidence}
              externalPriceLoading={
                poketraceLoading || nmHistoryLoading || marketSeriesLoading
              }
              externalVolatilityCvPct={effectiveExternalVolatilityCvPct}
              volatilityFootnote={effectiveVolatilityFootnote}
              marketStats={marketStats ?? null}
              marketStatsLoading={marketStatsLoading}
              platformPriceSamples={platformPriceSamples}
              bookSpreadPct={marketMetrics.spreadPct}
              externalPriceChange1yPct={effectiveExternalPriceChange1yPct}
              externalPriceChange1yLoading={useSportsFallback ? false : pokeYearHistoryLoading}
              marketCapUsd={marketCapComputation?.usd ?? null}
              marketCapMethodHint={marketCapComputation?.methodLabel ?? null}
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
              chartTitle=""
              platformUsd={displayPlatformUsd}
              externalMarketUsd={
                effectiveExternalRollingUsd.length >= 2 ? null : resolvedExternalForDisplay.usd
              }
              externalWindowDays={chartExternalWindowDays}
              externalRollingUsd={
                effectiveExternalRollingUsd.length > 0 ? effectiveExternalRollingUsd : null
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
              tapeFills={orderBookTapeFills}
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

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/[0.06] px-3 py-1 font-medium text-rose-200/90 tabular-nums">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400/90" aria-hidden />
            {asks.length} listing{asks.length === 1 ? "" : "s"}
          </span>
        </div>

        <section className="mt-6 max-w-5xl" aria-label="AI insights">
          <button
            type="button"
            onClick={runMockAiInsights}
            className="inline-flex min-w-[190px] items-center justify-center rounded-lg border border-[#0fd4bd]/70 bg-[#0a302b]/45 px-4 py-2 text-sm font-semibold text-[#2de8d2] transition-colors hover:bg-[#0b3e37]/70"
          >
            {aiInsightStatus === "loading" ? "Generating insight..." : "AI Insights"}
          </button>
          {showAiInsights && aiInsightStatus === "loading" ? (
            <div className="mt-4 rounded-2xl border border-[#0fd4bd]/50 bg-[#060f12]/95 px-6 py-5 text-sm text-zinc-100 shadow-[0_0_0_1px_rgba(16,185,129,0.08),0_0_26px_rgba(20,184,166,0.16)]">
              <p className="mb-2 text-[13px] font-semibold tracking-wide text-[#45f2dc]">
                AI Insights
              </p>
              <p className="text-zinc-300">
                Scanning collection liquidity, recent fills, and external trend signals...
              </p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-[#20e4cf]" />
              </div>
            </div>
          ) : null}
          {showAiInsights && aiInsightStatus !== "loading" ? (
            <div className="mt-4 rounded-2xl border border-[#0fd4bd]/55 bg-[#060f12]/95 px-6 py-5 text-sm leading-relaxed text-zinc-100 shadow-[0_0_0_1px_rgba(16,185,129,0.08),0_0_26px_rgba(20,184,166,0.16)]">
              <p className="mb-2 text-[13px] font-semibold tracking-wide text-[#45f2dc]">
                AI Insights
              </p>
              {aiInsightStatus === "ready" && aiInsightResult ? (
                <>
                  <p className="mb-2 text-zinc-100">{aiInsightResult.summary}</p>
                  <ul className="list-disc space-y-1.5 pl-5 text-zinc-200">
                    {aiInsightResult.bullets.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[11px] text-zinc-500">
                    Updated {aiInsightResult.generatedAt}
                  </p>
                </>
              ) : (
                <ul className="list-disc space-y-1.5 pl-5 text-zinc-200">
                  {aiInsightLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </section>

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
