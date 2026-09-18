import {
  fillDailyAmounts,
  fillDailyCounts,
  microsToUsdc,
  pct,
} from './platform-analytics.util';

describe('platform-analytics.util', () => {
  it('converts USDC micros', () => {
    expect(microsToUsdc('1500000')).toBe(1.5);
    expect(microsToUsdc(0)).toBe(0);
    expect(microsToUsdc('bad')).toBe(0);
  });

  it('computes funnel percentages', () => {
    expect(pct(4, 10)).toBe(40);
    expect(pct(0, 0)).toBeNull();
  });

  it('fills missing days in daily series', () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const key = today.toISOString().slice(0, 10);

    const counts = fillDailyCounts([{ day: key, count: 3 }], 3);
    expect(counts).toHaveLength(3);
    expect(counts[2]).toEqual({ date: key, count: 3 });

    const amounts = fillDailyAmounts([{ day: key, amount: '2000000' }], 2);
    expect(amounts[amounts.length - 1]?.amountUsdc).toBe(2);
  });
});
