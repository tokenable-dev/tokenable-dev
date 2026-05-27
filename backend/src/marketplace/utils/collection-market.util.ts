/**
 * Shared market-history primitive types used by chart and preview layers.
 */

export interface UsdPoint {
  t: number;
  v: number;
}

export interface GradePriceStrip {
  psa10: number | null;
  psa9: number | null;
  raw: number | null;
}

const SEC_DAY = 86_400;
export const REFERENCE_CHANGE_LAG_1Y_SEC = 365 * SEC_DAY;

/** Max calendar gap between anchor sale and (latest.t − lag) for a trustworthy 1y label. */
export const REFERENCE_LAG_MAX_ANCHOR_GAP_SEC = 90 * SEC_DAY;

export type ReferenceChangeBestWindowResult = {
  pct: number | null;
  isFullYear: boolean;
  spanSec: number;
  window: '7d' | '30d' | '90d' | '180d' | '365d';
  /** LOCF anchor sale used for % (when computed). */
  refUsd?: number | null;
  refAtSec?: number | null;
};

function windowLabelFromSpanDays(days: number): ReferenceChangeBestWindowResult['window'] {
  if (days >= 300) return '365d';
  if (days >= 150) return '180d';
  if (days >= 60) return '90d';
  if (days >= 21) return '30d';
  return '7d';
}

/** Short UI label — keep aligned with frontend `formatReferenceChangePeriodShort`. */
export function referenceChangePeriodShort(
  isFullYear: boolean,
  spanSec: number,
  window?: ReferenceChangeBestWindowResult['window'],
): string {
  if (isFullYear) return '1 yr';
  if (window && window !== '365d') {
    switch (window) {
      case '180d':
        return '180d';
      case '90d':
        return '90d';
      case '30d':
        return '30d';
      case '7d':
        return '7d';
      default:
        break;
    }
  }
  const days = Math.round(spanSec / SEC_DAY);
  if (days >= 150) return '180d';
  if (days >= 60) return '90d';
  if (days >= 21) return '30d';
  return '7d';
}

/**
 * Prefer 1y % change; if history is shorter, use the full available span (first→latest).
 */
export function referenceChangeWithBestWindow(
  points: UsdPoint[],
): ReferenceChangeBestWindowResult {
  const empty: ReferenceChangeBestWindowResult = {
    pct: null,
    isFullYear: false,
    spanSec: 0,
    window: '365d',
  };
  const cleaned = points.filter(
    (p) => Number.isFinite(p.t) && Number.isFinite(p.v) && p.v > 0,
  );
  if (cleaned.length < 2) return empty;

  const sorted = [...cleaned].sort((a, b) => a.t - b.t);
  const spanSec = sorted[sorted.length - 1].t - sorted[0].t;
  if (!(spanSec > 0)) return empty;

  const lag1y = referenceLagAnchorFromPoints(
    points,
    REFERENCE_CHANGE_LAG_1Y_SEC,
  );
  /** Comps-merged archives often gap >90d before the 1y anchor — still compare latest vs LOCF ~1y ago. */
  const historyCovers1y = spanSec >= REFERENCE_CHANGE_LAG_1Y_SEC;
  if (lag1y != null && historyCovers1y) {
    return {
      pct: lag1y.pct,
      isFullYear: true,
      spanSec: REFERENCE_CHANGE_LAG_1Y_SEC,
      window: '365d',
      refUsd: lag1y.refUsd,
      refAtSec: lag1y.refAtSec,
    };
  }

  const lagSpan = referenceLagAnchorFromPoints(points, spanSec);
  let pct = lagSpan?.pct ?? null;
  if (pct == null && sorted.length >= 2) {
    const a = sorted[0].v;
    const b = sorted[sorted.length - 1].v;
    if (Number.isFinite(a) && Number.isFinite(b) && a > 0) {
      pct = ((b - a) / a) * 100;
    }
  }

  const days = spanSec / SEC_DAY;
  return {
    pct,
    isFullYear: false,
    spanSec,
    window: windowLabelFromSpanDays(days),
    refUsd: lagSpan?.refUsd ?? null,
    refAtSec: lagSpan?.refAtSec ?? null,
  };
}

export type ReferenceLagAnchor = {
  pct: number;
  refUsd: number;
  refAtSec: number;
  endUsd: number;
  endAtSec: number;
  /** Seconds between anchor sale and (end.t − lagSec). */
  anchorGapSec: number;
};

/**
 * Latest observation vs last actual sale on or before (latest.t − lagSec) — LOCF, no interpolation
 * across sparse comps gaps (avoids synthetic sub-market reference prices).
 */
export function referenceLagAnchorFromPoints(
  points: UsdPoint[],
  lagSec: number,
): ReferenceLagAnchor | null {
  if (!Number.isFinite(lagSec) || lagSec <= 0) return null;

  const cleaned = points.filter(
    (p) => Number.isFinite(p.t) && Number.isFinite(p.v) && p.v > 0,
  );
  if (cleaned.length < 2) return null;
  const sorted = [...cleaned].sort((a, b) => a.t - b.t);
  const end = sorted[sorted.length - 1];
  const targetT = end.t - lagSec;
  if (targetT < sorted[0].t) return null;

  let i0 = -1;
  for (let k = 0; k < sorted.length; k++) {
    if (sorted[k].t <= targetT) i0 = k;
    else break;
  }
  if (i0 < 0) return null;

  const anchor = sorted[i0];
  const refV = anchor.v;
  const anchorGapSec = targetT - anchor.t;

  if (
    !Number.isFinite(refV) ||
    refV <= 0 ||
    !Number.isFinite(end.v) ||
    end.v <= 0
  ) {
    return null;
  }
  return {
    pct: ((end.v - refV) / refV) * 100,
    refUsd: refV,
    refAtSec: anchor.t,
    endUsd: end.v,
    endAtSec: end.t,
    anchorGapSec: Math.max(0, anchorGapSec),
  };
}

/** @returns % only — prefer {@link referenceLagAnchorFromPoints} when anchor metadata is needed. */
export function percentChangeReferenceOverLagSec(
  points: UsdPoint[],
  lagSec: number,
): number | null {
  return referenceLagAnchorFromPoints(points, lagSec)?.pct ?? null;
}
