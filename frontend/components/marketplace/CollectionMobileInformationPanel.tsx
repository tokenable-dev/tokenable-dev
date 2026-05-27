"use client";

import {
  formatReferenceChangeCoverageHint,
  formatReferenceChangePeriodLabel,
  formatReferenceChangeStatLabel,
  formatReferencePercentChange,
  isFlatReferencePercentChange,
  REFERENCE_CHANGE_UNAVAILABLE_HINT,
  REFERENCE_CHANGE_UNAVAILABLE_LABEL,
  referenceChangeTone,
  type ReferencePercentChangeResult,
} from "@/lib/market";

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

function formatVolume24h(usdc: number): string {
  if (!Number.isFinite(usdc) || usdc <= 0) return "$0";
  if (usdc >= 1_000_000) return `$${(usdc / 1_000_000).toFixed(1)}M`;
  if (usdc >= 1_000) return `$${(usdc / 1_000).toFixed(1)}k`;
  return `$${Math.round(usdc)}`;
}

function formatPopCompact(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m >= 10 ? Math.round(m) : m.toFixed(1)}M`;
  }
  if (n >= 10_000) {
    const k = n / 1_000;
    return `${k >= 100 ? Math.round(k) : k.toFixed(1)}k`;
  }
  return n.toLocaleString("en-US");
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
    <div
      className="flex min-w-[3.25rem] flex-1 flex-col items-center justify-center gap-1 px-0.5 py-1 text-center"
      title={title}
    >
      <span className="text-[11px] font-medium leading-tight text-zinc-500">
        {label}
      </span>
      <span
        className={`max-w-full truncate text-[15px] font-bold tabular-nums leading-tight ${valueClassName}`}
      >
        {value}
      </span>
    </div>
  );
}

/** Compact stat strip — spot price is in {@link CollectionMobileCurrentPriceRow}. */
export function CollectionMobileInformationPanel({
  changePct,
  changePeriod = null,
  changeLoading = false,
  volume24hUsdc,
  volume24hLoading = false,
  marketCapUsd,
  totalPopulation,
  listingCount,
  formatMarketCap,
}: {
  changePct?: number | null;
  changePeriod?: Pick<ReferencePercentChangeResult, "isFullYear" | "windowSec"> | null;
  changeLoading?: boolean;
  volume24hUsdc?: number | null;
  volume24hLoading?: boolean;
  marketCapUsd?: number | null;
  totalPopulation?: number | null;
  listingCount?: number;
  formatMarketCap: (usd: number | null) => string;
}) {
  const changeOk = hasComputedChangePct(changePct);
  const changeShowsPct =
    changeOk && !isFlatReferencePercentChange(changePct);
  const changeTone = changeShowsPct ? referenceChangeTone(changePct) : null;

  const volReady =
    volume24hUsdc != null && Number.isFinite(volume24hUsdc);

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
  const popLabel =
    totalPopulation != null &&
    Number.isFinite(totalPopulation) &&
    totalPopulation > 0
      ? formatPopCompact(totalPopulation)
      : "—";

  const listingLabel =
    listingCount != null && listingCount >= 0
      ? String(listingCount)
      : "—";

  return (
    <div className="w-full min-w-0 shrink-0 py-0.5">
      <div className="mobile-scroll-x-contain flex min-w-0 items-stretch justify-between gap-1 px-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <InfoStatCell label="Listing." value={listingLabel} title="Active listings" />
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
          label="Vol. 24h."
          value={
            volume24hLoading && !volReady
              ? "…"
              : formatVolume24h(volReady ? volume24hUsdc : 0)
          }
        />
        <InfoStatCell label="Mkt cap." value={capLabel} title="Market cap" />
        <InfoStatCell label="Pop." value={popLabel} title="PSA population" />
      </div>
    </div>
  );
}
