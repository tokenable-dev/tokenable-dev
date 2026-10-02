import { slicePriceHistoryByDays } from './cardhedger-insight-history.util';

describe('slicePriceHistoryByDays', () => {
  const now = Math.floor(Date.now() / 1000);

  it('keeps points within the day window', () => {
    const pts = [
      { t: now - 400 * 86_400, v: 1 },
      { t: now - 30 * 86_400, v: 2 },
      { t: now - 5 * 86_400, v: 3 },
    ];
    const sliced = slicePriceHistoryByDays(pts, 90);
    expect(sliced).toHaveLength(2);
    expect(sliced[0].v).toBe(2);
    expect(sliced[1].v).toBe(3);
  });
});
