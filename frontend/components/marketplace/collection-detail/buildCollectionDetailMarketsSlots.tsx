"use client";

import type { ReactNode } from "react";
import type { Order } from "@/lib/core";
import { formatMarketCapUsd } from "@/lib/market";
import { CollectionDetailStatMain } from "@/components/marketplace/collection-detail/CollectionDetailStatMain";
import { CollectionDetailPriceChart } from "@/components/marketplace/collection-detail/CollectionDetailPriceChart";
import type { CollectionDualPriceChartProps } from "@/components/marketplace/collection-dual-price-chart";
import { CollectionUnifiedOrderBook } from "@/components/marketplace/unified-order-book";
import type { CollectionUnifiedOrderBookProps } from "@/lib/marketplace/marketplaceTradingTypes";
import {
  CollectionDetailMobileScrollPanel,
  CollectionMobileHeroStatsStrip,
  CollectionMobileListingsSection,
} from "@/components/marketplace/collection-mobile";
import type { useCollectionDetailMarketData } from "@/hooks/collection-detail";

type MarketSlice = Pick<
  ReturnType<typeof useCollectionDetailMarketData>,
  | "resolvedExternal"
  | "gradeAwareExternalUsd"
  | "gradeAwareTierLabel"
  | "gradeAwarePriceLoading"
  | "gradeAwareChange1MoPct"
  | "gradeAwareChangeResult"
  | "gradeAwareChangeCoverageHint"
  | "gradeAwareChangeLoading"
  | "pokeTierLabel"
  | "marketSeriesLoading"
  | "externalPriceChange1MoPct"
  | "externalPriceChangeResult"
  | "externalPriceChangeCoverageHint"
  | "tradeVolumeUsdc"
  | "platformTradesLoading"
  | "totalPopulation"
  | "psaPopulationMetrics"
  | "marketCapComputation"
  | "chartProps"
  | "gradeChart"
>;

export function buildCollectionDetailMarketsSlots(input: {
  market: MarketSlice;
  collectionOrderBookProps: CollectionUnifiedOrderBookProps;
  coverImageUrl?: string | null;
}): {
  marketsPriceMetricsStrip: ReactNode;
  collectionDualPriceChart: ReactNode;
  collectionDualPriceChartTab: ReactNode;
  collectionOrderBook: ReactNode;
  collectionOrderBookMobile: ReactNode;
} {
  const { market, collectionOrderBookProps, coverImageUrl } = input;
  const chartProps = market.chartProps as CollectionDualPriceChartProps;

  return {
    marketsPriceMetricsStrip: (
      <div className="cd-metrics-strip">
        <CollectionDetailStatMain
          imageUrl={coverImageUrl}
          priceUsd={market.gradeAwareExternalUsd}
          priceLoading={market.gradeAwarePriceLoading}
          changePct={market.gradeAwareChange1MoPct}
          changeLoading={market.gradeAwareChangeLoading}
          changePeriod={market.gradeAwareChangeResult}
          gradeLabel={market.gradeAwareTierLabel}
          tradeVolumeUsdc={market.tradeVolumeUsdc}
          tradeVolumeLoading={market.platformTradesLoading}
          marketCapUsd={market.marketCapComputation?.usd ?? null}
          formatMarketCap={(n) => formatMarketCapUsd(n ?? null)}
          psaPopulationMetrics={market.psaPopulationMetrics}
          totalPopulation={market.totalPopulation}
        />
      </div>
    ),
    collectionDualPriceChart: (
      <CollectionDetailPriceChart chartProps={chartProps} gradeChart={market.gradeChart} />
    ),
    collectionDualPriceChartTab: (
      <CollectionDetailPriceChart
        chartProps={chartProps}
        gradeChart={market.gradeChart}
        embedInMobileTab
      />
    ),
    collectionOrderBook: (
      <CollectionUnifiedOrderBook {...collectionOrderBookProps} defaultTab="trades" />
    ),
    collectionOrderBookMobile: (
      <CollectionUnifiedOrderBook
        {...collectionOrderBookProps}
        defaultTab="trades"
        embedInMobileTab
      />
    ),
  };
}

export function buildCollectionDetailMobilePanels(input: {
  market: MarketSlice;
  listingsBody: ReactNode;
  chartPanel: ReactNode;
  orderBookStack: ReactNode;
}): {
  mobileHeroStatsRow: ReactNode;
  mobileScrollPanel: ReactNode;
} {
  const { market, listingsBody, chartPanel, orderBookStack } = input;

  return {
    mobileHeroStatsRow: (
      <CollectionMobileHeroStatsStrip
        tradeVolumeUsdc={market.tradeVolumeUsdc}
        tradeVolumeLoading={market.platformTradesLoading}
        marketCapUsd={market.marketCapComputation?.usd ?? null}
        totalPopulation={market.totalPopulation}
        psaPopulationMetrics={market.psaPopulationMetrics}
        formatMarketCap={formatMarketCapUsd}
      />
    ),
    mobileScrollPanel: (
      <CollectionDetailMobileScrollPanel
        chartPanel={chartPanel}
        listingsPanel={
          <CollectionMobileListingsSection>{listingsBody}</CollectionMobileListingsSection>
        }
        orderBookStack={orderBookStack}
      />
    ),
  };
}
