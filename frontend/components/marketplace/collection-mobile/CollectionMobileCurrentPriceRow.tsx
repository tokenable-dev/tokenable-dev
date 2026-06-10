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
    "shrink-0 font-bold tabular-nums leading-none tracking-tight text-mint text-[clamp(1.05rem,4.5vw,1.3rem)]";
  const changeClass =
    "min-w-0 font-bold tabular-nums leading-none tracking-tight text-[clamp(1.05rem,4.5vw,1.3rem)]";
  const changePeriodClass =
    "shrink-0 font-bold tabular-nums leading-none tracking-tight text-[clamp(1.05rem,4.5vw,1.3rem)] text-zinc-500";

  return (
    <div
      className="flex w-full min-w-0 justify-center py-3 sm:py-3.5"
      title="External market reference from Cardhedger (eBay strip), not Tokenable list prices"
    >
      <div className="inline-flex max-w-full min-w-0 flex-wrap items-baseline justify-center gap-x-3 gap-y-0.5 min-[360px]:gap-x-4 sm:gap-x-5">
        {loading && !showPrice ? (
          <span
            className="inline-block h-[1.15rem] w-[4.75rem] shrink-0 animate-pulse rounded bg-zinc-800/80"
            aria-hidden
          />
        ) : showPrice ? (
          <span className={priceClass}>{formatUsdCompact(priceUsd)}</span>
        ) : (
          <span className="shrink-0 text-[clamp(12px,3.2vw,13px)] font-medium tabular-nums text-zinc-500">
            {NO_EXTERNAL_PRICE}
          </span>
        )}
        {showPrice || changeLoading ? (
          <span className="inline-flex min-w-0 shrink-0 items-baseline gap-x-0.5">
            <span
              className={`${changeClass} ${
                changeTone ? changeToneClass(changeTone) : "text-zinc-400"
              }`}
            >
              {changeLabel}
            </span>
            {changePeriodShort ? (
              <span className={changePeriodClass}>{changePeriodShort}</span>
            ) : null}
          </span>
        ) : null}
      </div>
    </div>
  );
}
