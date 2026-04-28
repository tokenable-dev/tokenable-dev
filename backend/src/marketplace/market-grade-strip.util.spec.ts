import {
  blendNearMintUnitUsdFromPreview,
  gradeStripFromMarketNm,
  nmHistoryDaysForBundleWindow,
} from './market-grade-strip.util';
import type { MarketCollectionPreview } from './market-reference.types';

describe('market-grade-strip.util', () => {
  it('nmHistoryDaysForBundleWindow maps bundle windows', () => {
    expect(nmHistoryDaysForBundleWindow('7d')).toBe(7);
    expect(nmHistoryDaysForBundleWindow('180d')).toBe(180);
    expect(nmHistoryDaysForBundleWindow('365d')).toBe(365);
  });

  it('blendNearMintUnitUsdFromPreview returns null by policy', () => {
    const p = {
      enabled: true,
      matched: true,
      matchConfidence: 'approximate' as const,
      searchQuery: 'q',
      card: {
        id: 'x',
        name: 'A',
        cardNumber: '1',
        setName: 'S',
        setSlug: null,
        image: null,
        tcgplayerId: null,
        currency: 'USD',
        market: 'US',
        lastUpdated: null,
        topPrice: 10,
        totalSaleCount: null,
        hasGraded: false,
        gradedTiersAvailable: [],
        ebayNearMint: null,
        tcgplayerNearMint: null,
      },
    } satisfies MarketCollectionPreview;
    expect(blendNearMintUnitUsdFromPreview(p)).toBeNull();
  });

  it('gradeStripFromMarketNm keeps PSA10 only', () => {
    expect(gradeStripFromMarketNm(42)).toEqual({
      psa10: 42,
      psa9: null,
      raw: null,
    });
  });
});

