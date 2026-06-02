"use client";

import { useMemo } from "react";
import {
  formatReferenceChangePeriodLabel,
  MARKET_PRICE_CHANGE_PERIOD_LABEL,
} from "@/lib/market";
import { metricVolatilityFromPrices } from "@/lib/marketplace/price-metrics-strip";
import type { CollectionPriceMetricsStripProps } from "@/lib/marketplace/price-metrics-strip";

export function usePriceMetricsStripModel(props: CollectionPriceMetricsStripProps) {
  const {
    externalMarketUsd = null,
    externalPriceSource = null,
    marketTierDisplay = null,
    externalMarketMatchConfidence = null,
    externalPriceLoading = false,
    externalVolatilityCvPct = null,
    volatilityFootnote = null,
    platformPriceSamples = [],
    bookSpreadPct = null,
    externalPriceChangeBasisText = null,
    marketCapUsd = null,
    marketCapMethodHint = null,
    showPriceChange = true,
    showVolatility = true,
    showMarketCap = true,
    showFootnotes = true,
    marketsColumn,
    marketsUnifiedRow = false,
    externalPriceChange1MoPct = null,
    externalPriceChange1MoLoading = false,
    externalPriceChangePeriod = null,
  } = props;

  const changePeriodLabel =
    formatReferenceChangePeriodLabel(externalPriceChangePeriod) ||
    MARKET_PRICE_CHANGE_PERIOD_LABEL;

  const showExternalPrimary =
    externalMarketUsd != null &&
    Number.isFinite(externalMarketUsd) &&
    externalMarketUsd > 0;

  const resolvedUnifiedRow = marketsUnifiedRow;

  const showChartColumn =
    marketsColumn === undefined ? true : marketsColumn === "chart";
  const showTradeColumn =
    marketsColumn === undefined ? true : marketsColumn === "trade";

  const volFromTrades = useMemo(
    () => metricVolatilityFromPrices(platformPriceSamples),
    [platformPriceSamples],
  );
  const volatilityPct =
    externalVolatilityCvPct != null && Number.isFinite(externalVolatilityCvPct)
      ? externalVolatilityCvPct
      : volFromTrades ?? bookSpreadPct;

  const change = externalPriceChange1MoPct;

  const chartSlotCount =
    (showChartColumn ? 1 : 0) + (showChartColumn && showPriceChange ? 1 : 0);
  const tradeSlotCount =
    (showVolatility && showTradeColumn ? 1 : 0) +
    (showMarketCap && showTradeColumn ? 1 : 0);

  const visibleMetricCount =
    marketsColumn === undefined
      ? chartSlotCount + tradeSlotCount
      : marketsColumn === "chart"
        ? chartSlotCount
        : tradeSlotCount;

  const gridClass =
    visibleMetricCount <= 1
      ? "grid-cols-1"
      : visibleMetricCount === 2
        ? "grid-cols-2"
        : visibleMetricCount === 3
          ? "grid-cols-1 min-[480px]:grid-cols-3"
          : "grid-cols-2 sm:grid-cols-4";

  const priceFooterParts: string[] = [];
  if (showFootnotes) {
    if (marketTierDisplay?.trim()) priceFooterParts.push(marketTierDisplay.trim());
    if (externalMarketMatchConfidence === "verified") priceFooterParts.push("Match: verified");
    else if (externalMarketMatchConfidence === "approximate")
      priceFooterParts.push("Match: approximate");
    if (externalPriceSource?.trim()) priceFooterParts.push(externalPriceSource.trim());
  }

  const priceFooterText =
    priceFooterParts.length > 0 ? priceFooterParts.join(" · ") : null;
  const changeBasisText =
    showFootnotes && externalPriceChangeBasisText?.trim()
      ? externalPriceChangeBasisText.trim()
      : null;
  const volFooterText =
    showFootnotes && volatilityFootnote?.trim() ? volatilityFootnote.trim() : null;
  const capFooterText =
    showFootnotes && marketCapMethodHint?.trim() ? marketCapMethodHint.trim() : null;

  return {
    changePeriodLabel,
    showExternalPrimary,
    resolvedUnifiedRow,
    showChartColumn,
    showTradeColumn,
    showPriceChange,
    showVolatility,
    showMarketCap,
    volatilityPct,
    change,
    gridClass,
    priceFooterText,
    changeBasisText,
    volFooterText,
    capFooterText,
    externalPriceLoading,
    externalPriceChange1MoLoading,
    externalMarketUsd,
    marketCapUsd,
  };
}
