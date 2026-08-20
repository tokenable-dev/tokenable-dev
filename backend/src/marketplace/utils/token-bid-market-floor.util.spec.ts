import {
  isUnlistedTokenBidBelowMarketFloor,
  minUnlistedTokenBidMicros,
  minUnlistedTokenBidUsdc,
  snapshotMarketUsdForTokenBid,
} from './token-bid-market-floor.util';

describe('unlisted token bid market floor', () => {
  it('sets the floor at 70% of a $100 market', () => {
    expect(minUnlistedTokenBidUsdc(100)).toBe(70);
    expect(minUnlistedTokenBidMicros(100)).toBe(70_000_000n);
  });

  it('rejects bids below the floor and allows at-or-above, including above market', () => {
    expect(isUnlistedTokenBidBelowMarketFloor(69_999_999n, 100)).toBe(true);
    expect(isUnlistedTokenBidBelowMarketFloor(70_000_000n, 100)).toBe(false);
    expect(isUnlistedTokenBidBelowMarketFloor(150_000_000n, 100)).toBe(false);
  });

  it('does not invent a floor when market is missing', () => {
    expect(isUnlistedTokenBidBelowMarketFloor(1n, null)).toBe(false);
    expect(isUnlistedTokenBidBelowMarketFloor(1n, 0)).toBe(false);
    expect(snapshotMarketUsdForTokenBid({})).toBeNull();
  });

  it('prefers psa10Usd from the snapshot row', () => {
    expect(
      snapshotMarketUsdForTokenBid({
        psa10Usd: 100,
        headlineUsd: 80,
        gradePricesJson: { psa10: 90 },
      }),
    ).toBe(100);
  });
});
