"use client";

import type { ReactNode } from "react";
import { CollectionDetailMetricsStrip } from "./CollectionDetailMetricsStrip";
import { CollectionHeroMdPanel } from "./CollectionDetailStatMain";
import { CollectionDetailPriceChart } from "./CollectionDetailPriceChart";
import { CollectionDetailMobileScrollPanel } from "./CollectionDetailMobileScrollPanel";
import type { CollectionDualPriceChartProps } from "@/components/marketplace/collection-dual-price-chart";
import { CollectionUnifiedOrderBook } from "@/components/marketplace/unified-order-book";
import type { CollectionUnifiedOrderBookProps } from "@/lib/marketplace/marketplaceTradingTypes";
import type { useCollectionDetailMarketData } from "@/hooks/collection-detail";
import { formatMarketCapUsd } from "@/lib/market";
import type { AssetDetailHeadlineParts } from "@/lib/marketplace/assetDetailHeadline";
import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";

export type CollectionDetailMarketSlice = Pick<
  ReturnType<typeof useCollectionDetailMarketData>,
  | "gradeAwareExternalUsd"
  | "gradeAwareTierLabel"
  | "gradeAwarePriceLoading"
  | "gradeAwareChange1MoPct"
  | "gradeAwareChangeResult"
  | "gradeAwareChangeLoading"
  | "heroTapeStats"
  | "heroTapeLoading"
  | "totalPopulation"
  | "psaPopulationMetrics"
  | "marketCapComputation"
  | "chartProps"
  | "gradeChart"
>;

function metricsStripProps(
  market: CollectionDetailMarketSlice,
  cover: {
    coverImageUrl?: string | null;
    coverComp?: CollectionComponents | null;
    coverDisplayLabel?: string | null;
    coverCollectionKey?: string | null;
  },
) {
  return {
    coverImageUrl: cover.coverImageUrl,
    coverComp: cover.coverComp,
    coverDisplayLabel: cover.coverDisplayLabel,
    coverCollectionKey: cover.coverCollectionKey,
    priceUsd: market.gradeAwareExternalUsd,
    priceLoading: market.gradeAwarePriceLoading,
    changePct: market.gradeAwareChange1MoPct,
    changeLoading: market.gradeAwareChangeLoading,
    changePeriod: market.gradeAwareChangeResult,
    gradeLabel: market.gradeAwareTierLabel,
    tradeVolumeUsdc: market.heroTapeStats.volume1yUsdc,
    velocityPct: market.heroTapeStats.velocityPct,
    tradeVolumeLoading: market.heroTapeLoading,
    marketCapUsd: market.marketCapComputation?.usd ?? null,
    psaPopulationMetrics: market.psaPopulationMetrics,
    totalPopulation: market.totalPopulation,
  };
}

export function buildCollectionDetailMarketsSlots(input: {
  market: CollectionDetailMarketSlice;
  collectionOrderBookProps: CollectionUnifiedOrderBookProps;
  coverImageUrl?: string | null;
  coverComp?: CollectionComponents | null;
  coverDisplayLabel?: string | null;
  coverCollectionKey?: string | null;
  headlineTitle?: string | null;
  headlineParts?: AssetDetailHeadlineParts | null;
  headlineMeta?: string | null;
  similarPanel?: ReactNode;
  detailsPanel?: ReactNode;
}): {
  /** Desktop: null — hero nests inside `#chart-card`. */
  marketsPriceMetricsStrip: ReactNode;
  collectionDualPriceChart: ReactNode;
  collectionDualPriceChartMobile: ReactNode;
  collectionOrderBook: ReactNode;
  collectionOrderBookMobile: ReactNode;
  mobileScrollPanel: ReactNode;
} {
  const {
    market,
    collectionOrderBookProps,
    coverImageUrl,
    coverComp,
    coverDisplayLabel,
    coverCollectionKey,
    headlineTitle,
    headlineParts,
    headlineMeta,
    similarPanel,
    detailsPanel,
  } = input;
  const chartProps = market.chartProps as CollectionDualPriceChartProps;
  const metricsProps = metricsStripProps(market, {
    coverImageUrl,
    coverComp,
    coverDisplayLabel,
    coverCollectionKey,
  });
  const omitUnavailableMarket = coverComp?.assetKind === "sealed_box";
  const renderHero = (embedInChart: boolean) => (
    <CollectionDetailMetricsStrip
      {...metricsProps}
      headlineTitle={headlineTitle}
      headlineParts={omitUnavailableMarket ? null : headlineParts}
      headlineMeta={headlineMeta}
      gradeLabel={omitUnavailableMarket ? "" : metricsProps.gradeLabel}
      omitUnavailableMarket={omitUnavailableMarket}
      embedInChart={embedInChart}
    />
  );

  const chartMdPanel = omitUnavailableMarket ? null : (
    <CollectionHeroMdPanel
      tradeVolumeUsdc={metricsProps.tradeVolumeUsdc}
      tradeVolumeLoading={metricsProps.tradeVolumeLoading}
      marketCapUsd={metricsProps.marketCapUsd}
      formatMarketCap={(n) => formatMarketCapUsd(n ?? null)}
      psaPopulationMetrics={metricsProps.psaPopulationMetrics}
      totalPopulation={metricsProps.totalPopulation}
      velocityPct={metricsProps.velocityPct}
    />
  );

  const collectionDualPriceChart = (
    <CollectionDetailPriceChart
      chartProps={chartProps}
      gradeChart={market.gradeChart}
      heroSlot={renderHero(true)}
      mdPanel={chartMdPanel}
    />
  );

  const collectionDualPriceChartMobile = (
    <CollectionDetailPriceChart
      chartProps={chartProps}
      gradeChart={market.gradeChart}
      mobileLayout
      heroSlot={renderHero(true)}
      mdPanel={chartMdPanel}
    />
  );

  const collectionOrderBookMobile = (
    <CollectionUnifiedOrderBook
      {...collectionOrderBookProps}
      defaultTab="trades"
    />
  );

  return {
    marketsPriceMetricsStrip: null,
    collectionDualPriceChart,
    collectionDualPriceChartMobile,
    collectionOrderBook: (
      <CollectionUnifiedOrderBook {...collectionOrderBookProps} defaultTab="trades" />
    ),
    collectionOrderBookMobile,
    mobileScrollPanel: (
      <CollectionDetailMobileScrollPanel
        chartPanel={collectionDualPriceChartMobile}
        similarPanel={similarPanel}
        orderBookStack={collectionOrderBookMobile}
        detailsPanel={detailsPanel}
      />
    ),
  };
}
