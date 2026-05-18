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

export function percentChangeFromPoints(points: UsdPoint[]): number | null {
  if (points.length < 2) return null;
  const a = points[0].v;
  const b = points[points.length - 1].v;
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
  return ((b - a) / a) * 100;
}

const SEC_24H = 86400;

/**
 * Latest observation vs interpolated reference at (latest.t − 24h) on the same Cardhedger series.
 * No synthetic/mock points — returns null if history does not span ~24h before the latest tick.
 */
export function percentChangeReferenceOver24h(points: UsdPoint[]): number | null {
  const cleaned = points.filter(
    (p) =>
      Number.isFinite(p.t) &&
      Number.isFinite(p.v) &&
      p.v > 0,
  );
  if (cleaned.length < 2) return null;
  const sorted = [...cleaned].sort((a, b) => a.t - b.t);
  const end = sorted[sorted.length - 1]!;
  const targetT = end.t - SEC_24H;
  if (targetT < sorted[0]!.t) return null;

  let i0 = -1;
  for (let k = 0; k < sorted.length; k++) {
    if (sorted[k]!.t <= targetT) i0 = k;
    else break;
  }
  if (i0 < 0) return null;

  let refV: number;
  const a = sorted[i0]!;
  if (a.t === targetT) {
    refV = a.v;
  } else if (i0 + 1 < sorted.length) {
    const b = sorted[i0 + 1]!;
    if (b.t <= targetT) return null;
    const dt = b.t - a.t;
    if (dt <= 0) return null;
    const w = (targetT - a.t) / dt;
    refV = a.v + (b.v - a.v) * w;
  } else {
    refV = a.v;
  }

  if (!Number.isFinite(refV) || refV <= 0 || !Number.isFinite(end.v) || end.v <= 0) {
    return null;
  }
  return ((end.v - refV) / refV) * 100;
}
