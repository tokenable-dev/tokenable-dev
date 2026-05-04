"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import type { Address } from "viem";
import { formatUnits } from "viem";
import {
  getCollectionMarketSeries,
  getCollectionMarketStats,
  getCollectionMarketPriceHistory,
  getCollectionMarketPreview,
  getCollectionPlatformTrades,
  getCollectionAiInsight,
  getMarketplaceCollectionDetail,
  type Order,
} from "@/lib/core";
import {
  coefficientOfVariationPctFromUsdSeries,
  computeCollectionMarketCapUsd,
  formatMarketCapUsd,
  marketHistoryTierFromComponents,
  marketTierDisplayLabel,
  parseGradeScoreNumber,
  percentChangeFromUsdPoints,
  resolveExternalMarketUsd,
} from "@/lib/market";
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
import { useAppStore, selectWallet } from "@/store";
import { isCriteriaCollectionBid } from "@/lib/seaport/criteria/criteriaMatch";
import {
  bucketCardNameForDisplay,
  bucketCardSetForDisplay,
  bucketGradingCompanyForDisplay,
} from "@/lib/marketplace/bucketKey";

/** Same fill can appear from session overlay + DB poll with timestamps minutes apart */
const SESSION_FILL_DEDUP_SEC = 300;

type ChartRangeId = "7d" | "30d" | "90d" | "180d" | "1y";
type ChartRangeConfig = {
  id: ChartRangeId;
  label: string;
  historyPeriod: "7d" | "30d" | "90d" | "1y";
  maxDays: number;
  bundleDuration: "7d" | "30d" | "90d" | "180d" | "365d";
};
const CHART_RANGE_OPTIONS: readonly ChartRangeConfig[] = [
  { id: "7d", label: "7D", historyPeriod: "7d", maxDays: 7, bundleDuration: "7d" },
  { id: "30d", label: "30D", historyPeriod: "30d", maxDays: 30, bundleDuration: "30d" },
  { id: "90d", label: "90D", historyPeriod: "90d", maxDays: 90, bundleDuration: "90d" },
  { id: "180d", label: "180D", historyPeriod: "1y", maxDays: 180, bundleDuration: "180d" },
  { id: "1y", label: "1Y", historyPeriod: "1y", maxDays: 365, bundleDuration: "365d" },
] as const;

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

