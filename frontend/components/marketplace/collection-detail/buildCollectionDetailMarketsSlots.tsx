"use client";

import type { ReactNode } from "react";
import { CollectionDetailMetricsStrip } from "./CollectionDetailMetricsStrip";
import { CollectionDetailPriceChart } from "./CollectionDetailPriceChart";
import { CollectionDetailMobileScrollPanel } from "./CollectionDetailMobileScrollPanel";
import { CollectionDetailMobileListingsSection } from "./CollectionDetailMobileListingsSection";
import type { CollectionDualPriceChartProps } from "@/components/marketplace/collection-dual-price-chart";
import { CollectionUnifiedOrderBook } from "@/components/marketplace/unified-order-book";
import type { CollectionUnifiedOrderBookProps } from "@/lib/marketplace/marketplaceTradingTypes";
import type { useCollectionDetailMarketData } from "@/hooks/collection-detail";

export type CollectionDetailMarketSlice = Pick<
  ReturnType<typeof useCollectionDetailMarketData>,
  | "gradeAwareExternalUsd"
  | "gradeAwareTierLabel"
  | "gradeAwarePriceLoading"
  | "gradeAwareChange1MoPct"
  | "gradeAwareChangeResult"
  | "gradeAwareChangeLoading"
  | "tradeVolumeUsdc"
  | "platformTradesLoading"
  | "totalPopulation"
  | "psaPopulationMetrics"
  | "marketCapComputation"
  | "chartProps"
  | "gradeChart"
>;

function metricsStripProps(market: CollectionDetailMarketSlice, coverImageUrl?: string | null) {
  return {
    coverImageUrl,
    priceUsd: market.gradeAwareExternalUsd,
    priceLoading: market.gradeAwarePriceLoading,
    changePct: market.gradeAwareChange1MoPct,
    changeLoading: market.gradeAwareChangeLoading,
    changePeriod: market.gradeAwareChangeResult,
    gradeLabel: market.gradeAwareTierLabel,
    tradeVolumeUsdc: market.tradeVolumeUsdc,
    tradeVolumeLoading: market.platformTradesLoading,
    marketCapUsd: market.marketCapComputation?.usd ?? null,
    psaPopulationMetrics: market.psaPopulationMetrics,
    totalPopulation: market.totalPopulation,
  };
}

export function buildCollectionDetailMarketsSlots(input: {
  market: CollectionDetailMarketSlice;
  collectionOrderBookProps: CollectionUnifiedOrderBookProps;
  coverImageUrl?: string | null;
  mobileListingsBody: ReactNode;
  mobileListingCount?: number;
  detailsPanel?: ReactNode;
}): {
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
    mobileListingsBody,
    mobileListingCount,
    detailsPanel,
  } = input;
  const chartProps = market.chartProps as CollectionDualPriceChartProps;
  const metricsProps = metricsStripProps(market, coverImageUrl);
  const renderMetricsStrip = () => (
    <CollectionDetailMetricsStrip {...metricsProps} />
  );

  const collectionDualPriceChartMobile = (
    <CollectionDetailPriceChart
      chartProps={chartProps}
      gradeChart={market.gradeChart}
      mobileLayout
    />
  );

  const collectionOrderBookMobile = (
    <CollectionUnifiedOrderBook
      {...collectionOrderBookProps}
      defaultTab="trades"
      embedInMobileTab
    />
  );

  return {
    marketsPriceMetricsStrip: renderMetricsStrip(),
    collectionDualPriceChart: (
      <CollectionDetailPriceChart chartProps={chartProps} gradeChart={market.gradeChart} />
    ),
    collectionDualPriceChartMobile,
    collectionOrderBook: (
      <CollectionUnifiedOrderBook {...collectionOrderBookProps} defaultTab="trades" />
    ),
    collectionOrderBookMobile,
    mobileScrollPanel: (
      <CollectionDetailMobileScrollPanel
        statBlock={renderMetricsStrip()}
        chartPanel={collectionDualPriceChartMobile}
        listingsPanel={
          <CollectionDetailMobileListingsSection listingCount={mobileListingCount}>
            {mobileListingsBody}
          </CollectionDetailMobileListingsSection>
        }
        orderBookStack={collectionOrderBookMobile}
        detailsPanel={detailsPanel}
      />
    ),
  };
}
