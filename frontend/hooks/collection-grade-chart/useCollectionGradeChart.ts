"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getCollectionGradeCatalog,
  getCollectionGradePriceSeries,
  rq,
  marketplaceRqPolicy,
  type CollectionGradeCatalogEntry,
  type CollectionMarketSeries,
  type CollectionUsdPoint,
} from "@/lib/core";
import {
  formatReferenceChangeCoverageHint,
  marketHistoryTierFromComponents,
  marketTierDisplayLabel,
  percentChangeReferenceBestWindow,
} from "@/lib/market";
import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import {
  COLLECTION_GRADE_CHART_DEFAULT_DAYS,
  type CollectionGradeChartDays,
  filterCollectionUsdPointsByDays,
} from "@/lib/marketplace/collection-grade-chart/constants";
import {
  buildPsaChartGradeOptions,
  coercePsaChartGradeLabel,
  isPsaChartGradeLabel,
} from "@/lib/marketplace/collection-grade-chart/psaChartGrades";

function normalizeGradeLabel(raw: string | null | undefined): string {
  return String(raw ?? "").trim();
}

function gradesMatch(a: string, b: string): boolean {
  return normalizeGradeLabel(a).toLowerCase() === normalizeGradeLabel(b).toLowerCase();
}

function defaultSlabGradeLabel(
  marketSeries: CollectionMarketSeries | undefined,
  comp: CollectionComponents,
): string {
  const fromSeries = normalizeGradeLabel(marketSeries?.collectionGrade);
  if (fromSeries) return fromSeries;
  const tier = marketHistoryTierFromComponents(comp);
  return marketTierDisplayLabel(tier);
}

export function useCollectionGradeChart(input: {
  collectionKey: string;
  comp: CollectionComponents;
  marketSeries: CollectionMarketSeries | undefined;
  marketSeriesLoading: boolean;
  marketSeriesEnabled: boolean;
}) {
  const { collectionKey, comp, marketSeries, marketSeriesLoading, marketSeriesEnabled } =
    input;

  const slabGrade = useMemo(
    () => defaultSlabGradeLabel(marketSeries, comp),
    [marketSeries, comp],
  );

  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [chartDays, setChartDays] = useState<CollectionGradeChartDays>(
    COLLECTION_GRADE_CHART_DEFAULT_DAYS,
  );

  useEffect(() => {
    setSelectedGrade(null);
    setChartDays(COLLECTION_GRADE_CHART_DEFAULT_DAYS);
  }, [collectionKey]);

  const activeGradeRaw = normalizeGradeLabel(selectedGrade) || slabGrade;
  const activeGrade = isPsaChartGradeLabel(activeGradeRaw)
    ? activeGradeRaw
    : coercePsaChartGradeLabel(slabGrade) ?? "PSA 10";

  const catalogFromSeries = marketSeries?.allGradePrices ?? [];
  const needsCatalogFetch =
    marketSeriesEnabled &&
    collectionKey.length > 0 &&
    catalogFromSeries.length === 0;

  const catalogQuery = useQuery({
    queryKey: rq.collectionGradeCatalog(collectionKey, false),
    queryFn: () => getCollectionGradeCatalog(collectionKey),
    enabled: needsCatalogFetch,
    staleTime: marketplaceRqPolicy.marketSeriesStaleMs,
  });

  const catalogEntries = useMemo((): CollectionGradeCatalogEntry[] => {
    const raw =
      catalogFromSeries.length > 0
        ? catalogFromSeries
        : (catalogQuery.data?.grades ?? []);
    return raw.filter((e) => isPsaChartGradeLabel(e.grade));
  }, [catalogFromSeries, catalogQuery.data?.grades]);

  const gradeOptions = useMemo(
    () => buildPsaChartGradeOptions(slabGrade),
    [slabGrade],
  );

  useEffect(() => {
    if (
      selectedGrade != null &&
      !gradeOptions.some((g) => gradesMatch(g, selectedGrade))
    ) {
      setSelectedGrade(null);
    }
  }, [gradeOptions, selectedGrade]);

  const snapshotPts = marketSeries?.externalUsd ?? [];
  const preferSnapshot =
    gradesMatch(activeGrade, slabGrade) && snapshotPts.length >= 2;

  const gradeSeriesQuery = useQuery({
    queryKey: rq.collectionGradeSeries(collectionKey, activeGrade, chartDays),
    queryFn: () =>
      getCollectionGradePriceSeries(collectionKey, activeGrade, chartDays),
    enabled:
      marketSeriesEnabled &&
      collectionKey.length > 0 &&
      activeGrade.length > 0 &&
      !preferSnapshot,
    staleTime: marketplaceRqPolicy.marketSeriesStaleMs,
  });

  const chartExternalRollingUsd = useMemo((): CollectionUsdPoint[] => {
    if (preferSnapshot) {
      return filterCollectionUsdPointsByDays(snapshotPts, chartDays);
    }
    const live = gradeSeriesQuery.data?.points ?? [];
    if (live.length > 0) return live;
    if (snapshotPts.length > 0 && gradesMatch(activeGrade, slabGrade)) {
      return filterCollectionUsdPointsByDays(snapshotPts, chartDays);
    }
    return [];
  }, [
    preferSnapshot,
    snapshotPts,
    chartDays,
    gradeSeriesQuery.data?.points,
    activeGrade,
    slabGrade,
  ]);

  const chartExternalLegend = `Live market · ${activeGrade}`;
  const chartExternalShort = activeGrade;
  const chartExternalRefTag = activeGrade;

  const gradeChartLoading =
    marketSeriesLoading ||
    (needsCatalogFetch && catalogQuery.isLoading) ||
    (!preferSnapshot &&
      (gradeSeriesQuery.isLoading ||
        (gradeSeriesQuery.isFetching && chartExternalRollingUsd.length === 0)));

  const selectedCatalogEntry = catalogEntries.find((e) =>
    gradesMatch(e.grade, activeGrade),
  );

  const selectedPriceUsd = useMemo((): number | null => {
    const catalog = selectedCatalogEntry?.priceUsd;
    if (catalog != null && Number.isFinite(catalog) && catalog > 0) return catalog;
    if (chartExternalRollingUsd.length > 0) {
      const last = chartExternalRollingUsd[chartExternalRollingUsd.length - 1]!.v;
      if (Number.isFinite(last) && last > 0) return last;
    }
    return null;
  }, [selectedCatalogEntry?.priceUsd, chartExternalRollingUsd]);

  const selectedPriceChangeResult = useMemo(
    () => percentChangeReferenceBestWindow(chartExternalRollingUsd),
    [chartExternalRollingUsd],
  );

  const selectedPriceChangeCoverageHint = useMemo(
    () => formatReferenceChangeCoverageHint(selectedPriceChangeResult),
    [selectedPriceChangeResult],
  );

  const isViewingSlabGrade = gradesMatch(activeGrade, slabGrade);

  return {
    slabGrade,
    activeGrade,
    selectedGrade: selectedGrade ?? slabGrade,
    setSelectedGrade,
    chartDays,
    setChartDays,
    gradeOptions,
    catalogEntries,
    selectedCatalogEntry,
    selectedPriceUsd,
    selectedPriceChangeResult,
    selectedPriceChangeCoverageHint,
    selectedPriceChange1MoPct: selectedPriceChangeResult.pct,
    isViewingSlabGrade,
    chartExternalRollingUsd,
    chartExternalLegend,
    chartExternalShort,
    chartExternalRefTag,
    gradeChartLoading,
    preferSnapshot,
    catalogLoading: needsCatalogFetch && catalogQuery.isLoading,
  };
}
