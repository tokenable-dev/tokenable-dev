import {
  computeRobustMarketStatsFromUsdPrices,
  medianSorted,
  percentileLinear,
  sampleStdDevUsd,
  tukeyIqrInclusiveTrim,
} from './collection-market-stats.util';

describe('collection-market-stats.util', () => {
  it('computeRobustMarketStatsFromUsdPrices is deterministic for the same input', () => {
    const prices = [12, 18, 14, 16, 20, 22];
    const a = computeRobustMarketStatsFromUsdPrices(prices);
    const b = computeRobustMarketStatsFromUsdPrices([...prices]);
    expect(a).toEqual(b);
    expect(a.isReliable).toBe(true);
    expect(a.sampleSize).toBe(6);
  });

  it('medianSorted and percentileLinear behave on sorted arrays', () => {
    const s = [1, 2, 3, 4, 5];
    expect(medianSorted(s)).toBe(3);
    expect(percentileLinear(s, 0.25)).toBe(2);
    expect(percentileLinear(s, 0.75)).toBe(4);
  });

  it('sampleStdDevUsd is null when n < 2', () => {
    expect(sampleStdDevUsd([5])).toBeNull();
    expect(sampleStdDevUsd([1, 3])).not.toBeNull();
  });

  it('small sample (<5) yields isReliable false but still returns pool distribution numerics', () => {
    const s = computeRobustMarketStatsFromUsdPrices([10, 20, 30, 40]);
    expect(s.isReliable).toBe(false);
    expect(s.sampleSize).toBe(4);
    expect(s.median).toBe(25);
    expect(s.floor).toBeCloseTo(13, 5);
    expect(s.volatility).not.toBeNull();
    expect(s.trimmed).toBe(false);
  });

  it('with an extreme outlier, floor is p10 on trimmed set — not the raw minimum spike', () => {
    const raw = [100, 101, 99, 100, 100, 50_000];
    const { values, trimmed } = tukeyIqrInclusiveTrim([...raw].sort((a, b) => a - b));
    expect(trimmed).toBe(true);
    expect(values.includes(50_000)).toBe(false);
    const stats = computeRobustMarketStatsFromUsdPrices(raw);
    expect(stats.isReliable).toBe(true);
    expect(stats.floor).not.toBe(50_000);
    expect(stats.floor).toBe(percentileLinear([...values].sort((a, b) => a - b), 0.1));
    expect(stats.volatility).toBe(sampleStdDevUsd([...values].sort((a, b) => a - b)));
  });
});
