/** Product-wide default label for external / reference price % change tiles. */
export const MARKET_PRICE_CHANGE_PERIOD_LABEL = "1 yr";

/** Compact suffix for badges (exchange cards, pills). */
export const MARKET_PRICE_CHANGE_PERIOD_SHORT = "1 yr";

/** When reference % cannot be computed (insufficient Cardhedger history). */
export const REFERENCE_CHANGE_UNAVAILABLE_LABEL = "—";

export const REFERENCE_CHANGE_UNAVAILABLE_HINT =
  "Not enough eBay reference price history to calculate a price change.";

/** Target lookback: 365 calendar days. */
export const MARKET_PRICE_CHANGE_LAG_SEC = 365 * 86_400;

/** Batched collection snapshots — full comps-merged archive for chart + % change. */
export const MARKET_PRICE_CHANGE_SNAPSHOT_DURATION = "max" as const;

/**
 * `getCollectionMarketSeries` duration — full merged history (chart + headline metrics).
 */
export const MARKET_METRICS_SERIES_DURATION = "max" as const;

/** Flat reference move (~0% over the window) — show explicit zero, not "no data". */
export const REFERENCE_CHANGE_FLAT_LABEL = "0.0%";

const FLAT_CHANGE_EPSILON_PCT = 0.05;
const SEC_DAY = 86_400;

export function isFlatReferencePercentChange(pct: number): boolean {
  return Number.isFinite(pct) && Math.abs(pct) < FLAT_CHANGE_EPSILON_PCT;
}

export type ReferenceChangeTone = "up" | "down" | "flat";

export function referenceChangeTone(pct: number): ReferenceChangeTone {
  if (isFlatReferencePercentChange(pct)) return "flat";
  if (pct > 0) return "up";
  return "down";
}

