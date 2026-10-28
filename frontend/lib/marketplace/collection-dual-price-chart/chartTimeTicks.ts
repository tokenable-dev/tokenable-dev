import { formatDisplayAxis, formatDisplayMoney } from "@/lib/market/displayMoney";
import { resolveLocale, type AppLocale } from "@/lib/i18n/preferences";
import { CHART_DAY_SEC } from "./constants";

function chartLocale(locale?: string | null): AppLocale {
  return resolveLocale(locale);
}

function chartDate(tSec: number): Date {
  return new Date(tSec * 1000);
}

function formatChartDate(
  d: Date,
  locale: AppLocale,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, options).format(d);
}

/** English keeps `Jan '26`. Other locales use their own short year. */
function formatMonthWithShortYear(d: Date, locale: AppLocale): string {
  if (locale === "en") {
    const month = formatChartDate(d, locale, { month: "short" });
    return `${month} '${String(d.getFullYear()).slice(2)}`;
  }
  return formatChartDate(d, locale, { month: "short", year: "2-digit" });
}

/** Compact axis / tooltip date — e.g. `1.26 (Jan 2026)` for Jan 26, 2026. */
export function formatTickShortMdYear(tSec: number, locale?: string | null): string {
  const d = chartDate(tSec);
  const loc = chartLocale(locale);
  const month = d.getMonth() + 1;
  const day = String(d.getDate()).padStart(2, "0");
  const monthYear = formatChartDate(d, loc, { month: "short", year: "numeric" });
  return `${month}.${day} (${monthYear})`;
}

export function formatTickDate(tSec: number, locale?: string | null): string {
  return formatChartDate(chartDate(tSec), chartLocale(locale), {
    month: "short",
    day: "numeric",
  });
}

export function formatTickMonth(tSec: number, locale?: string | null): string {
  return formatChartDate(chartDate(tSec), chartLocale(locale), {
    month: "short",
    year: "2-digit",
  });
}

export function formatTickMonthYearNumeric(tSec: number, locale?: string | null): string {
  return formatChartDate(chartDate(tSec), chartLocale(locale), {
    month: "short",
    year: "numeric",
  });
}

/**
 * Card.html price-history `lab(d)` — X-axis ticks.
 * - window ≤ 45d (1M): `Jan 26`
 * - longer (3M / 6M / 1Y): `Jan`, or `Jan '26` at month-start (day ≤ 7 and month rolled)
 */
export function formatCardHtmlAxisLabel(
  tSec: number,
  windowDays: number | null,
  locale?: string | null,
): string {
  const dt = chartDate(tSec);
  const loc = chartLocale(locale);
  const win =
    windowDays != null && Number.isFinite(windowDays) && windowDays > 0
      ? windowDays
      : 365;
  if (win <= 45) {
    return formatChartDate(dt, loc, { month: "short", day: "numeric" });
  }
  const weekAgo = new Date(dt.getTime() - 7 * 86400000);
  if (dt.getDate() <= 7 && dt.getMonth() !== weekAgo.getMonth()) {
    return formatMonthWithShortYear(dt, loc);
  }
  return formatChartDate(dt, loc, { month: "short" });
}

