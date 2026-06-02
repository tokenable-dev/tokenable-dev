"use client";

import type { CollectionPriceMetricsStripProps } from "@/lib/marketplace/price-metrics-strip";
import { usePriceMetricsStripModel } from "@/hooks/price-metrics-strip";
import { CollectionPriceMetricsStripGrid } from "./CollectionPriceMetricsStripGrid";
import { CollectionPriceMetricsStripUnifiedRow } from "./CollectionPriceMetricsStripUnifiedRow";

export function CollectionPriceMetricsStrip(props: CollectionPriceMetricsStripProps) {
  const model = usePriceMetricsStripModel(props);

  if (model.resolvedUnifiedRow) {
    return (
      <CollectionPriceMetricsStripUnifiedRow
        compact={props.compact ?? false}
        formatMarketCap={props.formatMarketCap}
        volume24hUsdc={props.volume24hUsdc}
        volume24hLoading={props.volume24hLoading}
        totalPopulation={props.totalPopulation}
        model={model}
      />
    );
  }

  return (
    <CollectionPriceMetricsStripGrid
      compact={props.compact ?? false}
      formatMarketCap={props.formatMarketCap}
      model={model}
    />
  );
}
