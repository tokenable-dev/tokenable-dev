"use client";

import {
  formatPsaPopulationCompact,
  formatPsaPopulationCount,
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
    <div className="flex min-w-0 flex-col gap-1 text-left" title={title}>
      <span className="text-[11px] font-medium leading-tight text-zinc-500 sm:text-[12px]">
        {label}
      </span>
      <span className="min-w-0 truncate text-[15px] font-bold tabular-nums leading-tight text-white sm:text-[16px]">
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

  const psa10Raw = psaPopulationMetrics?.psa10Pop ?? null;
  const psaTotalRaw =
    psaPopulationMetrics?.totalPsaPop ??
    (totalPopulation != null && Number.isFinite(totalPopulation) && totalPopulation > 0
      ? totalPopulation
      : null);

  const psa10Label = formatPsaPopulationCompact(psa10Raw);
  const psaTotalLabel = formatPsaPopulationCompact(psaTotalRaw);
  const psaCombined =
    psa10Raw != null && psaTotalRaw != null
      ? `${psa10Label} / ${psaTotalLabel}`
      : psa10Raw != null
        ? psa10Label
        : psaTotalRaw != null
          ? psaTotalLabel
          : "—";

  const psaTitle =
    psa10Raw != null || psaTotalRaw != null
      ? [
          psa10Raw != null ? `PSA 10: ${formatPsaPopulationCount(psa10Raw)}` : null,
          psaTotalRaw != null ? `Total: ${formatPsaPopulationCount(psaTotalRaw)}` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : undefined;

  return (
    <div className="grid w-full min-w-0 grid-cols-3 gap-x-2 gap-y-0">
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
      <HeroStatCell label="PSA 10 / Pop" value={psaCombined} title={psaTitle} />
    </div>
  );
}
