"use client";

import { formatMarketCapUsd } from "@/lib/market";
import type { PsaPopulationMetrics } from "@/lib/market/gradedCardMarketCap";
import type { ReferencePercentChangeResult } from "@/lib/market/priceChangePeriod";
import type { AssetDetailHeadlineParts } from "@/lib/marketplace/assetDetailHeadline";
import { CollectionDetailStatMain } from "./CollectionDetailStatMain";

/**
 * Card.html hero — title/meta live inside `#hero-bar` via StatMain.
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
  median30dUsd,
  tradeVolumeUsdc,
  velocityPct,
  tradeVolumeLoading,
  marketCapUsd,
  psaPopulationMetrics,
  totalPopulation,
  lowestAskUsd,
  highestBidUsd,
  onBuyLowestAsk,
  onPlaceBid,
  buyDisabled,
  bidDisabled,
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
  median30dUsd?: number | null;
  tradeVolumeUsdc: number | null;
  velocityPct?: number | null;
  tradeVolumeLoading: boolean;
  marketCapUsd: number | null;
  psaPopulationMetrics?: PsaPopulationMetrics | null;
  totalPopulation?: number | null;
  lowestAskUsd?: number | null;
  highestBidUsd?: number | null;
  onBuyLowestAsk?: () => void;
  onPlaceBid?: () => void;
  buyDisabled?: boolean;
  bidDisabled?: boolean;
}) {
  return (
    <div className="cd-metrics-strip">
      <CollectionDetailStatMain
        stuckTitle={headlineTitle?.trim() || null}
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
        median30dUsd={median30dUsd}
        tradeVolumeUsdc={tradeVolumeUsdc}
        velocityPct={velocityPct}
        tradeVolumeLoading={tradeVolumeLoading}
        marketCapUsd={marketCapUsd}
        formatMarketCap={(n) => formatMarketCapUsd(n ?? null)}
        psaPopulationMetrics={psaPopulationMetrics}
        totalPopulation={totalPopulation}
        lowestAskUsd={lowestAskUsd}
        highestBidUsd={highestBidUsd}
        onBuyLowestAsk={onBuyLowestAsk}
        onPlaceBid={onPlaceBid}
        buyDisabled={buyDisabled}
        bidDisabled={bidDisabled}
      />
    </div>
  );
}
