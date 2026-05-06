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
  type CollectionAiInsight,
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
import { CollectionOwnedRwaListModal } from "@/components/marketplace/CollectionOwnedRwaListModal";
import {
  TradeCelebrationModal,
  type TradeCelebrationKind,
} from "@/components/marketplace/TradeCelebrationModal";
import { AiInsightTypewriter } from "@/components/marketplace/AiInsightTypewriter";
import { CollectionDualPriceChart } from "@/components/marketplace/CollectionDualPriceChart";
import { CollectionRwaCard } from "@/components/marketplace/CollectionRwaCard";
import { useAppStore, selectWallet } from "@/store";
import { isCriteriaCollectionBid } from "@/lib/seaport/criteria/criteriaMatch";
import {
  bucketCardNameForDisplay,
  bucketCardSetForDisplay,
  bucketGradingCompanyForDisplay,
} from "@/lib/marketplace/bucketKey";

function aiMarketPerspectiveBadgeClass(
  tone: NonNullable<CollectionAiInsight["marketTone"]>,
): string {
  switch (tone) {
    case "Uptrend":
    case "Bullish":
      return "border-emerald-300/40 bg-emerald-500/15 text-emerald-200";
    case "Accumulation":
    case "Accumulating":
      return "border-cyan-300/45 bg-cyan-500/12 text-cyan-200";
    case "Distribution":
    case "Cooling":
      return "border-rose-300/40 bg-rose-500/15 text-rose-200";
    case "Dead cat bounce":
      return "border-orange-300/45 bg-orange-500/14 text-orange-200";
    case "Illiquid / niche":
      return "border-zinc-500/50 bg-zinc-600/20 text-zinc-200";
    case "Consolidating":
      return "border-amber-300/40 bg-amber-500/15 text-amber-200";
    case "Volatile":
      return "border-fuchsia-300/45 bg-fuchsia-500/15 text-fuchsia-200";
    case "Overextended":
      return "border-orange-300/50 bg-orange-500/14 text-orange-100";
    default:
      return "border-zinc-400/40 bg-zinc-500/10 text-zinc-200";
  }
}

/** Same fill can appear from session overlay + DB poll with timestamps minutes apart */
const SESSION_FILL_DEDUP_SEC = 300;

/** Normalize chips for duplicate detection (against set/title lines). */
function normTagDedupeKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ").replace(/^#/, "");
}

function leadingYearFromSetLine(setLineRaw: string): number | null {
  const m = /^\s*(\d{4})\b/.exec(setLineRaw);
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 1880 && y <= 2100 ? y : null;
}

/** True when this chip repeats the hero set line / year-stripped variant (upstream often mirrors set into “variant”). */
function tagEchoesSetLine(fragment: string, setLineRaw: string): boolean {
  const f = normTagDedupeKey(fragment);
  if (!f) return true;
  const lineRaw = setLineRaw.trim();
  if (!lineRaw) return false;
  const line = normTagDedupeKey(lineRaw);
  const noYear = normTagDedupeKey(lineRaw.replace(/^\s*\d{4}\s+/, ""));
  if (line && (f === line || f === noYear)) return true;
  /** Only treat long overlaps as echoes — keep short tokens like `Base`. */
  const minLong = 12;
  if (noYear.length >= minLong && (f.includes(noYear) || noYear.includes(f))) return true;
  if (line.length >= minLong && (f.includes(line) || line.includes(f))) return true;
  return false;
}

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

