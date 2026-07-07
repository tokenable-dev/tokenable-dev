"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
  computeTradeVolume30dUsdc,
  countableTapeFills,
  prependSessionFillToTape,
  resolvePsaPopulationMetrics,
} from "@/lib/market";
import { COLLECTION_SESSION_FILL_DEDUP_SEC } from "@/lib/marketplace/collectionDetailConstants";
import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import { useCollectionGradeChart } from "@/hooks/collection-grade-chart";

export function useCollectionDetailMarketData(params: {
  key: string;
  comp: CollectionComponents;
  hasCollection: boolean;
  collectionComponents: CollectionComponents | undefined;
  detailLoading: boolean;
  detailError: boolean;
  hasDetailData: boolean;
  sessionFillPoint: { t: number; v: number } | null;
  setSessionFillPoint: (p: { t: number; v: number } | null) => void;
}) {
  const {
    key,
    comp,
    hasCollection,
    collectionComponents,
    detailLoading,
    detailError,
    hasDetailData,
    sessionFillPoint,
    setSessionFillPoint,
  } = params;

  const pokeHistoryTier = useMemo(
    () => marketHistoryTierFromComponents(comp),
    [comp],
  );
  const pokeTierLabel = marketTierDisplayLabel(pokeHistoryTier);

  // Fire market series in parallel with collection detail — both only need the
  // collection key, not the detail response. Guard only on confirmed errors so we
  // don't fetch data for a key that 404s.
  const marketSeriesEnabled = key.length > 0 && !detailError;

  const { data: marketSeries, isLoading: marketSeriesLoading } = useQuery({
    queryKey: rq.collectionMarketSeries(key, MARKET_METRICS_SERIES_DURATION),
    queryFn: () => getCollectionMarketSeries(key, MARKET_METRICS_SERIES_DURATION),
    enabled: marketSeriesEnabled,
    staleTime: marketplaceRqPolicy.marketSeriesStaleMs,
  });

  const gradeChart = useCollectionGradeChart({
    collectionKey: key,
    comp,
    marketSeries,
    marketSeriesLoading,
    marketSeriesEnabled,
  });

  const activeGradeForTrades = gradeChart.activeGrade;

  const marketPreview = marketSeries?.cardhedgerPreview ?? null;

  const { data: platformTradesData, isPending: platformTradesPending, isFetching: platformTradesFetching, isError: platformTradesError, error: platformTradesErrorDetail } = useQuery({
    queryKey: rq.collectionPlatformTrades(key, undefined, activeGradeForTrades),
    queryFn: () => getCollectionPlatformTrades(key, { grade: activeGradeForTrades }),
    enabled: key.length > 0,
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });

  const platformTradesLoading =
    platformTradesPending || (platformTradesFetching && platformTradesData == null);

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
  const chartExternalWindowDays = gradeChart.chartDays;
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

  const resolvedExternal = useMemo(
    () =>
      resolveExternalMarketUsd({
        marketPreview,
        gradePrices: marketSeries?.gradePrices ?? null,
        gradeScore: parseGradeScoreNumber(comp.gradeScore),
        components: comp,
        spotPriceBasis: marketSeries?.spotPriceBasis ?? null,
      }),
    [marketPreview, marketSeries?.gradePrices, marketSeries?.spotPriceBasis, comp.gradeScore, comp],
  );

  const gradeAwareExternalUsd =
    gradeChart.selectedPriceUsd ?? resolvedExternal.usd;
  const gradeAwareChangeResult =
    gradeChart.chartExternalRollingUsd.length >= 2
      ? gradeChart.selectedPriceChangeResult
      : externalPriceChangeResult;
  const gradeAwareChange1MoPct = gradeAwareChangeResult.pct;
  const gradeAwareChangeCoverageHint =
    gradeChart.chartExternalRollingUsd.length >= 2
      ? gradeChart.selectedPriceChangeCoverageHint
      : externalPriceChangeCoverageHint;
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

  const tradeVolumeUsdc = useMemo(() => {
    if (platformTradesData == null && sessionFillPoint == null) return null;
    return computeTradeVolume30dUsdc(
      platformTradesData?.trades ?? [],
      sessionFillPoint,
      COLLECTION_SESSION_FILL_DEDUP_SEC,
    );
  }, [platformTradesData, sessionFillPoint]);

  const psaPopulationMetrics = useMemo(
    () => resolvePsaPopulationMetrics(comp, gradeChart.activeGrade),
    [comp, gradeChart.activeGrade],
  );

  const totalPopulation = useMemo(() => {
    const total = psaPopulationMetrics.totalPsaPop;
    if (total != null) return total;
    const n = comp.psaTotalPopulation;
    if (n == null || !Number.isFinite(Number(n)) || Number(n) <= 0) return null;
    return Math.round(Number(n));
  }, [comp.psaTotalPopulation, psaPopulationMetrics.totalPsaPop]);

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
      marketSeries?.spotPriceBasis === "psa_estimate"
        ? `PSA Estimate shown for ${gradeChart.activeGrade} — no sales history in this window.`
        : `No price history for ${gradeChart.activeGrade} in this window.`,
    isLoading: platformTradesLoading || gradeChart.gradeChartLoading,
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
    tradeVolumeUsdc,
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
