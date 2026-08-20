/**
 * Unlisted token bids (no active ask) must be ≥ 70% of collection market.
 * No upper bound vs market. Keep in sync with backend
 * `token-bid-market-floor.util.ts`.
 */

export const TOKEN_BID_UNLISTED_MIN_MARKET_RATIO = 0.7;
const MIN_RATIO_NUM = 70;
const MIN_RATIO_DEN = 100;
const MICROS_PER_CENT = 10_000;

export function minUnlistedTokenBidUsdc(marketUsd: number): number {
  if (!Number.isFinite(marketUsd) || marketUsd <= 0) return 0;
  const cents = Math.round(marketUsd * 100);
  if (cents <= 0) return 0;
  const minCents = Math.ceil((cents * MIN_RATIO_NUM) / MIN_RATIO_DEN);
  return (minCents * MICROS_PER_CENT) / 1_000_000;
}

export function isUnlistedTokenBidBelowMarketFloor(
  bidUsdc: number,
  marketUsd: number | null | undefined,
): boolean {
  if (marketUsd == null || !Number.isFinite(marketUsd) || marketUsd <= 0) {
    return false;
  }
  const min = minUnlistedTokenBidUsdc(marketUsd);
  if (!(min > 0) || !Number.isFinite(bidUsdc)) return false;
  return bidUsdc + 1e-9 < min;
}
