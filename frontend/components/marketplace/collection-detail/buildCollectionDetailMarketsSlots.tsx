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
import type { AssetDetailHeadlineParts } from "@/lib/marketplace/assetDetailHeadline";

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
  headlineTitle?: string | null;
  headlineParts?: AssetDetailHeadlineParts | null;
  headlineMeta?: string | null;
  mobileListingsBody: ReactNode;
  mobileListingCount?: number;
  detailsPanel?: ReactNode;
  highestBidUsd?: number | null;
  lowestAskUsd?: number | null;
  bidCount?: number;
  onPlaceBid?: () => void;
  placeBidDisabled?: boolean;
  onBuyLowestAsk?: () => void;
  buyDisabled?: boolean;
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
    headlineTitle,
    headlineParts,
    headlineMeta,
    mobileListingsBody,
    mobileListingCount,
    detailsPanel,
    highestBidUsd,
    lowestAskUsd,
    bidCount,
    onPlaceBid,
    placeBidDisabled,
    onBuyLowestAsk,
    buyDisabled,
  } = input;
  const chartProps = market.chartProps as CollectionDualPriceChartProps;
  const metricsProps = metricsStripProps(market, coverImageUrl);
  const renderMetricsStrip = () => (
    <CollectionDetailMetricsStrip
      {...metricsProps}
      headlineTitle={headlineTitle}
      headlineParts={headlineParts}
      headlineMeta={headlineMeta}
      lowestAskUsd={lowestAskUsd}
      highestBidUsd={highestBidUsd}
      onBuyLowestAsk={onBuyLowestAsk}
      onPlaceBid={onPlaceBid}
      buyDisabled={buyDisabled}
      bidDisabled={placeBidDisabled}
    />
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
          <CollectionDetailMobileListingsSection
            listingCount={mobileListingCount}
            highestBidUsd={highestBidUsd}
            bidCount={bidCount}
          >
            {mobileListingsBody}
          </CollectionDetailMobileListingsSection>
        }
        orderBookStack={collectionOrderBookMobile}
        detailsPanel={detailsPanel}
      />
    ),
  };
}
