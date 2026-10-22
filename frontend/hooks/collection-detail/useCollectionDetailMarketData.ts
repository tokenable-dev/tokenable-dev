"use client";

import { useEffect, useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  getCollectionMarketSeries,
  getCollectionPlatformTrades,
  rq,
  marketplaceRqPolicy,
  type CollectionMarketSeries,
  type CollectionPlatformTapeFill,
} from "@/lib/core";
import {
  computeCollectionMarketCapUsd,
  formatReferenceChangeCoverageHint,
  marketHistoryTierFromComponents,
  marketTierDisplayLabel,
  MARKET_METRICS_SERIES_DURATION,
  percentChangeReferenceBestWindow,
  parseGradeScoreNumber,
  resolveExternalMarketUsd,
  computeHeroTapeActivityStats,
  computeMedianSaleUsd30d,
  countableTapeFills,
  prependSessionFillToTape,
  resolvePsaPopulationMetrics,
} from "@/lib/market";
import { parsePsaPopulationByGrade } from "@/lib/market/psaPopulationByGrade";
import { COLLECTION_SESSION_FILL_DEDUP_SEC } from "@/lib/marketplace/collectionDetailConstants";
import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import { useCollectionGradeChart } from "@/hooks/collection-grade-chart";
import { looksLikeCollectionKey } from "@/lib/ui/page-state-catalog";

