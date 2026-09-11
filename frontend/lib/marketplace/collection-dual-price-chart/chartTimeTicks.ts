import { CHART_DAY_SEC } from "./constants";

const MON = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Compact axis / tooltip date — e.g. `1.26 (Jan 2026)` for Jan 26, 2026. */
export function formatTickShortMdYear(tSec: number): string {
  const d = new Date(tSec * 1000);
  const month = d.getMonth() + 1;
  const day = String(d.getDate()).padStart(2, "0");
  const monthYear = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return `${month}.${day} (${monthYear})`;
}

export function formatTickDate(tSec: number): string {
  return new Date(tSec * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatTickMonth(tSec: number): string {
  return new Date(tSec * 1000).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  });
}

export function formatTickMonthYearNumeric(tSec: number): string {
  return new Date(tSec * 1000).toLocaleDateString("en-US", {
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
): string {
  const dt = new Date(tSec * 1000);
  const win =
    windowDays != null && Number.isFinite(windowDays) && windowDays > 0
      ? windowDays
      : 365;
  if (win <= 45) {
    return `${MON[dt.getMonth()]} ${dt.getDate()}`;
  }
  const weekAgo = new Date(dt.getTime() - 7 * 86400000);
  if (dt.getDate() <= 7 && dt.getMonth() !== weekAgo.getMonth()) {
    return `${MON[dt.getMonth()]} '${String(dt.getFullYear()).slice(2)}`;
  }
  return MON[dt.getMonth()];
}

/** Card.html tooltip date — `Jan 26, 2026`. */
export function formatCardHtmlHoverWhen(tSec: number): string {
  const dt = new Date(tSec * 1000);
  return `${MON[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
}

/**
 * Card.html `dlab` — X-axis at 3 anchors.
 * ≤30d: `Jan 26`; ≤180d: `Jan`; ≤365d: `Jan '26`; else year.
 */
export function formatCardHtmlPeriodAxisLabel(
  tSec: number,
  windowDays: number | null,
): string {
  const dt = new Date(tSec * 1000);
  const win =
    windowDays != null && Number.isFinite(windowDays) && windowDays > 0
      ? windowDays
      : 365;
  if (win <= 30) return `${MON[dt.getMonth()]} ${dt.getDate()}`;
  if (win <= 180) return MON[dt.getMonth()] ?? "";
  if (win <= 365) {
    return `${MON[dt.getMonth()]} '${String(dt.getFullYear()).slice(2)}`;
  }
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
): string {
  const dt = new Date(tSec * 1000);
  const md = `${MON[dt.getMonth()]} ${dt.getDate()}`;
  const y0 = new Date(rangeStartSec * 1000).getFullYear();
  const y1 = new Date(rangeEndSec * 1000).getFullYear();
  if (y0 !== y1) return `${md} '${String(dt.getFullYear()).slice(2)}`;
  return md;
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
export function roughTickConfigCardHtml(windowDays: number | null): {
  minIntervalMs: number;
  splitNumber: number;
  formatter: (tSec: number) => string;
} {
  const formatter = (tSec: number) => formatCardHtmlAxisLabel(tSec, windowDays);
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

export function roughTickConfigByWindowDays(windowDays: number | null): {
  minIntervalMs: number;
  splitNumber: number;
  formatter: (tSec: number) => string;
} {
  const shortLabel = formatTickShortMdYear;

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
export function formatTickYearOrMonthLabel(tSec: number, rangeStartSec: number): string {
  const d = new Date(tSec * 1000);
  const rangeStart = new Date(rangeStartSec * 1000);
  const sameMonthAsStart =
    d.getFullYear() === rangeStart.getFullYear() && d.getMonth() === rangeStart.getMonth();
  if (d.getMonth() === 0 || sameMonthAsStart) {
    return `{year|${d.getFullYear()}}`;
  }
  return d.toLocaleDateString("en-US", { month: "short" });
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

export function formatHoverWhen(tSec: number): string {
  return formatTickShortMdYear(tSec);
}

export function formatTooltipUsd(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

/** Card.html tooltip price — `$9,000` via locale grouping. */
export function formatCardHtmlTooltipUsd(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

/** Axis label with `$` — `$900`, `$1k`, `$2k`. */
export function formatYAxisLabelCompact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `$${formatYAxisLabelPlain(value)}`;
}
