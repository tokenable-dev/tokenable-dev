import { Ga4AnalyticsCache } from './ga4-analytics-cache';

describe('Ga4AnalyticsCache', () => {
  it('returns null after TTL expires', () => {
    const cache = new Ga4AnalyticsCache<string>(50);
    cache.set('k', 'v');
    expect(cache.get('k')).toBe('v');
  });

  it('evicts expired entries on read', async () => {
    const cache = new Ga4AnalyticsCache<string>(10);
    cache.set('k', 'v');
    await new Promise((r) => setTimeout(r, 15));
    expect(cache.get('k')).toBeNull();
  });
});
