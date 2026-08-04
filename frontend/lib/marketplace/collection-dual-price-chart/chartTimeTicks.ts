import { CHART_DAY_SEC } from "./constants";

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

/** Axis label without `$` — `900`, `1k`, `2k`, `1.5k`, `3M`. */
export function formatYAxisLabelPlain(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const n = Math.round(value);
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    const m = n / 1_000_000;
    return Number.isInteger(m) || Math.abs(m - Math.round(m)) < 1e-6
      ? `${Math.round(m)}M`
      : `${m.toFixed(1)}M`;
  }
  if (abs >= 1000) {
    const k = n / 1000;
    return Number.isInteger(k) || Math.abs(k - Math.round(k)) < 1e-6
      ? `${Math.round(k)}k`
      : `${k.toFixed(1)}k`;
  }
  return String(n);
}

export function formatHoverWhen(tSec: number): string {
  return formatTickShortMdYear(tSec);
}

export function formatTooltipUsd(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v >= 100 ? `$${v.toFixed(0)}` : `$${v.toFixed(2)}`;
}

/** Axis label with `$` — `$900`, `$1k`, `$2k`. */
export function formatYAxisLabelCompact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `$${formatYAxisLabelPlain(value)}`;
}
