import { portfolioSnapshotCanPriceHoldings } from '../utils/portfolio-token-price.util';
import type { CollectionMarketBundle } from '../collections/collection-market.service';

function bundle(partial: Partial<CollectionMarketBundle>): CollectionMarketBundle {
  return partial as CollectionMarketBundle;
}

describe('portfolioSnapshotCanPriceHoldings', () => {
  it('returns true when cardhedger preview matched', () => {
    expect(
      portfolioSnapshotCanPriceHoldings(
        bundle({
          cardhedgerPreview: {
            matched: true,
            card: { id: 'x' } as never,
            enabled: true,
            searchQuery: 'q',
          },
        }),
      ),
    ).toBe(true);
  });

  it('returns true when grade strip has psa10', () => {
    expect(
      portfolioSnapshotCanPriceHoldings(
        bundle({ gradePrices: { psa10: 100, psa9: null, raw: null } }),
      ),
    ).toBe(true);
  });

  it('returns false for empty series', () => {
    expect(portfolioSnapshotCanPriceHoldings(null)).toBe(false);
  });
});
