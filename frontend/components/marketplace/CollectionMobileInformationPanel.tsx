"use client";

import { COLLECTION_DETAILS_BG_CLASS } from "@/components/marketplace/collectionOverviewChrome";
import {
  formatReferencePercentChange,
  isFlatReferencePercentChange,
  MARKET_PRICE_CHANGE_PERIOD_SHORT,
  referenceChangeTone,
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

function InfoStatBox({
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
      className="flex min-w-[4.5rem] flex-1 flex-col items-center justify-center gap-1.5 px-1 py-2 text-center sm:min-w-0 sm:px-2"
      title={title}
    >
      <span className="text-[11px] font-medium uppercase leading-none tracking-wide text-zinc-500">
        {label}
      </span>
      <span
        className={`max-w-full truncate text-[14px] font-bold tabular-nums leading-none ${valueClassName}`}
      >
        {value}
      </span>
    </div>
  );
}

/** Compact single-row stat strip — spot price is in {@link CollectionMobileCurrentPriceRow}. */
export function CollectionMobileInformationPanel({
  changePct,
  changeLoading = false,
  volume24hUsdc,
  volume24hLoading = false,
  marketCapUsd,
  totalPopulation,
  formatMarketCap,
}: {
  changePct?: number | null;
  changeLoading?: boolean;
  volume24hUsdc?: number | null;
  volume24hLoading?: boolean;
  marketCapUsd?: number | null;
  totalPopulation?: number | null;
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
        : "0.0%";

  const capLabel = formatMarketCap(marketCapUsd ?? null);
  const popLabel =
    totalPopulation != null &&
    Number.isFinite(totalPopulation) &&
    totalPopulation > 0
      ? formatPopCompact(totalPopulation)
      : "—";

  return (
    <div className="w-full min-w-0 shrink-0 py-1">
      <div className={`overflow-hidden rounded-xl ${COLLECTION_DETAILS_BG_CLASS}`}>
        <div className="flex min-w-0 divide-x divide-zinc-800/80 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <InfoStatBox
            label={MARKET_PRICE_CHANGE_PERIOD_SHORT}
            value={changeValue}
            valueClassName={
              changeTone ? changeToneClass(changeTone) : "text-zinc-300"
            }
            title={`% change (${MARKET_PRICE_CHANGE_PERIOD_SHORT})`}
          />
          <InfoStatBox
            label="Vol 24h"
            value={
              volume24hLoading && !volReady
                ? "…"
                : formatVolume24h(volReady ? volume24hUsdc : 0)
            }
          />
          <InfoStatBox label="Mkt cap" value={capLabel} title="Market cap" />
          <InfoStatBox label="Pop" value={popLabel} title="PSA population" />
        </div>
      </div>
    </div>
  );
}
