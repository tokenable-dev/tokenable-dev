import { addBusinessDays } from './p2p-business-days.util';

describe('addBusinessDays', () => {
  it('skips weekends', () => {
    // Friday 2026-07-17 UTC
    const fri = new Date(Date.UTC(2026, 6, 17, 12, 0, 0));
    const next = addBusinessDays(fri, 1);
    expect(next.getUTCDay()).toBe(1); // Monday
    expect(next.getUTCDate()).toBe(20);
  });

  it('adds five business days from Monday', () => {
    const mon = new Date(Date.UTC(2026, 6, 20, 12, 0, 0));
    const next = addBusinessDays(mon, 5);
    expect(next.getUTCDate()).toBe(27); // next Monday
  });
});
