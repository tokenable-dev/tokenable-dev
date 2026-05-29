import {
  MARKET_PRICE_CHANGE_PERIOD_SHORT,
  REFERENCE_CHANGE_UNAVAILABLE_HINT,
} from "@/lib/market";

/** Shared typography for Markets listing rows: label, $ price, and % change. */
export const EXCHANGE_LISTING_PRICE_TEXT_CLASS =
  "text-sm tabular-nums leading-none sm:text-base";

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
  textClassName = EXCHANGE_LISTING_PRICE_TEXT_CLASS,
}: {
  pct: number | null;
  loading?: boolean;
  windowShort?: string;
  titleDetail?: string;
  textClassName?: string;
}) {
  const win = windowShort;
  const title = titleDetail?.trim()
    ? `External reference (${win} change) — ${titleDetail.trim()}`
    : `External reference (${win} change)`;

  if (loading && pct == null) {
    return (
      <span className={`shrink-0 text-zinc-500 ${textClassName}`} aria-hidden>
        … {win}
      </span>
    );
  }

  const displayPct = pct != null && Number.isFinite(pct) ? pct : 0;
  const hint = pct == null ? REFERENCE_CHANGE_UNAVAILABLE_HINT : title;

  return (
    <span className={`shrink-0 ${textClassName}`} title={hint}>
      <span
        className={`font-semibold ${referenceChangePctClass(displayPct)}`}
      >
        {formatSignedPct(displayPct)}
      </span>
      <span className="font-medium text-zinc-400">{` ${win}`}</span>
    </span>
  );
}

/** White listing price with colored % change inline (Markets cards default to end-aligned). */
export function ExchangeListingPriceWithChange({
  priceUsd,
  changePct,
  loading = false,
  windowShort = MARKET_PRICE_CHANGE_PERIOD_SHORT,
  titleDetail,
  textClassName = EXCHANGE_LISTING_PRICE_TEXT_CLASS,
  priceClassName,
  changeTextClassName,
  priceTitle,
  align = "end",
}: {
  priceUsd: number | null;
  changePct: number | null;
  loading?: boolean;
  windowShort?: string;
  titleDetail?: string;
  /** Base size for price + % (and Markets "Price" label when using the export). */
  textClassName?: string;
  /** Overrides price styling only; defaults from textClassName. */
  priceClassName?: string;
  /** Overrides % change styling only; defaults from textClassName. */
  changeTextClassName?: string;
  priceTitle?: string;
  align?: "start" | "end";
}) {
  const resolvedPriceClass =
    priceClassName ?? `${textClassName} font-bold text-white`;
  const resolvedChangeClass = changeTextClassName ?? textClassName;

  return (
    <div
      className={`flex min-w-0 items-baseline gap-2 sm:gap-2.5 ${
        align === "start" ? "justify-start" : "justify-end"
      }`}
    >
      <span className={resolvedPriceClass} title={priceTitle}>
        {formatListingUsd(priceUsd)}
      </span>
      <ExchangeReferenceChangeInline
        pct={changePct}
        loading={loading}
        windowShort={windowShort}
        titleDetail={titleDetail}
        textClassName={resolvedChangeClass}
      />
    </div>
  );
}