export function useCollectionDetailMarketData(params: {
  key: string;
  chainId: number;
  chainReady: boolean;
  comp: CollectionComponents;
  hasCollection: boolean;
  detailError: boolean;
  sessionFillPoint: { t: number; v: number } | null;
  setSessionFillPoint: (p: { t: number; v: number } | null) => void;
}) {
  const {
    key,
    chainId,
    chainReady,
    comp,
    hasCollection,
    detailError,
    sessionFillPoint,
    setSessionFillPoint,
  } = params;

  const pokeHistoryTier = useMemo(
    () => marketHistoryTierFromComponents(comp),
    [comp],
  );
  const pokeTierLabel = marketTierDisplayLabel(pokeHistoryTier);

  const marketSeriesEnabled =
    chainReady && looksLikeCollectionKey(key) && !detailError;

  const sealedBox = comp.assetKind === "sealed_box";

  const { data: marketSeries, isLoading: marketSeriesLoading } = useQuery({
    queryKey: rq.collectionMarketSeries(key, MARKET_METRICS_SERIES_DURATION, chainId),
    queryFn: () => getCollectionMarketSeries(key, MARKET_METRICS_SERIES_DURATION),
    enabled: marketSeriesEnabled,
    staleTime: marketplaceRqPolicy.marketSeriesStaleMs,
    // Sealed boxes have no Cardhedger overlay — poll briefly until PriceCharting
    // snapshot lands (spot and/or ≥2 history points).
    refetchInterval: (q) => {
      if (!sealedBox || !marketSeriesEnabled) return false;
      const d = q.state.data;
      const hasSpot =
        (typeof d?.gradePrices?.raw === "number" && d.gradePrices.raw > 0) ||
        d?.spotPriceBasis === "pricecharting";
      const pts = d?.externalUsd?.length ?? 0;
      if (hasSpot && pts >= 2) return false;
      return 3_000;
    },
  });

  const gradeChart = useCollectionGradeChart({
    collectionKey: key,
    comp,
    marketSeries,
    marketSeriesLoading,
    marketSeriesEnabled,
  });

  const activeGradeForTrades = gradeChart.activeGrade;
  const hasSlabGradeFromComp =
    String(comp.gradeScore ?? "").trim().length > 0 ||
    String(comp.psaGradeLabel ?? "").trim().length > 0 ||
    String(comp.gradingCompany ?? "").trim().length > 0;

  const marketPreview = marketSeries?.cardhedgerPreview ?? null;

  /*
   * Start trades as soon as collection components include a slab grade
   * (do not wait for market-series). If components have no grade yet, wait
   * until market-series settles so we do not key the tape as PSA 10 by default.
   */
  const tradesQueryEnabled =
    chainReady &&
    looksLikeCollectionKey(key) &&
    !detailError &&
    (hasSlabGradeFromComp || !marketSeriesLoading);

  const {
    data: platformTradesData,
    isPending: platformTradesPending,
    isFetching: platformTradesFetching,
    isError: platformTradesError,
    error: platformTradesErrorDetail,
  } = useQuery({
    queryKey: rq.collectionPlatformTrades(
      key,
      chainId,
      undefined,
      activeGradeForTrades,
    ),
    queryFn: () =>
      getCollectionPlatformTrades(key, { grade: activeGradeForTrades }),
    enabled: tradesQueryEnabled,
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
    placeholderData: keepPreviousData,
  });

  /* Soft refetch / grade picker change must not blank the panel. */
  const platformTradesLoading =
    !tradesQueryEnabled ||
    (platformTradesData == null &&
      (platformTradesPending || platformTradesFetching));

  const platformPtsBase = useMemo(
    () => platformTradesData?.platformUsd ?? [],
    [platformTradesData?.platformUsd],
  );

  const displayPlatformUsd = useMemo(() => {
    const pts: { t: number; v: number }[] = [...platformPtsBase];
    if (
      sessionFillPoint != null &&
      Number.isFinite(sessionFillPoint.v) &&
      sessionFillPoint.v > 0
    ) {
      const alreadyInSeries = pts.some(
        (p) =>
          Math.abs(p.v - sessionFillPoint.v) < 1e-4 &&
          Math.abs(p.t - sessionFillPoint.t) <= COLLECTION_SESSION_FILL_DEDUP_SEC,
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

  const chartExternalRollingUsd = gradeChart.chartExternalRollingUsd;
  const jtHistOk = chartExternalRollingUsd.length >= 2;
  const chartExternalWindowDays =
    gradeChart.chartDays >= 10000 ? null : gradeChart.chartDays;
  const chartExternalLegend =
    marketSeries?.spotPriceBasis === "psa_estimate"
      ? `PSA Estimate · ${gradeChart.activeGrade}`
      : gradeChart.chartExternalLegend;
  const chartExternalShort =
    marketSeries?.spotPriceBasis === "psa_estimate"
      ? "PSA Estimate"
      : gradeChart.chartExternalShort;
  const chartExternalRollingKind: "history" | "snapshot" = jtHistOk
    ? "history"
    : "snapshot";

  const metricsReferencePts = marketSeries?.externalUsd ?? [];
  const metricsHistOk = metricsReferencePts.length >= 2;

  const externalReferencePtsForChange = useMemo(() => {
    if (metricsHistOk) return metricsReferencePts;
    return [];
  }, [metricsHistOk, metricsReferencePts]);

  const externalPriceChangeResult = useMemo(() => {
    const m = marketSeries;
    if (
      m?.marketChangePct != null &&
      Number.isFinite(m.marketChangePct) &&
      m.marketChangeSpanSec != null &&
      m.marketChangeSpanSec > 0
    ) {
      return {
        pct: m.marketChangePct,
        isFullYear: Boolean(m.marketChangeIsFullYear),
        windowSec: m.marketChangeSpanSec,
        refUsd: m.marketChangeRefUsd ?? null,
        refAtSec: m.marketChangeRefAtSec ?? null,
        marketChangeWindow: m.marketChangeWindow ?? null,
      };
    }
    return percentChangeReferenceBestWindow(externalReferencePtsForChange);
  }, [marketSeries, externalReferencePtsForChange]);

  const externalPriceChangeCoverageHint = useMemo(
    () => formatReferenceChangeCoverageHint(externalPriceChangeResult),
    [externalPriceChangeResult],
  );

  const externalPriceChange1MoPct = externalPriceChangeResult.pct;

  const resolvedExternal = useMemo(() => {
    const fromSeries = resolveExternalMarketUsd({
      marketPreview,
      gradePrices: marketSeries?.gradePrices ?? null,
      gradeScore: parseGradeScoreNumber(comp.gradeScore),
      components: comp,
      spotPriceBasis: marketSeries?.spotPriceBasis ?? null,
    });
    if (fromSeries.usd != null) return fromSeries;
    // Markets list already falls back to components.loosePriceCents for sealed boxes.
    if (comp.assetKind === "sealed_box") {
      const cents = comp.loosePriceCents;
      if (typeof cents === "number" && Number.isFinite(cents) && cents > 0) {
        return { usd: cents / 100, source: "pricecharting" as const };
      }
    }
    return fromSeries;
  }, [marketPreview, marketSeries?.gradePrices, marketSeries?.spotPriceBasis, comp]);

  const gradeAwareExternalUsd =
    gradeChart.selectedPriceUsd ?? resolvedExternal.usd;
  /*
   * Headline % must match list / Indices ticker / Markets cards:
   * server `marketChangePct` on full archive (1Y best window) — not recomputed from
   * the chart-day-filtered or alternate-grade series (that caused 800% vs 50% jumps).
   * Spot USD above can still follow the selected grade.
   */
  const gradeAwareChangeResult = externalPriceChangeResult;
  const gradeAwareChange1MoPct = gradeAwareChangeResult.pct;
  const gradeAwareChangeCoverageHint = externalPriceChangeCoverageHint;
  const gradeAwareTierLabel = gradeChart.activeGrade;
  const gradeAwarePriceLoading =
    gradeChart.gradeChartLoading || marketSeriesLoading;
  const gradeAwareChangeLoading = gradeAwarePriceLoading;

  const orderBookTapeFills = useMemo((): CollectionPlatformTapeFill[] => {
    return prependSessionFillToTape(
      countableTapeFills(platformTradesData?.trades ?? []),
      sessionFillPoint,
      COLLECTION_SESSION_FILL_DEDUP_SEC,
    );
  }, [platformTradesData?.trades, sessionFillPoint]);

  const psaPopulationMetrics = useMemo(
    () => resolvePsaPopulationMetrics(comp, gradeChart.activeGrade),
    [comp, gradeChart.activeGrade],
  );

  const totalPopulation = useMemo(() => {
    const specTotal = psaPopulationMetrics.totalPsaPop;
    if (specTotal != null) return specTotal;
    const byGrade = parsePsaPopulationByGrade(comp.psaPopulationByGrade);
    if (byGrade) {
      let sum = 0;
      for (let g = 1; g <= 10; g++) {
        const n = byGrade[String(g) as keyof typeof byGrade];
        if (typeof n === "number" && Number.isFinite(n)) sum += n;
      }
      if (sum > 0) return sum;
    }
    return null;
  }, [comp.psaPopulationByGrade, psaPopulationMetrics.totalPsaPop]);

  const chartExternalRefTag = gradeChart.chartExternalRefTag;

  const chartProps = {
    variant: "markets" as const,
    collectionOverviewMat: true,
    chartTitle: "",
    platformUsd: displayPlatformUsd,
    externalMarketUsd:
      chartExternalRollingUsd.length >= 2
        ? null
        : gradeChart.selectedPriceUsd ?? resolvedExternal.usd,
    externalWindowDays: chartExternalWindowDays,
    externalRollingUsd:
      chartExternalRollingUsd.length > 0 ? chartExternalRollingUsd : null,
    externalRollingKind: chartExternalRollingKind,
    externalLegendLabel: chartExternalLegend,
    externalSeriesShortLabel: chartExternalShort,
    externalRefLineTag: chartExternalRefTag,
    emptyStateMessage:
      comp.assetKind === "sealed_box"
        ? "No PriceCharting price history in this window."
        : marketSeries?.spotPriceBasis === "psa_estimate"
          ? `PSA Estimate shown for ${gradeChart.activeGrade} — no sales history in this window.`
          : `No price history for ${gradeChart.activeGrade} in this window.`,
    /* Trades fetch must not blank the chart — that reflows the sticky hero. */
    isLoading: gradeChart.gradeChartLoading,
    errorMessage: null as string | null,
  };

  const marketCapComputation = useMemo(
    () =>
      hasCollection
        ? computeCollectionMarketCapUsd({
            components: comp,
            gradeScoreStr: comp.gradeScore,
            marketCard: marketPreview?.card ?? null,
            marketMatchConfidence: marketPreview?.matchConfidence,
            gradePrices: marketSeries?.gradePrices ?? null,
            marketPreview: marketPreview ?? null,
            chartGradeLabel: gradeChart.activeGrade,
            referenceUnitUsd: gradeChart.selectedPriceUsd,
          })
        : null,
    [
      hasCollection,
      comp,
      marketPreview,
      marketSeries?.gradePrices,
      gradeChart.activeGrade,
      gradeChart.selectedPriceUsd,
    ],
  );

  const heroTapeStats = useMemo(() => {
    if (platformTradesData == null && sessionFillPoint == null) {
      return {
        median30dUsd: null as number | null,
        periodLabel: null as string | null,
        periodVolumeUsdc: null as number | null,
        volume1yUsdc: null as number | null,
        velocityPct: null as number | null,
      };
    }
    const trades = platformTradesData?.trades ?? [];
    const median30dUsd = computeMedianSaleUsd30d(
      trades,
      sessionFillPoint,
      COLLECTION_SESSION_FILL_DEDUP_SEC,
    );
    const activity = computeHeroTapeActivityStats(
      trades,
      sessionFillPoint,
      COLLECTION_SESSION_FILL_DEDUP_SEC,
      marketCapComputation?.usd ?? null,
    );
    return {
      median30dUsd,
      periodLabel: activity.periodLabel,
      periodVolumeUsdc: activity.periodVolumeUsdc,
      volume1yUsdc: activity.volume1yUsdc,
      velocityPct: activity.velocityPct,
    };
  }, [platformTradesData, sessionFillPoint, marketCapComputation?.usd]);

  const lastPlatformSaleUsdc = useMemo(() => {
    if (!platformPtsBase.length) return null;
    const last = platformPtsBase[platformPtsBase.length - 1];
    return typeof last.v === "number" && Number.isFinite(last.v) && last.v > 0
      ? last.v
      : null;
  }, [platformPtsBase]);

  const orderBookLastSaleUsdc = sessionFillPoint?.v ?? lastPlatformSaleUsdc;

  useEffect(() => {
    setSessionFillPoint(null);
  }, [key, setSessionFillPoint]);

  useEffect(() => {
    if (!sessionFillPoint || !platformPtsBase.length) return;
    const found = platformPtsBase.some(
      (p) =>
        Math.abs(p.v - sessionFillPoint.v) < 1e-4 &&
        Math.abs(p.t - sessionFillPoint.t) <= COLLECTION_SESSION_FILL_DEDUP_SEC,
    );
    if (found) setSessionFillPoint(null);
  }, [platformPtsBase, sessionFillPoint, setSessionFillPoint]);

  return {
    marketSeries: marketSeries as CollectionMarketSeries | undefined,
    marketSeriesLoading,
    marketPreview,
    platformTradesLoading,
    platformTradesError,
    platformTradesErrorDetail,
    pokeTierLabel,
    displayPlatformUsd,
    resolvedExternal,
    gradeAwareExternalUsd,
    gradeAwareChange1MoPct,
    gradeAwareChangeResult,
    gradeAwareChangeCoverageHint,
    gradeAwareTierLabel,
    gradeAwarePriceLoading,
    gradeAwareChangeLoading,
    marketCapComputation,
    heroTapeStats,
    heroTapeLoading: platformTradesLoading,
    totalPopulation,
    psaPopulationMetrics,
    orderBookTapeFills,
    orderBookLastSaleUsdc,
    externalPriceChange1MoPct,
    externalPriceChangeResult,
    externalPriceChangeCoverageHint,
    chartProps,
    gradeChart,
  };
}
