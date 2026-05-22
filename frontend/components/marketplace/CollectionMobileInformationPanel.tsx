"use client";

import {
  formatReferencePercentChange,
  formatUsdCompact,
  isFlatReferencePercentChange,
  MARKET_PRICE_CHANGE_PERIOD_LABEL,
  NO_EXTERNAL_PRICE,
  referenceChangeTone,
} from "@/lib/market";

const STAT_EM_DASH = "—";

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
  if (!Number.isFinite(usdc) || usdc <= 0) return "$0.00";
  if (usdc >= 1_000_000) return `$${(usdc / 1_000_000).toFixed(2)}M`;
  if (usdc >= 1_000) return `$${(usdc / 1_000).toFixed(2)}k`;
  return usdc.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function StatCell({
  label,
  value,
  valueClassName = "text-white",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-[11px] font-medium leading-snug text-zinc-500">
        {label}
      </span>
      <span
        className={`text-[1.125rem] font-bold tabular-nums leading-tight ${valueClassName}`}
      >
        {value}
      </span>
    </div>
  );
}

export function CollectionMobileInformationPanel({
  /** Cardhedger reference spot — same source as the Current Price row above the tabs. */
  referenceMarketUsd,
  referenceMarketLoading = false,
  changePct,
  changeLoading = false,
  volume24hUsdc,
  volume24hLoading = false,
  marketCapUsd,
  totalPopulation,
  formatMarketCap,
}: {
  referenceMarketUsd?: number | null;
  referenceMarketLoading?: boolean;
  changePct?: number | null;
  changeLoading?: boolean;
  volume24hUsdc?: number | null;
  volume24hLoading?: boolean;
  marketCapUsd?: number | null;
  totalPopulation?: number | null;
  formatMarketCap: (usd: number | null) => string;
}) {
  const referenceOk =
    referenceMarketUsd != null &&
    Number.isFinite(referenceMarketUsd) &&
    referenceMarketUsd > 0;

  const changeOk = hasComputedChangePct(changePct);
  const changeShowsPct =
    changeOk && !isFlatReferencePercentChange(changePct);
  const changeTone = changeShowsPct ? referenceChangeTone(changePct) : null;

  const volReady =
    volume24hUsdc != null && Number.isFinite(volume24hUsdc);

  const capLabel = formatMarketCap(marketCapUsd ?? null);
  const popLabel =
    totalPopulation != null &&
    Number.isFinite(totalPopulation) &&
    totalPopulation > 0
      ? totalPopulation.toLocaleString("en-US")
      : "—";

  return (
    <div className="w-full min-w-0 px-4 py-2 sm:px-5">
      <div className="flex min-w-0 flex-col gap-2 text-left">
        <p className="text-[11px] font-medium text-zinc-500">Last Market Price</p>
        {referenceMarketLoading && !referenceOk ? (
          <span
            className="inline-block h-8 w-28 animate-pulse rounded bg-zinc-800/80"
            aria-hidden
          />
        ) : referenceOk ? (
          <p className="text-[1.75rem] font-bold tabular-nums tracking-tight text-white">
            {formatUsdCompact(referenceMarketUsd)}
          </p>
        ) : (
          <p className="text-[1.75rem] font-bold tabular-nums tracking-tight text-zinc-500">
            {NO_EXTERNAL_PRICE}
          </p>
        )}
      </div>

      <div className="mt-6 grid w-full grid-cols-2 gap-x-8 gap-y-6 sm:gap-x-12">
        <StatCell
          label={`% Change ${MARKET_PRICE_CHANGE_PERIOD_LABEL}`}
          value={
            changeLoading && changePct == null
              ? "…"
              : changeShowsPct
                ? formatReferencePercentChange(changePct, 0)
                : STAT_EM_DASH
          }
          valueClassName={
            changeTone ? changeToneClass(changeTone) : "text-zinc-400"
          }
        />
        <StatCell
          label="Volume 24H"
          value={
            volume24hLoading && !volReady
              ? "…"
              : formatVolume24h(volReady ? volume24hUsdc : 0)
          }
          valueClassName="text-white"
        />
        <StatCell label="Market Cap" value={capLabel} />
        <StatCell label="Pop" value={popLabel} />
      </div>
    </div>
  );
}