export default function MarketplaceCollectionPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const { address } = useAppStore(useShallow(selectWallet));
  const raw = params.collectionKey;
  const collectionKey = Array.isArray(raw) ? raw[0] : raw;
  const key = typeof collectionKey === "string" ? decodeURIComponent(collectionKey) : "";
  const [sellModalOpen, setSellModalOpen] = useState(false);
  const [tradeCelebration, setTradeCelebration] = useState<TradeCelebrationKind | null>(null);
  const [bookSelection, setBookSelection] = useState<BookRowSelection | null>(null);
  const [chartRange, setChartRange] = useState<ChartRangeId>("90d");
  const [showAiInsights, setShowAiInsights] = useState(false);
  const [aiInsightStatus, setAiInsightStatus] = useState<"idle" | "loading" | "ready">("idle");
  const [aiInsightResult, setAiInsightResult] = useState<{
    title: string;
    summary: string;
    bullets: string[];
    dynamics?: string[];
    outlook?: string;
    outlookScenarios?: {
      bullCase: string;
      baseCase: string;
      bearCase: string;
    };
    generatedAt: string;
    confidence?: number | null;
    confidenceNote?: string | null;
    riskTapeNote?: string | null;
    marketTone?: CollectionAiInsight["marketTone"];
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
      psaTotalPopulation?: number | null;
      psa10PriceConfidence?: "high" | "medium" | "low" | null;
      psa10PricingNote?: string | null;
      psa10SpotLowUsd?: number | null;
      psa10SpotHighUsd?: number | null;
      psa10CatalogUsd?: number | null;
    };
  } | null>(null);
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
    setShowAiInsights(false);
    setAiInsightStatus("idle");
    setAiInsightResult(null);
  }, [key]);

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

  const chartExternalLegend = pokeHistOk
    ? liveMarketLegend
    : jtHistOk
      ? liveMarketLegend
      : `External market (${pokeTierLabel})`;

  const chartExternalShort = liveMarketLegend;

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
      ? liveMarketLegend
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

  /** Primary card facts: hero title, set line, badges, and `headlineInfoTags` chips. */
  const metadataRows = useMemo(() => [] as { label: string; value: string }[], [key]);

  const subtitle = useMemo(() => {
    const setShown = bucketCardSetForDisplay(comp as Record<string, unknown>);
    const parts = [setShown, comp.cardNumber].filter(
      (x): x is string => typeof x === "string" && x.trim().length > 0
    );
    return parts.length ? parts.join(" · ") : null;
  }, [comp, data?.collection?.components]);

  const headlineSetLine = useMemo(() => {
    const setMerged =
      marketPreview?.card?.setName?.trim() ||
      bucketCardSetForDisplay(comp as Record<string, unknown>).trim();
    return setMerged.length > 0 ? setMerged : null;
  }, [marketPreview?.card?.setName, comp]);

  const collectionCategoryBadge = useMemo(() => {
    const name = bucketCardNameForDisplay(comp as Record<string, unknown>);
    const setN = bucketCardSetForDisplay(comp as Record<string, unknown>);
    const corpus = `${name} ${setN} ${marketPreview?.card?.setName ?? ""}`;
    if (/\bpokemon\b/i.test(corpus)) return "Pokemon";
    const cat = marketPreview?.card?.category?.trim();
    if (cat) {
      const t = cat.replace(/\s+/g, " ");
      return t.charAt(0).toUpperCase() + (t.length > 1 ? t.slice(1) : "");
    }
    return "Trading cards";
  }, [
    marketPreview?.card?.category,
    marketPreview?.card?.setName,
    comp.cardNameDisplay,
    comp.cardName,
    comp.cardSet,
    comp.cardSetDisplay,
  ]);

  const collectionHeadlineCardName = useMemo(() => {
    const nm = bucketCardNameForDisplay(comp as Record<string, unknown>).trim();
    const dl =
      typeof data?.collection?.displayLabel === "string"
        ? data.collection.displayLabel.trim()
        : "";
    if (nm.length > 0) return nm;
    if (dl.length > 0) return dl;
    return key.length > 0 ? key.slice(0, 18) + (key.length > 18 ? "…" : "") : "Collection";
  }, [
    comp.cardNameDisplay,
    comp.cardName,
    data?.collection?.displayLabel,
    key,
  ]);

  const headlineGradeBadge = useMemo(
    () => pokeTierLabel || null,
    [pokeTierLabel],
  );

  /** Chips under headline — de-duped vs set/title; no low-signal market codes. */
  const headlineInfoTags = useMemo(() => {
    const setLine = headlineSetLine?.trim() ?? "";
    const setFromComp = bucketCardSetForDisplay(comp as Record<string, unknown>).trim();
    const anchorLines = [setLine, setFromComp].filter((s) => s.length > 0);
    const titleKey = normTagDedupeKey(collectionHeadlineCardName);
    const setYear = setLine ? leadingYearFromSetLine(setLine) : null;

    const seen = new Set<string>();
    const tags: { id: string; text: string; title?: string }[] = [];

    const pushUnique = (id: string, display: string, title?: string) => {
      const d = display.trim();
      if (!d) return;
      if (anchorLines.some((a) => tagEchoesSetLine(d, a))) return;
      const k = normTagDedupeKey(d);
      if (!k || seen.has(k)) return;
      if (titleKey.length >= 3 && k === titleKey) return;
      seen.add(k);
      tags.push({
        id,
        text: d.length > 44 ? `${d.slice(0, 41)}…` : d,
        title: title ?? (d.length > 44 ? d : undefined),
      });
    };

    const numRaw =
      marketPreview?.card?.cardNumber?.trim() || String(comp.cardNumber ?? "").trim();
    const numTok = numRaw ? (numRaw.startsWith("#") ? numRaw : `#${numRaw}`) : "";
    if (numTok) pushUnique("cardno", numTok, "Card number");

    const varFull =
      (typeof comp.variant === "string" && comp.variant.trim().length > 0 && comp.variant.trim()) ||
      (marketPreview?.card?.variant?.trim() ?? "");
    if (varFull) pushUnique("variant", varFull, varFull);

    const grader = bucketGradingCompanyForDisplay(comp as Record<string, unknown>).trim();
    const gradeStr = typeof comp.gradeScore === "string" ? comp.gradeScore.trim() : "";
    const tier = pokeTierLabel?.trim();
    if (!tier) {
      if (grader && gradeStr) pushUnique("gradecombo", `${grader} ${gradeStr}`, "Grade");
      else if (gradeStr) pushUnique("grade", gradeStr, "Grade");
      else if (grader) pushUnique("grader", grader, "Grader");
    }

    const setType = marketPreview?.card?.setType?.trim();
    if (setType) pushUnique("settype", setType, "Set type");

    const popRaw = comp.psaTotalPopulation;
    if (popRaw != null && Number.isFinite(popRaw) && popRaw > 0) {
      const n = Number(popRaw);
      const fmt = n.toLocaleString("en-US");
      pushUnique("pop", `Pop · ${fmt}`, `PSA Total Population · ${fmt}`);
    }

    const rarityRaw = (comp as Record<string, unknown>).rarity;
    const rarity = typeof rarityRaw === "string" ? rarityRaw.trim() : "";
    if (rarity) pushUnique("rarity", rarity, "Rarity");

    const yearRaw = (comp as Record<string, unknown>).year ?? null;
    const yearNum =
      typeof yearRaw === "number" && Number.isFinite(yearRaw)
        ? yearRaw
        : typeof yearRaw === "string" && /^\d{4}$/.test(yearRaw.trim())
          ? Number(yearRaw.trim())
          : null;
    if (
      yearNum != null &&
      yearNum >= 1880 &&
      yearNum <= 2100 &&
      setYear !== yearNum
    ) {
      pushUnique("year", String(yearNum), "Release year");
    }

    const mkt = marketPreview?.card?.market?.trim();
    if (
      mkt &&
      !/^(US|USA|EN|ENG|ENGLISH)$/i.test(mkt) &&
      !tagEchoesSetLine(mkt, setLine || setFromComp || "")
    ) {
      pushUnique("market", mkt, "Market / region");
    }

    return tags.length > 0 ? tags : null;
  }, [
    headlineSetLine,
    collectionHeadlineCardName,
    marketPreview?.card?.cardNumber,
    marketPreview?.card?.variant,
    marketPreview?.card?.setType,
    marketPreview?.card?.market,
    comp.cardNumber,
    comp.variant,
    comp.gradeScore,
    comp.psaTotalPopulation,
    pokeTierLabel,
    comp,
  ]);

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
        outlook: insight.outlook,
        outlookScenarios: insight.outlookScenarios,
        confidence: insight.confidence,
        confidenceNote: insight.confidenceNote ?? null,
        riskTapeNote: insight.riskTapeNote ?? null,
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
          "Snapshot unavailable — below stats still update live.",
        bullets: [
          "Re-open insight after a refresh.",
          "Use price tiles for spot context.",
          "Order book stays live.",
        ],
        dynamics: [],
        confidence: null,
        confidenceNote: null,
        riskTapeNote: null,
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
            <div className="grid gap-6 p-6 lg:grid-cols-[minmax(260px,min(460px,40vw))_minmax(0,1fr)_minmax(300px,420px)]">
              <div className="flex justify-center">
                <div className="aspect-[3/4] w-full max-w-[380px] sm:max-w-[420px] lg:max-w-[460px] rounded-2xl bg-gray-800/60" />
              </div>
              <div className="space-y-4 min-w-0">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(260px,304px)] gap-3">
                  <div className="h-52 min-h-[186px] lg:h-[17rem] lg:min-h-[210px] rounded-xl bg-gray-800/40" />
                  <div className="h-52 min-h-[186px] lg:h-[17rem] lg:min-h-[210px] rounded-xl bg-gray-800/35 border border-gray-800/80" />
                </div>
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-900/40 min-h-[260px]" />
            </div>
          </div>
          <div className="flex gap-4 overflow-hidden">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-52 w-[200px] shrink-0 rounded-2xl bg-gray-800/40 border border-gray-800/80"
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

  const exchangePriceStripProps = {
    showFootnotes: false as const,
    compact: true,
    externalMarketUsd: resolvedExternal.usd,
    externalPriceSource: resolvedExternal.source,
    marketTierDisplay: pokeTierLabel,
    externalMarketMatchConfidence: resolvedExternal.marketMatchConfidence,
    externalPriceLoading: marketPreviewLoading || nmHistoryLoading || marketSeriesLoading,
    externalVolatilityCvPct,
    volatilityFootnote,
    marketStats: marketStats ?? null,
    marketStatsLoading,
    platformPriceSamples,
    bookSpreadPct: marketMetrics.spreadPct,
    externalPriceChange1yPct,
    externalPriceChange1yLoading: pokeYearHistoryLoading,
    marketCapUsd: marketCapComputation?.usd ?? null,
    marketCapMethodHint: marketCapComputation?.methodLabel ?? null,
    formatMarketCap: formatMarketCapUsd,
  };

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
          headlineTitle={collectionHeadlineCardName}
          headlineSetLine={headlineSetLine}
          headlineInfoTags={headlineInfoTags ?? undefined}
          categoryBadge={collectionCategoryBadge}
          gradeBadge={headlineGradeBadge ?? undefined}
          headlineTitleLayout
          badgeLabel="Collection"
          imageUrl={collectionCoverUrl}
          metadataRows={metadataRows}
          stats={[]}
          chartMetricsRow={
            <CollectionPriceMetricsStrip {...exchangePriceStripProps} exchangeColumn="chart" />
          }
          bookColumnMetricsRow={
            <CollectionPriceMetricsStrip {...exchangePriceStripProps} exchangeColumn="trade" />
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
            compactHero: true,
          }}
          listingCount={asks.length}
          showListingSummary={false}
          priceChart={
            <CollectionDualPriceChart
              variant="exchange"
              collectionOverviewMat
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
              showSellListingCount={false}
            />
          }
        />

        <section
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
              <p className="text-zinc-300">Pulling liquidity + PSA context…</p>
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
                  <p className="mb-3 text-[13px] leading-snug text-zinc-300">
                    Perspective for{" "}
                    <span className="font-semibold text-zinc-100">
                      {collectionHeadlineCardName}
                    </span>
                    {collectionInsightLabel &&
                    collectionInsightLabel.trim() !== collectionHeadlineCardName.trim() ? (
                      <>
                        {" "}
                        <span className="text-zinc-500">({collectionInsightLabel})</span>
                      </>
                    ) : null}
                  </p>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {aiInsightResult.marketTone ? (
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${aiMarketPerspectiveBadgeClass(aiInsightResult.marketTone)}`}
                      >
                        {aiInsightResult.marketTone}
                      </span>
                    ) : null}
                    {aiInsightResult.riskScore != null ? (
                      <span className="inline-flex flex-col rounded-full border border-sky-300/35 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-sky-200">
                        <span>
                          Risk {aiInsightResult.riskScore}/100
                          {aiInsightResult.riskLabel ? ` · ${aiInsightResult.riskLabel}` : ""}
                        </span>
                        {aiInsightResult.riskTapeNote ? (
                          <span className="mt-0.5 text-[10px] font-normal leading-snug text-sky-100/90">
                            {aiInsightResult.riskTapeNote}
                          </span>
                        ) : null}
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
                      {aiInsightResult.confidenceNote ? (
                        <p className="mt-1 text-[10px] leading-snug text-amber-200/95">
                          {aiInsightResult.confidenceNote}
                        </p>
                      ) : null}
                    </div>
                    <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.05] px-3 py-3 min-h-[78px]">
                      <p className="text-[10px] uppercase tracking-wide text-emerald-200/80">PSA 10 Spot</p>
                      <p className="mt-1 text-base font-semibold text-emerald-100">
                        {aiInsightResult.stats?.psa10SpotUsd != null &&
                        Number.isFinite(aiInsightResult.stats.psa10SpotUsd)
                          ? `$${aiInsightResult.stats.psa10SpotUsd.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                          : "thin feed"}
                      </p>
                      {aiInsightResult.stats?.psa10PriceConfidence &&
                      aiInsightResult.stats.psa10PriceConfidence !== "high" ? (
                        <p className="mt-1 text-[10px] leading-snug text-zinc-500">
                          {aiInsightResult.stats.psa10PriceConfidence === "medium"
                            ? "Medium confidence · PSA_10 comps"
                            : "Low confidence · verify sales depth"}
                          {aiInsightResult.stats.psa10SpotLowUsd != null &&
                          aiInsightResult.stats.psa10SpotHighUsd != null &&
                          Number.isFinite(aiInsightResult.stats.psa10SpotLowUsd) &&
                          Number.isFinite(aiInsightResult.stats.psa10SpotHighUsd) &&
                          aiInsightResult.stats.psa10SpotHighUsd >=
                            aiInsightResult.stats.psa10SpotLowUsd
                            ? ` · ${new Intl.NumberFormat(undefined, {
                                style: "currency",
                                currency: "USD",
                                maximumFractionDigits: 0,
                              }).format(aiInsightResult.stats.psa10SpotLowUsd)}–${new Intl.NumberFormat(undefined, {
                                style: "currency",
                                currency: "USD",
                                maximumFractionDigits: 0,
                              }).format(aiInsightResult.stats.psa10SpotHighUsd)} (90d range)`
                            : ""}
                        </p>
                      ) : null}
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
                  <AiInsightTypewriter
                    insight={{
                      summary: aiInsightResult.summary,
                      bullets: aiInsightResult.bullets,
                      dynamics: aiInsightResult.dynamics,
                      outlook: aiInsightResult.outlook,
                      outlookScenarios: aiInsightResult.outlookScenarios,
                    }}
                    resetKey={aiInsightResult.generatedAt}
                    durationMs={2600}
                    toneDisplay={aiInsightResult.marketTone}
                    generatedAtLine={aiInsightResult.generatedAt}
                  />
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
