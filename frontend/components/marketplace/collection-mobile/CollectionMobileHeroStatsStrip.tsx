"use client";

import {
  formatPsaPopulationCompact,
  formatPsaPopulationCount,
  formatPsaGradePopPairTitle,
  formatPsaGradePopTileLabel,
} from "@/lib/market";
import type { PsaPopulationMetrics } from "@/lib/market/gradedCardMarketCap";

function HeroStatCell({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 text-left" title={title}>
      <span className="text-[clamp(10px,2.7vw,12px)] font-medium leading-tight text-zinc-500">
        {label}
      </span>
      <span className="min-w-0 truncate text-[clamp(12px,3.5vw,16px)] font-bold tabular-nums leading-tight text-white">
        {value}
      </span>
    </div>
  );
}

function formatTradeVolume(usdc: number): string {
  if (!Number.isFinite(usdc) || usdc <= 0) return "$0.00";
  if (usdc >= 1_000_000) return `$${(usdc / 1_000_000).toFixed(1)}M`;
  if (usdc >= 1_000) return `$${(usdc / 1_000).toFixed(1)}k`;
  return `$${usdc.toFixed(2)}`;
}

/** Hero strip under price — Volume 30d · Market cap · PSA 10 / Pop (mockup 3-up). */
export function CollectionMobileHeroStatsStrip({
  tradeVolumeUsdc,
  tradeVolumeLoading = false,
  marketCapUsd,
  formatMarketCap,
  totalPopulation,
  psaPopulationMetrics = null,
}: {
  tradeVolumeUsdc?: number | null;
  tradeVolumeLoading?: boolean;
  marketCapUsd?: number | null;
  formatMarketCap: (usd: number | null) => string;
  totalPopulation?: number | null;
  psaPopulationMetrics?: PsaPopulationMetrics | null;
}) {
  const volReady =
    tradeVolumeUsdc != null && Number.isFinite(tradeVolumeUsdc);

  const gradeLabel = psaPopulationMetrics?.gradeLabel ?? "PSA 10";
  const gradePopRaw = psaPopulationMetrics?.gradePop ?? psaPopulationMetrics?.psa10Pop ?? null;
  const psaTotalRaw =
    psaPopulationMetrics?.totalPsaPop ??
    (totalPopulation != null && Number.isFinite(totalPopulation) && totalPopulation > 0
      ? totalPopulation
      : null);

  const gradePopLabel = formatPsaPopulationCompact(gradePopRaw);
  const psaTotalLabel = formatPsaPopulationCompact(psaTotalRaw);
  const psaCombined =
    gradePopRaw != null && psaTotalRaw != null
      ? `${gradePopLabel} / ${psaTotalLabel}`
      : gradePopRaw != null
        ? gradePopLabel
        : psaTotalRaw != null
          ? psaTotalLabel
          : "—";

  const psaTitle = formatPsaGradePopPairTitle(
    gradeLabel,
    gradePopRaw,
    psaTotalRaw,
    formatPsaPopulationCount,
  );

  return (
    <div className="grid w-full min-w-0 grid-cols-3 gap-x-1 gap-y-0 min-[360px]:gap-x-1.5 sm:gap-x-2">
      <HeroStatCell
        label="Volume 30d"
        value={
          tradeVolumeLoading && !volReady
            ? "…"
            : formatTradeVolume(volReady ? tradeVolumeUsdc : 0)
        }
      />
      <HeroStatCell
        label="Market cap"
        value={formatMarketCap(marketCapUsd ?? null)}
        title="Market cap"
      />
      <HeroStatCell
        label={formatPsaGradePopTileLabel(gradeLabel)}
        value={psaCombined}
        title={psaTitle}
      />
    </div>
  );
}
