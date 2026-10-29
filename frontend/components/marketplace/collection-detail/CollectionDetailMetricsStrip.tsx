"use client";

import { useDisplayFx } from "@/components/i18n/DisplayPreferencesProvider";
import { formatMarketCapUsd } from "@/lib/market";
import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
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
  coverComp,
  coverDisplayLabel,
  coverCollectionKey,
  priceUsd,
  priceLoading,
  changePct,
  changeLoading,
  changePeriod,
  gradeLabel,
  volume1yPlatformUsdc,
  volume1yExternalUsd,
  velocityPct,
  tradeVolumeLoading,
  marketCapUsd,
  psaPopulationMetrics,
  totalPopulation,
  omitUnavailableMarket = false,
  embedInChart = false,
}: {
  headlineTitle?: string | null;
  headlineParts?: AssetDetailHeadlineParts | null;
  headlineMeta?: string | null;
  coverImageUrl?: string | null;
  coverComp?: CollectionComponents | null;
  coverDisplayLabel?: string | null;
  coverCollectionKey?: string | null;
  priceUsd: number | null;
  priceLoading: boolean;
  changePct: number | null;
  changeLoading: boolean;
  changePeriod?: ReferencePercentChangeResult | null;
  gradeLabel?: string | null;
  volume1yPlatformUsdc: number | null;
  volume1yExternalUsd: number | null;
  velocityPct?: number | null;
  tradeVolumeLoading: boolean;
  marketCapUsd: number | null;
  psaPopulationMetrics?: PsaPopulationMetrics | null;
  totalPopulation?: number | null;
  omitUnavailableMarket?: boolean;
  embedInChart?: boolean;
}) {
  useDisplayFx(); // re-render on display currency / FX change
  return (
    <div className={`cd-metrics-strip${embedInChart ? " cd-metrics-strip--embed" : ""}`}>
      <CollectionDetailStatMain
        headlineTitle={headlineTitle}
        headlineParts={headlineParts}
        headlineMeta={headlineMeta}
        imageUrl={coverImageUrl}
        coverComp={coverComp}
        coverDisplayLabel={coverDisplayLabel}
        coverCollectionKey={coverCollectionKey}
        priceUsd={priceUsd}
        priceLoading={priceLoading}
        changePct={changePct}
        changeLoading={changeLoading}
        changePeriod={changePeriod}
        gradeLabel={gradeLabel ?? "PSA 10"}
        volume1yPlatformUsdc={volume1yPlatformUsdc}
        volume1yExternalUsd={volume1yExternalUsd}
        velocityPct={velocityPct}
        tradeVolumeLoading={tradeVolumeLoading}
        marketCapUsd={marketCapUsd}
        formatMarketCap={(n) => formatMarketCapUsd(n ?? null)}
        psaPopulationMetrics={psaPopulationMetrics}
        totalPopulation={totalPopulation}
        omitUnavailableMarket={omitUnavailableMarket}
        embedInChart={embedInChart}
      />
    </div>
  );
}
