import {
  MARKET_PRICE_CHANGE_PERIOD_SHORT,
  REFERENCE_CHANGE_UNAVAILABLE_HINT,
} from "@/lib/market";

/** Font size scale for Markets card price rows. */
export const MARKETS_LISTING_PRICE_SIZE_CLASS =
  "text-xs tabular-nums leading-none max-[380px]:text-[11px] sm:text-sm md:text-base";

/** Shared typography for price, % change, and period — color is applied per segment. */
export const MARKETS_LISTING_PRICE_TEXT_CLASS = `${MARKETS_LISTING_PRICE_SIZE_CLASS} font-bold`;

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

function referenceChangePctColorClass(pct: number): string {
  return pct >= 0 ? "text-emerald-400" : "text-rose-300";
}

function MarketsReferenceChangeInline({
  pct,
  loading = false,
  windowShort = MARKET_PRICE_CHANGE_PERIOD_SHORT,
  titleDetail,
  textClassName = MARKETS_LISTING_PRICE_TEXT_CLASS,
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
      <span
        className={`min-w-0 truncate text-zinc-500 ${textClassName}`}
        aria-hidden
        title={title}
      >
        … {win}
      </span>
    );
  }

  const displayPct = pct != null && Number.isFinite(pct) ? pct : 0;
  const hint = pct == null ? REFERENCE_CHANGE_UNAVAILABLE_HINT : title;

  return (
    <span
      className="flex min-w-0 max-w-full flex-nowrap items-center justify-end gap-x-0.5 overflow-hidden"
      title={hint}
    >
      <span className={`shrink-0 ${textClassName} ${referenceChangePctColorClass(displayPct)}`}>
        {formatSignedPct(displayPct)}
      </span>
      <span className={`shrink-0 ${textClassName} text-zinc-400`}>{win}</span>
    </span>
  );
}

/** White listing price with colored % change inline (Markets cards default to end-aligned). */
export function MarketsListingPriceWithChange({
  priceUsd,
  changePct,
  loading = false,
  windowShort = MARKET_PRICE_CHANGE_PERIOD_SHORT,
  titleDetail,
  textClassName = MARKETS_LISTING_PRICE_TEXT_CLASS,
  priceTitle,
  align = "end",
  /** Price flush left, % change flush right (Markets grid cards). */
  spread = false,
  className,
}: {
  priceUsd: number | null;
  changePct: number | null;
  loading?: boolean;
  windowShort?: string;
  titleDetail?: string;
  textClassName?: string;
  priceTitle?: string;
  align?: "start" | "end";
  spread?: boolean;
  className?: string;
}) {
  const rowLayoutClass = spread
    ? "w-full justify-between gap-x-1 max-[380px]:gap-x-0.5 sm:gap-x-1.5"
    : align === "start"
      ? "justify-start gap-x-1.5 sm:gap-x-2"
      : "max-w-full justify-end gap-x-1.5 sm:gap-x-2.5";

  return (
    <div
      className={`flex min-w-0 max-w-full flex-nowrap items-center overflow-hidden whitespace-nowrap ${rowLayoutClass} ${className ?? ""}`}
    >
      <span
        className={`min-w-0 shrink-0 truncate ${textClassName} text-white`}
        title={priceTitle}
      >
        {formatListingUsd(priceUsd)}
      </span>
      <MarketsReferenceChangeInline
        pct={changePct}
        loading={loading}
        windowShort={windowShort}
        titleDetail={titleDetail}
        textClassName={textClassName}
      />
    </div>
  );
}
