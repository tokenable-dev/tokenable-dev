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
      minIntervalMs: 75 * CHART_DAY_SEC * 1000,
      splitNumber: 5,
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

export function formatHoverWhen(tSec: number): string {
  return formatTickShortMdYear(tSec);
}

export function formatTooltipUsd(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v >= 100 ? `$${v.toFixed(0)}` : `$${v.toFixed(2)}`;
}

export function formatYAxisLabelCompact(value: number): string {
  if (value >= 1_000_000) return `$${Math.round(value / 1_000_000)}M`;
  if (value >= 10_000) return `$${Math.round(value / 1_000)}k`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  if (value >= 10) return `$${Math.round(value)}`;
  return `$${value.toFixed(value === 0 ? 0 : 1)}`;
}