/** Card.html tooltip date — `Jan 26, 2026`. */
export function formatCardHtmlHoverWhen(tSec: number, locale?: string | null): string {
  return formatChartDate(chartDate(tSec), chartLocale(locale), {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Card.html `dlab` — X-axis at 3 anchors.
 * ≤30d: `Jan 26`; ≤180d: `Jan`; ≤365d: `Jan '26`; else year.
 */
export function formatCardHtmlPeriodAxisLabel(
  tSec: number,
  windowDays: number | null,
  locale?: string | null,
): string {
  const dt = chartDate(tSec);
  const loc = chartLocale(locale);
  const win =
    windowDays != null && Number.isFinite(windowDays) && windowDays > 0
      ? windowDays
      : 365;
  if (win <= 30) {
    return formatChartDate(dt, loc, { month: "short", day: "numeric" });
  }
  if (win <= 180) return formatChartDate(dt, loc, { month: "short" });
  if (win <= 365) return formatMonthWithShortYear(dt, loc);
  return String(dt.getFullYear());
}

/**
 * Collection-detail x-axis: calendar day of each of the three ticks.
 * Include `'YY` when the window spans more than one calendar year (All).
 */
export function formatCardHtmlThreeTickDayLabel(
  tSec: number,
  rangeStartSec: number,
  rangeEndSec: number,
  locale?: string | null,
): string {
  const dt = chartDate(tSec);
  const loc = chartLocale(locale);
  const md = formatChartDate(dt, loc, { month: "short", day: "numeric" });
  const y0 = new Date(rangeStartSec * 1000).getFullYear();
  const y1 = new Date(rangeEndSec * 1000).getFullYear();
  if (y0 === y1) return md;
  if (loc === "en") return `${md} '${String(dt.getFullYear()).slice(2)}`;
  return formatChartDate(dt, loc, {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
}

/** Three x-axis timestamps — period start, midpoint, period end. */
export function cardHtmlPeriodAxisTickMs(
  tMinSec: number,
  tMaxSec: number,
): number[] {
  const a = tMinSec * 1000;
  const b = tMaxSec * 1000;
  if (!(b > a)) return [a, a, a];
  const span = b - a;
  return [0, 0.5, 1].map((f) => a + span * f);
}

/** Card.html y-axis — `$9,000`. */
export function formatCardHtmlYAxisUsd(value: number): string {
  if (!Number.isFinite(value)) return "";
  return `$${Math.round(value).toLocaleString("en-US")}`;
}
export function roughTickConfigCardHtml(
  windowDays: number | null,
  locale?: string | null,
): {
  minIntervalMs: number;
  splitNumber: number;
  formatter: (tSec: number) => string;
} {
  const formatter = (tSec: number) => formatCardHtmlAxisLabel(tSec, windowDays, locale);
  // Card.html aims for ~8 labels (`every = ceil(slice.length / 8)`).
  if (windowDays == null || !Number.isFinite(windowDays) || windowDays <= 0) {
    return {
      minIntervalMs: 30 * CHART_DAY_SEC * 1000,
      splitNumber: 8,
      formatter,
    };
  }
  if (windowDays <= 45) {
    return {
      minIntervalMs: 4 * CHART_DAY_SEC * 1000,
      splitNumber: 8,
      formatter,
    };
  }
  if (windowDays <= 90) {
    return {
      minIntervalMs: 12 * CHART_DAY_SEC * 1000,
      splitNumber: 8,
      formatter,
    };
  }
  if (windowDays <= 180) {
    return {
      minIntervalMs: 21 * CHART_DAY_SEC * 1000,
      splitNumber: 8,
      formatter,
    };
  }
  return {
    minIntervalMs: 28 * CHART_DAY_SEC * 1000,
    splitNumber: 12,
    formatter,
  };
}

export function roughTickConfigByWindowDays(
  windowDays: number | null,
  locale?: string | null,
): {
  minIntervalMs: number;
  splitNumber: number;
  formatter: (tSec: number) => string;
} {
  const shortLabel = (tSec: number) => formatTickShortMdYear(tSec, locale);

  if (windowDays == null || !Number.isFinite(windowDays) || windowDays <= 0) {
    return {
      minIntervalMs: 120 * CHART_DAY_SEC * 1000,
      splitNumber: 5,
      formatter: shortLabel,
    };
  }
  if (windowDays <= 7) {
    return {
      minIntervalMs: 2 * CHART_DAY_SEC * 1000,
      splitNumber: 4,
      formatter: shortLabel,
    };
  }
  if (windowDays <= 30) {
    return {
      minIntervalMs: 7 * CHART_DAY_SEC * 1000,
      splitNumber: 5,
      formatter: shortLabel,
    };
  }
  if (windowDays <= 90) {
    return {
      minIntervalMs: 21 * CHART_DAY_SEC * 1000,
      splitNumber: 5,
      formatter: shortLabel,
    };
  }
  if (windowDays <= 180) {
    return {
      minIntervalMs: 45 * CHART_DAY_SEC * 1000,
      splitNumber: 5,
      formatter: shortLabel,
    };
  }
  if (windowDays <= 365) {
    return {
      minIntervalMs: 28 * CHART_DAY_SEC * 1000,
      splitNumber: 12,
      formatter: shortLabel,
    };
  }
  if (windowDays <= 730) {
    return {
      minIntervalMs: 120 * CHART_DAY_SEC * 1000,
      splitNumber: 5,
      formatter: shortLabel,
    };
  }
  return {
    minIntervalMs: 180 * CHART_DAY_SEC * 1000,
    splitNumber: 5,
    formatter: shortLabel,
  };
}

/** 1y chart — bold year at range start / January, otherwise month abbrev (Feb, Mar, …). */
export function formatTickYearOrMonthLabel(
  tSec: number,
  rangeStartSec: number,
  locale?: string | null,
): string {
  const d = chartDate(tSec);
  const rangeStart = new Date(rangeStartSec * 1000);
  const sameMonthAsStart =
    d.getFullYear() === rangeStart.getFullYear() && d.getMonth() === rangeStart.getMonth();
  if (d.getMonth() === 0 || sameMonthAsStart) {
    return `{year|${d.getFullYear()}}`;
  }
  return formatChartDate(d, chartLocale(locale), { month: "short" });
}

/** Axis label without `$` — `900`, `1k`, `2k`, `3M` (whole units only). */
export function formatYAxisLabelPlain(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const n = Math.round(value);
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${Math.round(n / 1_000_000)}M`;
  if (abs >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

export function formatHoverWhen(tSec: number, locale?: string | null): string {
  return formatTickShortMdYear(tSec, locale);
}

export function formatTooltipUsd(v: number | null): string {
  return formatDisplayMoney(v);
}

/** Card.html tooltip price. Historical points use the latest ECB rate. */
export function formatCardHtmlTooltipUsd(v: number | null): string {
  return formatDisplayMoney(v);
}

/** Axis label. Historical points use the latest ECB rate, not the rate on that date. */
export function formatYAxisLabelCompact(value: number): string {
  return formatDisplayAxis(value);
}
