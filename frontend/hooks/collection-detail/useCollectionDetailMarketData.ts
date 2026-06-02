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
  resolvePsaPopulationMetrics,
} from "@/lib/market";
import { COLLECTION_SESSION_FILL_DEDUP_SEC } from "@/lib/marketplace/collectionDetailConstants";
import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";

const LIVE_MARKET_LEGEND = "Live market price";

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

  const marketSeriesEnabled =
    key.length > 0 && !detailLoading && !detailError && hasDetailData;

  const { data: marketSeries, isLoading: marketSeriesLoading } = useQuery({
    queryKey: rq.collectionMarketSeries(key, MARKET_METRICS_SERIES_DURATION),
    queryFn: () => getCollectionMarketSeries(key, MARKET_METRICS_SERIES_DURATION),
    enabled: marketSeriesEnabled,
    staleTime: marketplaceRqPolicy.marketSeriesStaleMs,
  });

  const marketPreview = marketSeries?.cardhedgerPreview ?? null;

  const { data: platformTradesData, isLoading: platformTradesLoading } = useQuery({
    queryKey: rq.collectionPlatformTrades(key),
    queryFn: () => getCollectionPlatformTrades(key),
    enabled: key.length > 0,
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });

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

  const chartExternalRollingUsd = marketSeries?.externalUsd ?? [];
  const metricsReferencePts = marketSeries?.externalUsd ?? [];
  const jtHistOk = chartExternalRollingUsd.length >= 2;
  const chartExternalWindowDays = null;
  const chartExternalLegend = jtHistOk
    ? LIVE_MARKET_LEGEND
    : `External market (${pokeTierLabel})`;
  const chartExternalShort = LIVE_MARKET_LEGEND;
  const chartExternalRollingKind: "history" | "snapshot" = jtHistOk
    ? "history"
    : "snapshot";
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
      };
    }
    return percentChangeReferenceBestWindow(externalReferencePtsForChange);
  }, [marketSeries, externalReferencePtsForChange]);

  const externalPriceChangeCoverageHint = useMemo(
    () => formatReferenceChangeCoverageHint(externalPriceChangeResult),
    [externalPriceChangeResult],
  );

  const externalPriceChange1MoPct = externalPriceChangeResult.pct;

  const volume24hUsdc = useMemo(() => {
    const raw = platformTradesData?.trades;
    if (raw == null && sessionFillPoint == null) return null;
    const now = Math.floor(Date.now() / 1000);
    const cutoff = now - 86400;
    let sum = 0;
    for (const row of raw ?? []) {
      if (row.t >= cutoff && Number.isFinite(row.priceUsdc) && row.priceUsdc > 0) {
        sum += row.priceUsdc;
      }
    }
    if (
      sessionFillPoint != null &&
      Number.isFinite(sessionFillPoint.v) &&
      sessionFillPoint.v > 0 &&
      sessionFillPoint.t >= cutoff
    ) {
      const alreadyCounted = (raw ?? []).some(
        (row) =>
          Math.abs(row.priceUsdc - sessionFillPoint.v) < 1e-4 &&
          Math.abs(row.t - sessionFillPoint.t) <= COLLECTION_SESSION_FILL_DEDUP_SEC,
      );
      if (!alreadyCounted) sum += sessionFillPoint.v;
    }
    return sum;
  }, [platformTradesData?.trades, sessionFillPoint]);

  const psaPopulationMetrics = useMemo(
    () => resolvePsaPopulationMetrics(comp),
    [comp],
  );

  const totalPopulation = useMemo(() => {
    const total = psaPopulationMetrics.totalPsaPop;
    if (total != null) return total;
    const n = comp.psaTotalPopulation;
    if (n == null || !Number.isFinite(Number(n)) || Number(n) <= 0) return null;
    return Math.round(Number(n));
  }, [comp.psaTotalPopulation, psaPopulationMetrics.totalPsaPop]);

  const orderBookTapeFills = useMemo((): CollectionPlatformTapeFill[] => {
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

  const resolvedExternal = useMemo(
    () =>
      resolveExternalMarketUsd({
        marketPreview,
        gradePrices: marketSeries?.gradePrices ?? null,
        gradeScore: parseGradeScoreNumber(comp.gradeScore),
        components: comp,
      }),
    [marketPreview, marketSeries?.gradePrices, comp.gradeScore, comp],
  );

  const chartExternalRefTag =
    resolvedExternal.source === "cardhedger"
      ? LIVE_MARKET_LEGEND
      : `External ${pokeTierLabel}`;

  const marketCapComputation = useMemo(
    () =>
      hasCollection && collectionComponents
        ? computeCollectionMarketCapUsd({
            components: collectionComponents,
            gradeScoreStr: comp.gradeScore,
            marketCard: marketPreview?.card ?? null,
            marketMatchConfidence: marketPreview?.matchConfidence,
            gradePrices: marketSeries?.gradePrices ?? null,
            marketPreview: marketPreview ?? null,
          })
        : null,
    [
      hasCollection,
      collectionComponents,
      comp.gradeScore,
      marketPreview,
      marketSeries?.gradePrices,
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

  const chartProps = {
    variant: "markets" as const,
    collectionOverviewMat: true,
    chartTitle: "",
    platformUsd: displayPlatformUsd,
    externalMarketUsd:
      chartExternalRollingUsd.length >= 2 ? null : resolvedExternal.usd,
    externalWindowDays: chartExternalWindowDays,
    externalRollingUsd:
      chartExternalRollingUsd.length > 0 ? chartExternalRollingUsd : null,
    externalRollingKind: chartExternalRollingKind,
    externalLegendLabel: chartExternalLegend,
    externalSeriesShortLabel: chartExternalShort,
    externalRefLineTag: chartExternalRefTag,
    isLoading: platformTradesLoading || marketSeriesLoading,
    errorMessage: null as string | null,
  };

  return {
    marketSeries: marketSeries as CollectionMarketSeries | undefined,
    marketSeriesLoading,
    marketPreview,
    platformTradesLoading,
    pokeTierLabel,
    displayPlatformUsd,
    resolvedExternal,
    marketCapComputation,
    volume24hUsdc,
    totalPopulation,
    psaPopulationMetrics,
    orderBookTapeFills,
    orderBookLastSaleUsdc,
    externalPriceChange1MoPct,
    externalPriceChangeResult,
    externalPriceChangeCoverageHint,
    chartProps,
  };
}
