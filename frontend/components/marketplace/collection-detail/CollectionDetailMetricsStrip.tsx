"use client";

import { formatMarketCapUsd } from "@/lib/market";
import type { PsaPopulationMetrics } from "@/lib/market/gradedCardMarketCap";
import type { ReferencePercentChangeResult } from "@/lib/market/priceChangePeriod";
import type { AssetDetailHeadlineParts } from "@/lib/marketplace/assetDetailHeadline";
import { CollectionDetailStatMain } from "./CollectionDetailStatMain";

/**
 * Card.html hero — title/meta live inside `#hero-bar` via StatMain.
 * Buy/Bid/Sell are in the right rail (`#tk-trade`), not the hero.
 */
export function CollectionDetailMetricsStrip({
  headlineTitle,
  headlineParts,
  headlineMeta,
  coverImageUrl,
  priceUsd,
  priceLoading,
  changePct,
  changeLoading,
  changePeriod,
  gradeLabel,
  tradeVolumeUsdc,
  velocityPct,
  tradeVolumeLoading,
  marketCapUsd,
  psaPopulationMetrics,
  totalPopulation,
  embedInChart = false,
}: {
  headlineTitle?: string | null;
  headlineParts?: AssetDetailHeadlineParts | null;
  headlineMeta?: string | null;
  coverImageUrl?: string | null;
  priceUsd: number | null;
  priceLoading: boolean;
  changePct: number | null;
  changeLoading: boolean;
  changePeriod?: ReferencePercentChangeResult | null;
  gradeLabel?: string | null;
  tradeVolumeUsdc: number | null;
  velocityPct?: number | null;
  tradeVolumeLoading: boolean;
  marketCapUsd: number | null;
  psaPopulationMetrics?: PsaPopulationMetrics | null;
  totalPopulation?: number | null;
  embedInChart?: boolean;
}) {
  return (
    <div className={`cd-metrics-strip${embedInChart ? " cd-metrics-strip--embed" : ""}`}>
      <CollectionDetailStatMain
        headlineTitle={headlineTitle}
        headlineParts={headlineParts}
        headlineMeta={headlineMeta}
        imageUrl={coverImageUrl}
        priceUsd={priceUsd}
        priceLoading={priceLoading}
        changePct={changePct}
        changeLoading={changeLoading}
        changePeriod={changePeriod}
        gradeLabel={gradeLabel ?? "PSA 10"}
        tradeVolumeUsdc={tradeVolumeUsdc}
        velocityPct={velocityPct}
        tradeVolumeLoading={tradeVolumeLoading}
        marketCapUsd={marketCapUsd}
        formatMarketCap={(n) => formatMarketCapUsd(n ?? null)}
        psaPopulationMetrics={psaPopulationMetrics}
        totalPopulation={totalPopulation}
        embedInChart={embedInChart}
      />
    </div>
  );
}
