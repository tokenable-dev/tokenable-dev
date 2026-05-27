import {
  MARKET_PRICE_CHANGE_PERIOD_SHORT,
  REFERENCE_CHANGE_UNAVAILABLE_HINT,
} from "@/lib/market";

function formatListingUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const digits = abs >= 1000 ? 0 : 2;
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })}`;
}

function formatSignedPct(pct: number): string {
  if (Number.isFinite(pct) && Math.abs(pct) < 0.05) {
    return "0.0%";
  }
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function referenceChangePctClass(pct: number): string {
  return pct >= 0 ? "text-emerald-400" : "text-rose-300";
}

function ExchangeReferenceChangeInline({
  pct,
  loading = false,
  windowShort = MARKET_PRICE_CHANGE_PERIOD_SHORT,
  titleDetail,
}: {
  pct: number | null;
  loading?: boolean;
  windowShort?: string;
  titleDetail?: string;
}) {
  const win = windowShort;
  const title = titleDetail?.trim()
    ? `External reference (${win} change) — ${titleDetail.trim()}`
    : `External reference (${win} change)`;

  if (loading && pct == null) {
    return (
      <span className="shrink-0 text-[10px] text-zinc-500 sm:text-xs" aria-hidden>
        … {win}
      </span>
    );
  }

  const displayPct = pct != null && Number.isFinite(pct) ? pct : 0;
  const hint = pct == null ? REFERENCE_CHANGE_UNAVAILABLE_HINT : title;

  return (
    <span className="shrink-0 text-[10px] sm:text-xs" title={hint}>
      <span className={`tabular-nums font-semibold ${referenceChangePctClass(displayPct)}`}>
        {formatSignedPct(displayPct)}
      </span>
      <span className="text-zinc-400">{` ${win}`}</span>
    </span>
  );
}

/** White listing price with colored % change to the right (Markets cards). */
export function ExchangeListingPriceWithChange({
  priceUsd,
  changePct,
  loading = false,
  windowShort = MARKET_PRICE_CHANGE_PERIOD_SHORT,
  titleDetail,
  priceClassName = "text-sm font-bold sm:text-base md:text-lg",
  priceTitle,
}: {
  priceUsd: number | null;
  changePct: number | null;
  loading?: boolean;
  windowShort?: string;
  titleDetail?: string;
  priceClassName?: string;
  priceTitle?: string;
}) {
  return (
    <div className="flex min-w-0 items-baseline justify-end gap-2 sm:gap-2.5">
      <span className={`tabular-nums text-white ${priceClassName}`} title={priceTitle}>
        {formatListingUsd(priceUsd)}
      </span>
      <ExchangeReferenceChangeInline
        pct={changePct}
        loading={loading}
        windowShort={windowShort}
        titleDetail={titleDetail}
      />
    </div>
  );
}
