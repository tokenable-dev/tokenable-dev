"use client";

import {
  formatReferenceChangeCoverageHint,
  formatReferenceChangePeriodLabel,
  formatReferenceChangeStatLabel,
  formatReferencePercentChange,
  formatPsaPopulationCompact,
  formatPsaPopulationCount,
  isFlatReferencePercentChange,
  REFERENCE_CHANGE_UNAVAILABLE_HINT,
  REFERENCE_CHANGE_UNAVAILABLE_LABEL,
  referenceChangeTone,
  type ReferencePercentChangeResult,
} from "@/lib/market";
import type { PsaPopulationMetrics } from "@/lib/market/gradedCardMarketCap";

function hasComputedChangePct(
  changePct: number | null | undefined,
): changePct is number {
  return changePct != null && Number.isFinite(changePct);
}

function changeToneClass(tone: ReturnType<typeof referenceChangeTone>): string {
  switch (tone) {
    case "up":
      return "text-mint";
    case "down":
      return "text-rose-400";
    default:
      return "text-zinc-400";
  }
}

function formatTradeVolume(usdc: number): string {
  if (!Number.isFinite(usdc) || usdc <= 0) return "$0";
  if (usdc >= 1_000_000) return `$${(usdc / 1_000_000).toFixed(1)}M`;
  if (usdc >= 1_000) return `$${(usdc / 1_000).toFixed(1)}k`;
  return `$${Math.round(usdc)}`;
}

function InfoStatCell({
  label,
  value,
  valueClassName = "text-white",
  title,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  title?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5" title={title}>
      <span className="text-[clamp(10px,2.8vw,11px)] font-medium leading-tight text-zinc-500">
        {label}
      </span>
      <span
        className={`min-w-0 truncate text-[clamp(13px,3.6vw,15px)] font-bold tabular-nums leading-tight ${valueClassName}`}
      >
        {value}
      </span>
    </div>
  );
}

/** Compact stat grid — spot price lives in {@link CollectionMobileCurrentPriceRow}. */
export function CollectionMobileInformationPanel({
  changePct,
  changePeriod = null,
  changeLoading = false,
  tradeVolumeUsdc,
  tradeVolumeLoading = false,
  marketCapUsd,
  totalPopulation,
  psaPopulationMetrics = null,
  listingCount,
  formatMarketCap,
}: {
  changePct?: number | null;
  changePeriod?: Pick<
    ReferencePercentChangeResult,
    "isFullYear" | "windowSec" | "marketChangeWindow"
  > | null;
  changeLoading?: boolean;
  tradeVolumeUsdc?: number | null;
  tradeVolumeLoading?: boolean;
  marketCapUsd?: number | null;
  totalPopulation?: number | null;
  psaPopulationMetrics?: PsaPopulationMetrics | null;
  listingCount?: number;
  formatMarketCap: (usd: number | null) => string;
}) {
  const changeOk = hasComputedChangePct(changePct);
  const changeShowsPct =
    changeOk && !isFlatReferencePercentChange(changePct);
  const changeTone = changeShowsPct ? referenceChangeTone(changePct) : null;

  const volReady =
    tradeVolumeUsdc != null && Number.isFinite(tradeVolumeUsdc);

  const changeValue =
    changeLoading && changePct == null
      ? "…"
      : changeOk
        ? formatReferencePercentChange(changePct, 0)
        : REFERENCE_CHANGE_UNAVAILABLE_LABEL;

  const changeStatLabel = formatReferenceChangeStatLabel(changePeriod);
  const changePeriodLong = formatReferenceChangePeriodLabel(changePeriod);
  const changeCoverageHint = formatReferenceChangeCoverageHint(changePeriod);

  const capLabel = formatMarketCap(marketCapUsd ?? null);

  const gradeLabel = psaPopulationMetrics?.gradeLabel ?? "PSA 10";
  const gradePopRaw = psaPopulationMetrics?.gradePop ?? psaPopulationMetrics?.psa10Pop ?? null;
  const psaTotalRaw =
    psaPopulationMetrics?.totalPsaPop ??
    (totalPopulation != null && Number.isFinite(totalPopulation) && totalPopulation > 0
      ? totalPopulation
      : null);

  const listingLabel =
    listingCount != null && listingCount >= 0 ? String(listingCount) : "—";

  return (
    <div className="w-full min-w-0 shrink-0">
      <div className="grid grid-cols-2 gap-x-2 gap-y-3 px-0.5 min-[360px]:gap-x-3 sm:gap-x-4">
        <InfoStatCell
          label={changeStatLabel}
          value={changeValue}
          valueClassName={
            changeTone ? changeToneClass(changeTone) : "text-zinc-300"
          }
          title={
            changeOk
              ? `% change (${changePeriodLong}) — ${changeCoverageHint}`
              : REFERENCE_CHANGE_UNAVAILABLE_HINT
          }
        />
        <InfoStatCell
          label="Volume 30d"
          value={
            tradeVolumeLoading && !volReady
              ? "…"
              : formatTradeVolume(volReady ? tradeVolumeUsdc : 0)
          }
        />
        <InfoStatCell label="Market cap" value={capLabel} title="Market cap" />
        <InfoStatCell
          label="Listings"
          value={listingLabel}
          title="Active listings in this collection"
        />
        <InfoStatCell
          label={`${gradeLabel} Pop`}
          value={formatPsaPopulationCompact(gradePopRaw)}
          title={
            gradePopRaw != null ? formatPsaPopulationCount(gradePopRaw) : undefined
          }
        />
        <InfoStatCell
          label="Total PSA Pop"
          value={formatPsaPopulationCompact(psaTotalRaw)}
          title={
            psaTotalRaw != null ? formatPsaPopulationCount(psaTotalRaw) : undefined
          }
        />
      </div>
    </div>
  );
}
