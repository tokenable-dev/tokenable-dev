/**
 * Listing-pool distribution for a collectionKey (USDC asks only).
 * Robust layer: Tukey IQR trim → floor = p10, volatility = sample stdev on trimmed set.
 * Used as **liquidity / depth**, not as the product’s external “market price”.
 */

export type CollectionMarketStatsBand = {
  low: number | null;
  high: number | null;
};

/**
 * Listing-pool distribution (USDC) — **liquidity / depth signal only**, not the product “market price”.
 * `isReliable` means **strong pool depth** (enough listings), not external price validity.
 */
export type RobustMarketStatsComputed = {
  floor: number | null;
  median: number | null;
  p25: number | null;
  p75: number | null;
  band: CollectionMarketStatsBand;
  /** Sample stdev (ddof=1) on trimmed prices; null if fewer than 2 trimmed points */
  volatility: number | null;
  /** Count of valid USDC observations (before IQR trim) */
  sampleSize: number;
  /** True when `sampleSize >= minReliableSample` — “strong” on-platform liquidity, not catalog price. */
  isReliable: boolean;
  /** True when at least one point was dropped by the IQR fence rule */
  trimmed: boolean;
};

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Sample standard deviation (ddof=1); null if n < 2 */
function sampleStdDevUsd(prices: number[]): number | null {
  const n = prices.length;
  if (n < 2) return null;
  const m = mean(prices);
  let s = 0;
  for (const x of prices) {
    const d = x - m;
    s += d * d;
  }
  return Math.sqrt(s / (n - 1));
}

/** Inclusive linear interpolation percentile on sorted array, p in [0, 1] */
function percentileLinear(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const clamped = Math.min(1, Math.max(0, p));
  const idx = (sorted.length - 1) * clamped;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

function medianSorted(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor((sorted.length - 1) / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid] + sorted[mid + 1]) / 2;
}

/**
 * Tukey fences on sorted data; keeps [] only if all values violate fences (then caller should fall back).
 * For n < 4, returns a copy with trimmed=false (not enough points for a stable IQR gate).
 */
function tukeyIqrInclusiveTrim(sorted: number[]): {
  values: number[];
  trimmed: boolean;
} {
  const n = sorted.length;
  if (n === 0) return { values: [], trimmed: false };
  if (n < 4) {
    return { values: [...sorted], trimmed: false };
  }
  const q1 = percentileLinear(sorted, 0.25);
  const q3 = percentileLinear(sorted, 0.75);
  if (q1 == null || q3 == null) {
    return { values: [...sorted], trimmed: false };
  }
  const iqr = q3 - q1;
  const low = q1 - 1.5 * iqr;
  const high = q3 + 1.5 * iqr;
  const values = sorted.filter((x) => x >= low && x <= high);
  if (values.length === 0) {
    return { values: [...sorted], trimmed: false };
  }
  return { values, trimmed: values.length !== n };
}

const DEFAULT_MIN_RELIABLE_SAMPLE = 5;

/**
 * USDC listing pool only (caller filters). Tukey IQR trim; floor = p10; vol = stdev(trimmed).
 * Numeric stats are computed for any n ≥ 1. `isReliable` is **liquidity strength** (`sampleSize >= minReliableSample`),
 * not “valid external price”.
 */
export function computeRobustMarketStatsFromUsdPrices(
  usdcPrices: number[],
  options?: { minReliableSample?: number },
): RobustMarketStatsComputed {
  const minReliable = options?.minReliableSample ?? DEFAULT_MIN_RELIABLE_SAMPLE;
  const finite = usdcPrices.filter(
    (x) => typeof x === 'number' && Number.isFinite(x) && x > 0,
  );
  const sortedRaw = [...finite].sort((a, b) => a - b);
  const n = sortedRaw.length;

  const empty = (): RobustMarketStatsComputed => ({
    floor: null,
    median: null,
    p25: null,
    p75: null,
    band: { low: null, high: null },
    volatility: null,
    sampleSize: n,
    isReliable: false,
    trimmed: false,
  });

  if (n === 0) return empty();

  const { values: trimmed, trimmed: didTrim } =
    tukeyIqrInclusiveTrim(sortedRaw);
  const sorted = [...trimmed].sort((a, b) => a - b);

  const floor = percentileLinear(sorted, 0.1);
  const median = medianSorted(sorted);
  const p25 = percentileLinear(sorted, 0.25);
  const p75 = percentileLinear(sorted, 0.75);
  const vol = sampleStdDevUsd(sorted);

  return {
    floor,
    median,
    p25,
    p75,
    band: { low: p25, high: p75 },
    volatility: vol,
    sampleSize: n,
    isReliable: n >= minReliable,
    trimmed: didTrim,
  };
}
