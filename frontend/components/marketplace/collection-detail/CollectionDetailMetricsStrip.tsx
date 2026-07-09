"use client";

import { formatMarketCapUsd } from "@/lib/market";
import type { PsaPopulationMetrics } from "@/lib/market/gradedCardMarketCap";
import type { ReferencePercentChangeResult } from "@/lib/market/priceChangePeriod";
import { CollectionDetailStatMain } from "./CollectionDetailStatMain";

export function CollectionDetailMetricsStrip({
  coverImageUrl,
  priceUsd,
  priceLoading,
  changePct,
  changeLoading,
  changePeriod,
  gradeLabel,
  tradeVolumeUsdc,
  tradeVolumeLoading,
  marketCapUsd,
  psaPopulationMetrics,
  totalPopulation,
}: {
  coverImageUrl?: string | null;
  priceUsd: number | null;
  priceLoading: boolean;
  changePct: number | null;
  changeLoading: boolean;
  changePeriod?: ReferencePercentChangeResult | null;
  gradeLabel?: string | null;
  tradeVolumeUsdc: number | null;
  tradeVolumeLoading: boolean;
  marketCapUsd: number | null;
  psaPopulationMetrics?: PsaPopulationMetrics | null;
  totalPopulation?: number | null;
}) {
  return (
    <div className="cd-metrics-strip">
      <CollectionDetailStatMain
        imageUrl={coverImageUrl}
        priceUsd={priceUsd}
        priceLoading={priceLoading}
        changePct={changePct}
        changeLoading={changeLoading}
        changePeriod={changePeriod}
        gradeLabel={gradeLabel ?? "PSA 10"}
        tradeVolumeUsdc={tradeVolumeUsdc}
        tradeVolumeLoading={tradeVolumeLoading}
        marketCapUsd={marketCapUsd}
        formatMarketCap={(n) => formatMarketCapUsd(n ?? null)}
        psaPopulationMetrics={psaPopulationMetrics}
        totalPopulation={totalPopulation}
      />
    </div>
  );
}
