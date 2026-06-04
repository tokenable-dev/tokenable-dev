"use client";

import type { ReactNode } from "react";
import type { Order } from "@/lib/core";
import { formatMarketCapUsd } from "@/lib/market";
import { CollectionDualPriceChart } from "@/components/marketplace/collection-dual-price-chart";
import type { CollectionDualPriceChartProps } from "@/components/marketplace/collection-dual-price-chart";
import { CollectionPriceMetricsStrip } from "@/components/marketplace/price-metrics-strip";
import { CollectionUnifiedOrderBook } from "@/components/marketplace/unified-order-book";
import type { CollectionUnifiedOrderBookProps } from "@/lib/marketplace/marketplaceTradingTypes";
import {
  CollectionMobileInformationPanel,
  CollectionMobileListingsSection,
} from "@/components/marketplace/collection-mobile";
import type { useCollectionDetailMarketData } from "@/hooks/collection-detail";

type MarketSlice = Pick<
  ReturnType<typeof useCollectionDetailMarketData>,
  | "resolvedExternal"
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
>;

export function buildCollectionDetailMarketsSlots(input: {
  market: MarketSlice;
  collectionOrderBookProps: CollectionUnifiedOrderBookProps;
}): {
  marketsPriceMetricsStrip: ReactNode;
  collectionDualPriceChart: ReactNode;
  collectionDualPriceChartTab: ReactNode;
  collectionOrderBook: ReactNode;
  collectionOrderBookMobile: ReactNode;
} {
  const { market, collectionOrderBookProps } = input;
  const chartProps = market.chartProps as CollectionDualPriceChartProps;

  return {
    marketsPriceMetricsStrip: (
      <CollectionPriceMetricsStrip
        showFootnotes={false}
        compact
        marketsUnifiedRow
        externalMarketUsd={market.resolvedExternal.usd}
        externalPriceSource={market.resolvedExternal.source}
        marketTierDisplay={market.pokeTierLabel}
        externalMarketMatchConfidence={market.resolvedExternal.marketMatchConfidence}
        externalPriceLoading={market.marketSeriesLoading}
        externalPriceChange1MoPct={market.externalPriceChange1MoPct}
        externalPriceChangePeriod={market.externalPriceChangeResult}
        externalPriceChangeBasisText={market.externalPriceChangeCoverageHint}
        externalPriceChange1MoLoading={market.marketSeriesLoading}
        tradeVolumeUsdc={market.tradeVolumeUsdc}
        tradeVolumeLoading={market.platformTradesLoading}
        psaPopulationMetrics={market.psaPopulationMetrics}
        totalPopulation={market.totalPopulation}
        marketCapUsd={market.marketCapComputation?.usd ?? null}
        marketCapMethodHint={market.marketCapComputation?.methodLabel ?? null}
        formatMarketCap={formatMarketCapUsd}
      />
    ),
    collectionDualPriceChart: <CollectionDualPriceChart {...chartProps} />,
    collectionDualPriceChartTab: <CollectionDualPriceChart {...chartProps} embedInMobileTab />,
    collectionOrderBook: (
      <CollectionUnifiedOrderBook {...collectionOrderBookProps} defaultTab="trades" />
    ),
    collectionOrderBookMobile: (
      <CollectionUnifiedOrderBook {...collectionOrderBookProps} embedInMobileTab />
    ),
  };
}

export function buildCollectionDetailMobilePanels(input: {
  market: MarketSlice;
  asks: Order[];
  listingsBody: ReactNode;
}): {
  mobileInformationPanel: ReactNode;
  mobileListingsPanel: ReactNode;
} {
  const { market, asks, listingsBody } = input;

  return {
    mobileInformationPanel: (
      <CollectionMobileInformationPanel
        changePct={market.externalPriceChange1MoPct}
        changePeriod={market.externalPriceChangeResult}
        changeLoading={market.marketSeriesLoading}
        tradeVolumeUsdc={market.tradeVolumeUsdc}
        tradeVolumeLoading={market.platformTradesLoading}
        marketCapUsd={market.marketCapComputation?.usd ?? null}
        totalPopulation={market.totalPopulation}
        psaPopulationMetrics={market.psaPopulationMetrics}
        listingCount={asks.length}
        formatMarketCap={formatMarketCapUsd}
      />
    ),
    mobileListingsPanel: (
      <CollectionMobileListingsSection count={asks.length}>
        {listingsBody}
      </CollectionMobileListingsSection>
    ),
  };
}
