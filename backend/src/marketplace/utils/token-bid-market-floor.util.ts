/**
 * Unlisted token bids (no active ask on that tokenId) may not sit more than
 * 30% below the collection market price. No upper bound vs market.
 *
 * $100 market → min $70. $150 on a $100 market is allowed.
 */

export const TOKEN_BID_UNLISTED_MIN_MARKET_RATIO = 0.7;
const MIN_RATIO_NUM = 70;
const MIN_RATIO_DEN = 100;
const MICROS_PER_CENT = 10_000n;

export function snapshotMarketUsdForTokenBid(row: {
  psa10Usd?: number | null;
  headlineUsd?: number | null;
  gradePricesJson?: { psa10?: number | null } | null;
}): number | null {
  const n =
    row.psa10Usd ?? row.gradePricesJson?.psa10 ?? row.headlineUsd ?? null;
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Minimum bid in USDC micros (6 decimals). 0 when market is missing. */
export function minUnlistedTokenBidMicros(marketUsd: number): bigint {
  if (!Number.isFinite(marketUsd) || marketUsd <= 0) return 0n;
  const cents = Math.round(marketUsd * 100);
  if (cents <= 0) return 0n;
  const minCents = Math.ceil((cents * MIN_RATIO_NUM) / MIN_RATIO_DEN);
  return BigInt(minCents) * MICROS_PER_CENT;
}

export function minUnlistedTokenBidUsdc(marketUsd: number): number {
  return Number(minUnlistedTokenBidMicros(marketUsd)) / 1_000_000;
}

export function isUnlistedTokenBidBelowMarketFloor(
  bidMicros: bigint,
  marketUsd: number | null | undefined,
): boolean {
  if (marketUsd == null || !Number.isFinite(marketUsd) || marketUsd <= 0) {
    return false;
  }
  const min = minUnlistedTokenBidMicros(marketUsd);
  if (min <= 0n) return false;
  return bidMicros < min;
}