export function formatReferencePercentChange(
  pct: number,
  decimals = 1,
): string {
  if (isFlatReferencePercentChange(pct)) return REFERENCE_CHANGE_FLAT_LABEL;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(decimals)}%`;
}

export type ReferencePercentChangeResult = {
  pct: number | null;
  /** True when history reaches a full 365d lookback. */
  isFullYear: boolean;
  /** Seconds of history used for the % (365d target or full available span). */
  windowSec: number;
  /** LOCF anchor sale used for % (when computed). */
  refUsd?: number | null;
  refAtSec?: number | null;
};

/** Standard windows — max fetch is {@link MARKET_PRICE_CHANGE_LAG_SEC} (365d). */
export type ReferenceChangeWindowBucket = "7d" | "30d" | "90d" | "180d";

/** Bucket actual span (days) — aligned with backend `windowLabelFromSpanDays` (excluding 365d label). */
export function referenceChangeWindowFromSpanDays(days: number): ReferenceChangeWindowBucket {
  if (days >= 150) return "180d";
  if (days >= 60) return "90d";
  if (days >= 21) return "30d";
  return "7d";
}

/** UI label for a bucket — `1 yr` only when {@link ReferencePercentChangeResult.isFullYear}. */
export function formatReferenceChangeWindowLabel(
  window: ReferenceChangeWindowBucket | string | null | undefined,
  isFullYear: boolean,
): string {
  if (isFullYear) return "1 yr";
  switch (window) {
    case "180d":
      return "180d";
    case "90d":
      return "90d";
    case "30d":
      return "30d";
    case "7d":
      return "7d";
    default:
      return "30d";
  }
}

function referenceChangeDisplayLabel(
  result: Pick<ReferencePercentChangeResult, "isFullYear" | "windowSec">,
  apiWindow?: string | null,
): string {
  if (result.isFullYear) return "1 yr";
  const days = referenceChangeCoverageDays(result);
  if (days == null) return MARKET_PRICE_CHANGE_PERIOD_SHORT;
  const bucket =
    apiWindow && apiWindow !== "365d" && apiWindow !== "24h"
      ? (apiWindow as ReferenceChangeWindowBucket)
      : referenceChangeWindowFromSpanDays(days);
  return formatReferenceChangeWindowLabel(bucket, false);
}

/** Short period label for UI badges (`1 yr`, `180d`, `90d`, `30d`, `7d`). */
export function formatReferenceChangePeriodShort(
  result: Pick<ReferencePercentChangeResult, "isFullYear" | "windowSec"> | null,
  apiWindow?: string | null,
): string {
  if (!result || result.windowSec <= 0) return MARKET_PRICE_CHANGE_PERIOD_SHORT;
  return referenceChangeDisplayLabel(result, apiWindow);
}

/** Longer label for stat rows / tooltips — same tokens as short labels. */
export function formatReferenceChangePeriodLabel(
  result: Pick<ReferencePercentChangeResult, "isFullYear" | "windowSec"> | null,
  apiWindow?: string | null,
): string {
  if (!result || result.windowSec <= 0) return MARKET_PRICE_CHANGE_PERIOD_LABEL;
  return referenceChangeDisplayLabel(result, apiWindow);
}

/** Mobile / compact stat column e.g. `180d chg.` */
export function formatReferenceChangeStatLabel(
  result: Pick<ReferencePercentChangeResult, "isFullYear" | "windowSec"> | null,
  apiWindow?: string | null,
): string {
  return `${formatReferenceChangePeriodShort(result, apiWindow)} chg.`;
}

export function referenceChangeCoverageDays(
  result: Pick<ReferencePercentChangeResult, "windowSec"> | null,
): number | null {
  if (!result || !Number.isFinite(result.windowSec) || result.windowSec <= 0) return null;
  return Math.max(1, Math.round(result.windowSec / SEC_DAY));
}

/** Human-readable diagnostic hint for QA/ops and tooltip copy. */
function formatUsdAnchor(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function formatReferenceChangeCoverageHint(
  result: Pick<
    ReferencePercentChangeResult,
    "isFullYear" | "windowSec" | "refUsd" | "refAtSec"
  > | null,
): string {
  if (!result || result.windowSec <= 0) return "Coverage unknown";
  const label = referenceChangeDisplayLabel(result);
  if (
    result.refUsd != null &&
    Number.isFinite(result.refUsd) &&
    result.refAtSec != null &&
    Number.isFinite(result.refAtSec)
  ) {
    const anchorDate = new Date(result.refAtSec * 1000).toLocaleDateString(
      "en-US",
      { month: "short", day: "numeric", year: "numeric" },
    );
    if (result.isFullYear) {
      return `1 yr vs ${formatUsdAnchor(result.refUsd)} sale (${anchorDate}), not chart endpoints`;
    }
    return `${label} vs ${formatUsdAnchor(result.refUsd)} sale (${anchorDate})`;
  }
  if (result.isFullYear) return `Based on full 365d history`;
  return `Based on ${label} reference history`;
}

/** Map batched snapshot metadata to period labels (Markets / card detail). */
export function referenceChangePeriodFromSnapshotMeta(
  meta:
    | {
        marketChangeIsFullYear?: boolean;
        marketChangeSpanSec?: number;
        marketChangeWindow?: string;
      }
    | null
    | undefined,
): Pick<ReferencePercentChangeResult, "isFullYear" | "windowSec"> & {
  marketChangeWindow?: string;
} {
  if (meta?.marketChangeSpanSec != null && meta.marketChangeSpanSec > 0) {
    return {
      isFullYear: Boolean(meta.marketChangeIsFullYear),
      windowSec: meta.marketChangeSpanSec,
      marketChangeWindow: meta.marketChangeWindow,
    };
  }
  if (meta?.marketChangeWindow === "365d" && meta.marketChangeIsFullYear === true) {
    return {
      isFullYear: true,
      windowSec: MARKET_PRICE_CHANGE_LAG_SEC,
      marketChangeWindow: meta.marketChangeWindow,
    };
  }
  return { isFullYear: false, windowSec: 0, marketChangeWindow: meta?.marketChangeWindow };
}

/** Period label from snapshot/list meta (Markets collection cards). */
export function formatReferenceChangePeriodFromSnapshotMeta(
  meta:
    | {
        marketChangeIsFullYear?: boolean;
        marketChangeSpanSec?: number;
        marketChangeWindow?: string;
      }
    | null
    | undefined,
): string {
  const period = referenceChangePeriodFromSnapshotMeta(meta);
  return formatReferenceChangePeriodShort(period, period.marketChangeWindow);
}
