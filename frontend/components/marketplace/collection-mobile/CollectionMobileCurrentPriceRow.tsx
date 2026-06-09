"use client";

import {
  formatReferenceChangePeriodShort,
  formatReferencePercentChange,
  formatUsdCompact,
  isFlatReferencePercentChange,
  NO_EXTERNAL_PRICE,
  REFERENCE_CHANGE_UNAVAILABLE_LABEL,
  referenceChangeTone,
  type ReferencePercentChangeResult,
} from "@/lib/market";

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

/**
 * Mobile collection hero — price + % change on one row (left of cover thumbnail).
 */
export function CollectionMobileCurrentPriceRow({
  priceUsd,
  loading = false,
  changePct,
  changePeriod = null,
  changeLoading = false,
}: {
  /** Cardhedger catalog reference (not Tokenable listing / floor). */
  priceUsd: number | null | undefined;
  loading?: boolean;
  changePct?: number | null;
  changePeriod?: Pick<
    ReferencePercentChangeResult,
    "isFullYear" | "windowSec" | "marketChangeWindow"
  > | null;
  changeLoading?: boolean;
}) {
  const showPrice =
    priceUsd != null && Number.isFinite(priceUsd) && priceUsd > 0;

  const changeOk = changePct != null && Number.isFinite(changePct);
  const changeShowsPct =
    changeOk && !isFlatReferencePercentChange(changePct);
  const changeTone = changeShowsPct ? referenceChangeTone(changePct) : null;
  const changePeriodShort = formatReferenceChangePeriodShort(changePeriod);

  const changeLabel =
    changeLoading && changePct == null
      ? "…"
      : changeOk
        ? formatReferencePercentChange(changePct, 1)
        : REFERENCE_CHANGE_UNAVAILABLE_LABEL;

  const priceClass =
    "text-[1.25rem] font-bold tabular-nums leading-none tracking-tight text-mint sm:text-[1.3rem]";
  const changeClass =
    "text-[1.25rem] font-bold tabular-nums leading-none tracking-tight sm:text-[1.3rem]";

  return (
    <div
      className="flex w-full min-w-0 justify-center pt-3"
      title="External market reference from Cardhedger (eBay strip), not Tokenable list prices"
    >
      <div className="inline-flex min-w-0 max-w-full flex-wrap items-baseline justify-center gap-x-14 gap-y-0.5 sm:gap-x-16">
        {loading && !showPrice ? (
          <span
            className="inline-block h-[1.2rem] w-[5.5rem] max-w-full animate-pulse rounded bg-zinc-800/80"
            aria-hidden
          />
        ) : showPrice ? (
          <span className={priceClass}>{formatUsdCompact(priceUsd)}</span>
        ) : (
          <span className="text-[13px] font-medium tabular-nums text-zinc-500">
            {NO_EXTERNAL_PRICE}
          </span>
        )}
        {showPrice || changeLoading ? (
          <span className="inline-flex min-w-0 shrink-0 items-baseline gap-0.5">
            <span
              className={`${changeClass} ${
                changeTone ? changeToneClass(changeTone) : "text-zinc-400"
              }`}
            >
              {changeLabel}
            </span>
            {changePeriodShort ? (
              <span className={`${changeClass} font-bold text-zinc-500`}>
                {changePeriodShort}
              </span>
            ) : null}
          </span>
        ) : null}
      </div>
    </div>
  );
}
