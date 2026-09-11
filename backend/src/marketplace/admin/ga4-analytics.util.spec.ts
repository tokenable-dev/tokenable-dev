import {
  avgEngagementSec,
  formatDurationSec,
  formatGa4Date,
  ga4DateRange,
} from './ga4-analytics.util';

describe('ga4-analytics.util', () => {
  it('formats GA4 date dimension', () => {
    expect(formatGa4Date('20260617')).toBe('2026-06-17');
  });

  it('builds relative date range', () => {
    expect(ga4DateRange(30)).toEqual({
      startDate: '30daysAgo',
      endDate: 'today',
    });
  });

  it('computes average engagement per view', () => {
    expect(avgEngagementSec(120, 4)).toBe(30);
    expect(avgEngagementSec(10, 0)).toBeNull();
  });

  it('formats duration for display', () => {
    expect(formatDurationSec(45)).toBe('45s');
    expect(formatDurationSec(125)).toBe('2m 5s');
  });
});