function buildMiniChartPath(points: number[], w: number, h: number): string {
  if (!Array.isArray(points) || points.length < 2) return "";
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(max - min, 1);
  return points
    .map((v, i) => {
      const x = (i / Math.max(1, points.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
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
  const [chartRange, setChartRange] = useState<ChartRangeId>("90d");
  const [showAiInsights, setShowAiInsights] = useState(false);
  const [aiInsightStatus, setAiInsightStatus] = useState<"idle" | "loading" | "ready">("idle");
  const [aiRevealStep, setAiRevealStep] = useState(0);
  const [aiInsightResult, setAiInsightResult] = useState<{
    title: string;
    summary: string;
    bullets: string[];
    dynamics?: string[];
    syntheticChart?: string;
    chartSpec?: {
      chartStyle: string;
      trendStructure: string[];
      momentumBehavior: string;
      visualInterpretation: string;
      miniSeries: number[];
      pathRepresentation: string;
    };
    outlook?: string;
    outlookScenarios?: {
      bullCase: string;
      baseCase: string;
      bearCase: string;
    };
    uiInstructions?: {
      loading: {
        style: string;
        scanningEffect: string;
        minDurationMs: number;
        maxDurationMs: number;
      };
      progressiveRenderOrder: string[];
    };
    generatedAt: string;
    confidence?: number | null;
    cardId?: string | null;
    marketTone?:
      | "Bullish"
      | "Cooling"
      | "Consolidating"
      | "Overextended"
      | "Accumulating"
      | "Volatile"
      | null;
    riskScore?: number | null;
    riskLabel?: "Low" | "Medium" | "High" | null;
    stats?: {
      psa10SpotUsd: number | null;
      rawSpotUsd: number | null;
      premiumVsRawPct: number | null;
      sales7d: number | null;
      sales30d: number | null;
      change7dPct: number | null;
      change30dPct: number | null;
      change90dPct: number | null;
      change365dPct: number | null;
      points90d: number;
      points365d: number;
    };
  } | null>(null);
  /** Matches Tailwind `md` (769px+) — viewport ≤767px treats as mobile for AI auto-trigger. */
  const [narrowViewport, setNarrowViewport] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false,
  );
  const aiInsightSectionRef = useRef<HTMLElement>(null);
  const aiInsightAutoStartedRef = useRef(false);
  const aiInsightInFlightRef = useRef(false);

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

  useEffect(() => {
    aiInsightAutoStartedRef.current = false;
    setShowAiInsights(false);
    setAiInsightStatus("idle");
    setAiRevealStep(0);
    setAiInsightResult(null);
  }, [key]);

  useEffect(() => {
    const mq =
      typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)") : null;
    if (!mq) return;
    const sync = () => setNarrowViewport(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const comp = useMemo(() => {
    const raw = data?.collection?.components as
      | {
          cardName?: string;
          cardNameDisplay?: string;
          gradingCompany?: string;
          gradingCompanyDisplay?: string;
          gradeScore?: string;
          cardSet?: string;
          cardSetDisplay?: string;
          cardNumber?: string;
          variant?: string;
          psaTotalPopulation?: number;
        }
      | undefined;
    return raw ?? {};
  }, [data?.collection?.components]);

  const pokeHistoryTier = useMemo(
    () => marketHistoryTierFromComponents(comp as Record<string, unknown>),
    [comp],
  );

  const selectedChartRange = useMemo(
    () => CHART_RANGE_OPTIONS.find((x) => x.id === chartRange) ?? CHART_RANGE_OPTIONS[2],
    [chartRange],
  );

  const { data: marketPreview, isLoading: marketPreviewLoading } = useQuery({
    queryKey: ["collection-market", key],
    queryFn: () => getCollectionMarketPreview(key),
    enabled: key.length > 0 && !isLoading && !isError && !!data,
  });

  const { data: marketSeriesHeader, isLoading: marketSeriesLoading } = useQuery({
    queryKey: ["collection-market-series", key, selectedChartRange.bundleDuration],
    queryFn: () => getCollectionMarketSeries(key, selectedChartRange.bundleDuration),
    enabled: key.length > 0 && !isLoading && !isError && !!data,
    staleTime: 120_000,
  });

  const { data: nmHistory, isLoading: nmHistoryLoading } = useQuery({
    queryKey: [
      "collection-market-price-history",
      key,
      pokeHistoryTier,
      selectedChartRange.historyPeriod,
      selectedChartRange.maxDays,
    ],
    queryFn: () =>
      getCollectionMarketPriceHistory(key, {
        tier: pokeHistoryTier,
        period: selectedChartRange.historyPeriod,
        maxDays: selectedChartRange.maxDays,
      }),
    enabled: key.length > 0 && !isLoading && !isError && !!data,
    placeholderData: keepPreviousData,
  });

  const { data: pokeYearHistory, isLoading: pokeYearHistoryLoading } = useQuery({
    queryKey: [
      "collection-market-price-history",
      key,
      pokeHistoryTier,
      "1y",
      365,
    ],
    queryFn: () =>
      getCollectionMarketPriceHistory(key, {
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

  const pokeHistorySpanDays = useMemo(() => {
    if (!pokeHistOk || pokeHistPts.length < 2) return null;
    const ts = pokeHistPts.map((p) => p.t).filter((t) => Number.isFinite(t));
    if (ts.length < 2) return null;
    return Math.ceil((Math.max(...ts) - Math.min(...ts)) / 86400) + 2;
  }, [pokeHistOk, pokeHistPts]);

  const chartExternalWindowDays = useMemo(() => {
    if (pokeHistOk) {
      const nominal = nmHistory?.days ?? selectedChartRange.maxDays;
      const span = pokeHistorySpanDays;
      const merged = Math.max(span ?? nominal, nominal, 7);
      return Math.min(4200, merged);
    }
    /** Bundle `externalUsd` is fetched for up to `marketChangeWindow`; fixed x-axis avoids clipping vs platform-only smart domain. */
    if (jtHistOk) {
      const w = marketSeriesHeader?.marketChangeWindow;
      if (w === "7d") return 7;
      if (w === "30d") return 30;
      if (w === "90d") return 90;
      if (w === "180d") return 180;
      if (w === "365d") return 365;
      return selectedChartRange.maxDays;
    }
    return null;
  }, [
    pokeHistOk,
    nmHistory?.days,
    pokeHistorySpanDays,
    jtHistOk,
    marketSeriesHeader?.marketChangeWindow,
    selectedChartRange.maxDays,
  ]);

  const externalVolatilityCvPct = useMemo(() => {
    const y = coefficientOfVariationPctFromUsdSeries(pokeYearPts);
    if (y != null) return y;
    return pokeHistOk ? coefficientOfVariationPctFromUsdSeries(pokeHistPts) : null;
  }, [pokeHistOk, pokeHistPts, pokeYearPts]);

  const nmHistApprox = nmHistory?.matchConfidence === "approximate";
  const pokeTierLabel = marketTierDisplayLabel(pokeHistoryTier);

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

  const liveMarketLegend = "Live market price";
  const liveMarketLegendApprox = "Live market price (approximate match)";

  const chartExternalLegend = pokeHistOk
    ? nmHistApprox
      ? liveMarketLegendApprox
      : liveMarketLegend
    : jtHistOk
      ? liveMarketLegend
      : `External market (${pokeTierLabel})`;

  const chartExternalShort = pokeHistOk
    ? nmHistApprox
      ? liveMarketLegendApprox
      : liveMarketLegend
    : jtHistOk
      ? liveMarketLegend
      : liveMarketLegend;

  const chartExternalRollingKind = pokeHistOk || jtHistOk ? "history" : "snapshot";

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
    if (yPos >= 3) return "~1y Cardhedger tier daily closes";
    const sPos = pokeHistPts.filter((p) => p.v > 0).length;
    if (sPos >= 3) return "Cardhedger chart-window tier daily closes";
    return null;
  }, [pokeYearPts, pokeHistPts]);

  function invalidateCollection() {
    void queryClient.invalidateQueries({ queryKey: ["marketplace-collection", key] });
    void queryClient.invalidateQueries({ queryKey: ["collection-platform-trades", key] });
    void queryClient.invalidateQueries({
      queryKey: ["collection-market-series", key, selectedChartRange.bundleDuration],
    });
    void queryClient.invalidateQueries({ queryKey: ["collection-market-stats", key] });
    void queryClient.invalidateQueries({ queryKey: ["collection-market", key] });
    void queryClient.invalidateQueries({
      queryKey: ["collection-market-price-history", key],
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
        marketPreview,
        gradePrices: marketSeriesHeader?.gradePrices ?? null,
        gradeScore: parseGradeScoreNumber(comp.gradeScore),
        components: comp as Record<string, unknown>,
      }),
    [
      marketPreview,
      marketSeriesHeader?.gradePrices,
      comp.gradeScore,
      comp,
    ],
  );

  const chartExternalRefTag =
    resolvedExternal.source === "cardhedger"
      ? resolvedExternal.marketMatchConfidence === "approximate"
        ? liveMarketLegendApprox
        : liveMarketLegend
      : `External ${pokeTierLabel}`;

  const marketCapComputation = useMemo(
    () =>
      data?.collection
        ? computeCollectionMarketCapUsd({
            components: data.collection.components as Record<string, unknown>,
            gradeScoreStr: comp.gradeScore,
            marketCard: marketPreview?.card ?? null,
            marketMatchConfidence: marketPreview?.matchConfidence,
            gradePrices: marketSeriesHeader?.gradePrices ?? null,
            marketPreview: marketPreview ?? null,
          })
        : null,
    [
      data?.collection,
      comp.gradeScore,
      marketPreview,
      marketSeriesHeader?.gradePrices,
    ],
  );

  const metadataRows = useMemo(() => {
    const rows: { label: string; value: string }[] = [];
    const cn = bucketCardNameForDisplay(comp as Record<string, unknown>);
    const cs = bucketCardSetForDisplay(comp as Record<string, unknown>);
    if (cn) rows.push({ label: "Card", value: cn });
    if (cs) rows.push({ label: "Set", value: cs });
    if (comp.cardNumber) rows.push({ label: "Card #", value: comp.cardNumber });
    if (comp.variant) rows.push({ label: "Variant", value: comp.variant });
    const grader = bucketGradingCompanyForDisplay(comp as Record<string, unknown>);
    if (grader) rows.push({ label: "Grader", value: grader });
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
  }, [comp, data?.collection?.components]);

  const subtitle = useMemo(() => {
    const setShown = bucketCardSetForDisplay(comp as Record<string, unknown>);
    const parts = [setShown, comp.cardNumber].filter(
      (x): x is string => typeof x === "string" && x.trim().length > 0
    );
    return parts.length ? parts.join(" · ") : null;
  }, [comp, data?.collection?.components]);

  const collectionInsightLabel =
    typeof data?.collection?.displayLabel === "string"
      ? data.collection.displayLabel
      : undefined;

  const runMockAiInsights = useCallback(async () => {
    if (!key) return;
    if (aiInsightInFlightRef.current) return;
    aiInsightInFlightRef.current = true;
    setShowAiInsights(true);
    setAiInsightStatus("loading");
    setAiRevealStep(0);
    try {
      const minLoadingMs = 800 + Math.floor(Math.random() * 700);
      const [insight] = await Promise.all([
        getCollectionAiInsight(key),
        new Promise((resolve) => setTimeout(resolve, minLoadingMs)),
      ]);
      setAiInsightResult({
        title: insight.title,
        summary: insight.summary,
        bullets: insight.bullets,
        dynamics: insight.dynamics,
        syntheticChart: insight.syntheticChart,
        chartSpec: insight.chartSpec,
        outlook: insight.outlook,
        outlookScenarios: insight.outlookScenarios,
        uiInstructions: insight.uiInstructions,
        confidence: insight.confidence,
        cardId: insight.cardId,
        marketTone: insight.marketTone,
        riskScore: insight.riskScore,
        riskLabel: insight.riskLabel,
        stats: insight.stats,
        generatedAt: new Date(insight.generatedAt).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
      setAiInsightStatus("ready");
    } catch (_e) {
      setAiInsightResult({
        title: `${collectionInsightLabel ?? "Collection"} — AI Market Brief`,
        summary:
          "Market structure is in an active interpretation phase, with momentum and liquidity context refreshing in real time.",
        bullets: [
          "Momentum is rotating through consolidation rather than breaking structure.",
          "Liquidity behavior remains the key confirmation signal for continuation.",
          "Premium dynamics continue to reflect quality-focused demand.",
        ],
        dynamics: [
          "Short-term behavior sits in a thin liquidity window with intermittent expansion attempts.",
          "Medium-term structure remains constructive as consolidation absorbs recent volatility.",
          "Longer-horizon trajectory still resembles staged trend continuation.",
          "PSA premium behavior suggests demand is skewed toward higher-grade conviction.",
        ],
        syntheticChart: "gradual upward continuation with intermittent consolidation zones",
        chartSpec: {
          chartStyle: "Expanded Macro View (Wide X-Axis)",
          trendStructure: [
            "Phase 1: Accumulation / base formation",
            "Phase 2: Expansion / breakout move",
            "Phase 3: Consolidation / cooling zone",
            "Phase 4: Current positioning",
          ],
          momentumBehavior:
            "Momentum is compressing inside consolidation and re-expanding in short bursts.",
          visualInterpretation:
            "Chart appears as a broad staircase with consolidation clusters between continuation legs.",
          miniSeries: [20, 21, 22, 23, 23, 24, 23, 24, 25, 25, 26, 27],
          pathRepresentation:
            "Low -> Base -> Expansion ↑↑ -> Consolidation -> Breakout pressure ↑",
        },
        outlook: "Base case remains constructive consolidation before the next directional expansion.",
        outlookScenarios: {
          bullCase: "Continuation strengthens if demand absorption persists through consolidation.",
          baseCase: "Market rotates sideways with constructive structure retention.",
          bearCase: "Cooling pressure extends into a controlled pullback before re-accumulation.",
        },
        uiInstructions: {
          loading: {
            style: "premium-gradient-shimmer",
            scanningEffect: "crypto-data-scan",
            minDurationMs: 800,
            maxDurationMs: 1500,
          },
          progressiveRenderOrder: [
            "AI Insight",
            "Market Structure",
            "Key Signals",
            "Synthetic Trend Chart",
            "Forward Outlook",
            "Market Tone",
          ],
        },
        confidence: null,
        cardId: null,
        marketTone: null,
        riskScore: null,
        riskLabel: null,
        generatedAt: new Date().toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
      setAiInsightStatus("ready");
    } finally {
      aiInsightInFlightRef.current = false;
    }
  }, [key, collectionInsightLabel]);

  /** Mobile — start AI insight soon after collection detail is usable. */
  useEffect(() => {
    if (!key.length || !narrowViewport) return;
    if (!data?.collection || isLoading || isError) return;
    if (aiInsightAutoStartedRef.current) return;
    aiInsightAutoStartedRef.current = true;
    void runMockAiInsights();
  }, [key, narrowViewport, data?.collection, isLoading, isError, runMockAiInsights]);

  /** Desktop / tablet — lazy-start when AI section scrolls into view. */
  useEffect(() => {
    if (!key.length || narrowViewport) return;
    if (!data?.collection || isLoading || isError) return;
    const root = aiInsightSectionRef.current;
    if (!root) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.some(
          (e) => e.isIntersecting && (e.intersectionRatio >= 0.12 || e.intersectionRect.height > 0),
        );
        if (!visible) return;
        if (aiInsightAutoStartedRef.current) return;
        aiInsightAutoStartedRef.current = true;
        obs.disconnect();
        void runMockAiInsights();
      },
      {
        threshold: [0, 0.12, 0.25],
        rootMargin: "0px 0px -12% 0px",
      },
    );
    obs.observe(root);
    return () => obs.disconnect();
  }, [
    key,
    narrowViewport,
    data?.collection,
    isLoading,
    isError,
    runMockAiInsights,
  ]);

  useEffect(() => {
    if (!showAiInsights || aiInsightStatus !== "ready") return;
    setAiRevealStep(0);
    const timers = [120, 320, 520, 740, 940, 1140].map((ms, idx) =>
      setTimeout(() => setAiRevealStep(idx + 1), ms),
    );
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [showAiInsights, aiInsightStatus, aiInsightResult?.generatedAt]);

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
            : "Collection not found (no summary row for this bucket yet). List an NFT in this bucket or open it from the markets after the first listing."}
        </p>
        <Link href="/markets" className="text-mint text-sm hover:underline">
          ← Back to Markets
        </Link>
      </div>
    );
  }

  const { collection, representativeImageUrl } = data;
  const collectionCoverUrl =
    collection.coverImageUrl?.trim() || representativeImageUrl;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-5 lg:px-8 xl:px-10 py-8 pb-20">
        <Link
          href="/markets"
          className="inline-flex text-sm text-mint/90 hover:text-mint mb-6"
        >
          ← Back to Markets
        </Link>

        <CollectionOverviewBoard
          title={collection.displayLabel}
          subtitle={subtitle}
          badgeLabel="Collection"
          imageUrl={collectionCoverUrl}
          metadataRows={metadataRows}
          stats={[]}
          chartMetricsRow={
            <CollectionPriceMetricsStrip
              externalMarketUsd={resolvedExternal.usd}
              externalPriceSource={resolvedExternal.source}
              marketTierDisplay={pokeTierLabel}
              externalMarketMatchConfidence={resolvedExternal.marketMatchConfidence}
              externalPriceLoading={
                marketPreviewLoading || nmHistoryLoading || marketSeriesLoading
              }
              externalVolatilityCvPct={externalVolatilityCvPct}
              volatilityFootnote={volatilityFootnote}
              marketStats={marketStats ?? null}
              marketStatsLoading={marketStatsLoading}
              platformPriceSamples={platformPriceSamples}
              bookSpreadPct={marketMetrics.spreadPct}
              externalPriceChange1yPct={externalPriceChange1yPct}
              externalPriceChange1yLoading={pokeYearHistoryLoading}
              marketCapUsd={marketCapComputation?.usd ?? null}
              marketCapMethodHint={marketCapComputation?.methodLabel ?? null}
              formatMarketCap={formatMarketCapUsd}
            />
          }
          metadataExpand={{
            collectionKey: collection.collectionKey,
            displayLabel: collection.displayLabel,
            queryUsed: collection.queryUsed ?? marketPreview?.searchQuery ?? null,
            createdAt: collection.createdAt,
            representativeImageUrl: collectionCoverUrl,
            components: collection.components,
            marketSeriesMeta: null,
            cardhedgerCardId: marketPreview?.card?.id ?? null,
          }}
          listingCount={asks.length}
          priceChart={
            <CollectionDualPriceChart
              variant="exchange"
              chartTitle=""
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
              controls={
                <div className="inline-flex w-fit items-center gap-1 rounded-lg border border-gray-800/80 bg-black/30 p-1">
                  {CHART_RANGE_OPTIONS.map((opt) => {
                    const active = opt.id === chartRange;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setChartRange(opt.id)}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                          active
                            ? "bg-mint text-black"
                            : "text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100"
                        }`}
                        aria-pressed={active}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              }
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

        <section
          ref={aiInsightSectionRef}
          className="mt-6 w-full scroll-mt-28"
          aria-label="AI insights"
        >
          <button
            type="button"
            onClick={() => runMockAiInsights()}
            className="inline-flex min-w-[190px] items-center justify-center rounded-lg border border-[#0fd4bd]/70 bg-[#0a302b]/45 px-4 py-2 text-sm font-semibold text-[#2de8d2] transition-colors hover:bg-[#0b3e37]/70"
          >
            {aiInsightStatus === "loading" ? "Generating insight..." : "AI Insights"}
          </button>
          {showAiInsights && aiInsightStatus === "loading" ? (
            <div className="ai-insight-loading-shell mt-4 rounded-2xl border border-[#0fd4bd]/45 bg-[#060f12]/95 px-6 py-5 text-sm text-zinc-100 shadow-[0_0_0_1px_rgba(16,185,129,0.08),0_0_26px_rgba(20,184,166,0.16)]">
              <p className="mb-2 text-[13px] font-semibold tracking-wide text-[#45f2dc]">
                AI Insights
              </p>
              <p className="text-zinc-300">
                Scanning liquidity regimes, premium structure, and momentum clusters...
              </p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-800/80">
                <div className="ai-insight-loading-track h-full w-[28%] rounded-full bg-[#20e4cf]" />
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="h-10 rounded-lg bg-zinc-800/60 ai-insight-loading-block" />
                <div className="h-10 rounded-lg bg-zinc-800/50 ai-insight-loading-block" />
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
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {aiInsightResult.marketTone ? (
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                          aiInsightResult.marketTone === "Bullish"
                            ? "border-emerald-300/40 bg-emerald-500/15 text-emerald-200"
                            : aiInsightResult.marketTone === "Cooling"
                              ? "border-rose-300/40 bg-rose-500/15 text-rose-200"
                              : aiInsightResult.marketTone === "Consolidating"
                                ? "border-amber-300/40 bg-amber-500/15 text-amber-200"
                                : aiInsightResult.marketTone === "Overextended"
                                  ? "border-orange-300/45 bg-orange-500/15 text-orange-200"
                                  : aiInsightResult.marketTone === "Volatile"
                                    ? "border-fuchsia-300/45 bg-fuchsia-500/15 text-fuchsia-200"
                                    : "border-zinc-400/40 bg-zinc-500/10 text-zinc-200"
                        }`}
                      >
                        {aiInsightResult.marketTone}
                      </span>
                    ) : null}
                    {aiInsightResult.riskScore != null ? (
                      <span className="inline-flex items-center rounded-full border border-sky-300/35 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-sky-200">
                        Risk {aiInsightResult.riskScore}/100
                        {aiInsightResult.riskLabel ? ` · ${aiInsightResult.riskLabel}` : ""}
                      </span>
                    ) : null}
                  </div>
                  <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/[0.05] px-3 py-3 min-h-[78px]">
                      <p className="text-[10px] uppercase tracking-wide text-cyan-200/80">AI Confidence</p>
                      <p className="mt-1 text-base font-semibold text-cyan-100">
                        {aiInsightResult.confidence != null && Number.isFinite(aiInsightResult.confidence)
                          ? `${(aiInsightResult.confidence * 100).toFixed(1)}%`
                          : "context-limited"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.05] px-3 py-3 min-h-[78px]">
                      <p className="text-[10px] uppercase tracking-wide text-emerald-200/80">PSA 10 Spot</p>
                      <p className="mt-1 text-base font-semibold text-emerald-100">
                        {aiInsightResult.stats?.psa10SpotUsd != null &&
                        Number.isFinite(aiInsightResult.stats.psa10SpotUsd)
                          ? `$${aiInsightResult.stats.psa10SpotUsd.toFixed(2)}`
                          : "thin feed"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/[0.05] px-3 py-3 min-h-[78px]">
                      <p className="text-[10px] uppercase tracking-wide text-fuchsia-200/80">Premium vs Raw</p>
                      <p className="mt-1 text-base font-semibold text-fuchsia-100">
                        {aiInsightResult.stats?.premiumVsRawPct != null &&
                        Number.isFinite(aiInsightResult.stats.premiumVsRawPct)
                          ? `${aiInsightResult.stats.premiumVsRawPct >= 0 ? "+" : ""}${aiInsightResult.stats.premiumVsRawPct.toFixed(1)}%`
                          : "forming"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-violet-400/20 bg-violet-500/[0.05] px-3 py-3 min-h-[78px]">
                      <p className="text-[10px] uppercase tracking-wide text-violet-200/80">90D Trend</p>
                      <p className="mt-1 text-base font-semibold text-violet-100">
                        {aiInsightResult.stats?.change90dPct != null &&
                        Number.isFinite(aiInsightResult.stats.change90dPct)
                          ? `${aiInsightResult.stats.change90dPct >= 0 ? "+" : ""}${aiInsightResult.stats.change90dPct.toFixed(1)}%`
                          : "limited"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-amber-400/20 bg-amber-500/[0.05] px-3 py-3 min-h-[78px]">
                      <p className="text-[10px] uppercase tracking-wide text-amber-200/80">365D Trend</p>
                      <p className="mt-1 text-base font-semibold text-amber-100">
                        {aiInsightResult.stats?.change365dPct != null &&
                        Number.isFinite(aiInsightResult.stats.change365dPct)
                          ? `${aiInsightResult.stats.change365dPct >= 0 ? "+" : ""}${aiInsightResult.stats.change365dPct.toFixed(1)}%`
                          : "partial"}
                      </p>
                    </div>
                  </div>
                  {aiRevealStep >= 1 ? (
                    <>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                        AI Insight
                      </p>
                      <p className="mb-3 text-zinc-100">{aiInsightResult.summary}</p>
                    </>
                  ) : null}
                  {aiRevealStep >= 2 ? (
                    <>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                        Market Structure
                      </p>
                      <ul className="mb-3 list-disc space-y-1.5 pl-5 text-zinc-200/95">
                        {(aiInsightResult.dynamics ?? []).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  {aiRevealStep >= 3 ? (
                    <>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                        Key Signals
                      </p>
                      <ul className="list-disc space-y-1.5 pl-5 text-zinc-200/95">
                        {aiInsightResult.bullets.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  {aiRevealStep >= 4 ? (
                    <>
                      <p className="mt-3 mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                        Synthetic Forecast Chart
                      </p>
                      <div className="mt-2 rounded-2xl border border-zinc-700/60 bg-[#070b10]/90 p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold tracking-wide text-zinc-200/95">
                            {aiInsightResult.chartSpec?.chartStyle ?? "Expanded Macro View (Wide X-Axis)"}
                          </p>
                          <span className="inline-flex items-center rounded-full border border-amber-300/25 bg-amber-500/[0.08] px-2.5 py-1 text-[10px] text-amber-200/90">
                            Scenario guidance, not deterministic forecast
                          </span>
                        </div>

                        {aiInsightResult.chartSpec?.miniSeries &&
                        aiInsightResult.chartSpec.miniSeries.length >= 2 ? (
                          <div className="rounded-xl border border-cyan-400/20 bg-black/35 px-3 py-2">
                            <svg
                              viewBox="0 0 220 70"
                              className="h-16 w-full"
                              preserveAspectRatio="none"
                            >
                              {[0, 1, 2, 3, 4].map((i) => (
                                <line
                                  key={`h-${i}`}
                                  x1="0"
                                  y1={String(i * 17.5)}
                                  x2="220"
                                  y2={String(i * 17.5)}
                                  stroke="rgba(148,163,184,0.13)"
                                  strokeWidth="0.8"
                                />
                              ))}
                              <path
                                d={buildMiniChartPath(aiInsightResult.chartSpec.miniSeries, 220, 70)}
                                fill="none"
                                stroke="rgba(46, 230, 208, 0.95)"
                                strokeWidth="2.1"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            <p className="mt-2 text-[10px] uppercase tracking-wide text-zinc-400">
                              Forecast Path
                            </p>
                            <div className="mt-1 inline-flex max-w-full items-center overflow-x-auto rounded-md border border-cyan-300/25 bg-cyan-500/[0.08] px-2.5 py-1.5">
                              <span className="whitespace-nowrap font-mono text-[11px] font-semibold tracking-tight text-cyan-100">
                                {aiInsightResult.chartSpec.pathRepresentation}
                              </span>
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                          <div>
                            <p className="mb-1 text-[10px] uppercase tracking-wide text-zinc-400">
                              Momentum Behavior
                            </p>
                            <p className="text-zinc-200/95">
                              {aiInsightResult.chartSpec?.momentumBehavior ?? aiInsightResult.syntheticChart}
                            </p>
                          </div>
                          <div>
                            <p className="mb-1 text-[10px] uppercase tracking-wide text-zinc-400">
                              Visual Interpretation
                            </p>
                            <p className="text-zinc-300/95">
                              {aiInsightResult.chartSpec?.visualInterpretation ?? aiInsightResult.syntheticChart}
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : null}
                  {aiRevealStep >= 5 ? (
                    <>
                      <p className="mt-3 mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                        Forward Outlook
                      </p>
                      {aiInsightResult.outlook ? (
                        <p className="text-zinc-200/95">{aiInsightResult.outlook}</p>
                      ) : null}
                      {aiInsightResult.outlookScenarios ? (
                        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-zinc-200/95">
                          <li> Bull case: {aiInsightResult.outlookScenarios.bullCase}</li>
                          <li> Base case: {aiInsightResult.outlookScenarios.baseCase}</li>
                          <li> Bear case: {aiInsightResult.outlookScenarios.bearCase}</li>
                        </ul>
                      ) : null}
                    </>
                  ) : null}
                  {aiRevealStep >= 6 ? (
                    <p className="mt-2 text-[11px] text-zinc-400">
                      Market Tone:{" "}
                      <span className="font-semibold text-zinc-200">
                        {aiInsightResult.marketTone ?? "Accumulating"}
                      </span>
                    </p>
                  ) : null}
                  {aiInsightResult.cardId ? (
                    <p className="mt-2 break-all text-[11px] text-zinc-400">
                      Card ID: {aiInsightResult.cardId}
                    </p>
                  ) : null}
                  <p className="mt-3 text-[11px] text-zinc-500">
                    Updated {aiInsightResult.generatedAt}
                  </p>
                </>
              ) : null}
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
