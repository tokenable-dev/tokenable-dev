import {
  blendNearMintUnitUsdFromPreview,
  gradeStripFromPoketraceNm,
  nmHistoryDaysForBundleWindow,
} from './poketrace-grade-strip.util';
import type { PoketraceCollectionPreview } from '../poketrace/poketrace.service';

describe('poketrace-grade-strip.util', () => {
  it('nmHistoryDaysForBundleWindow maps bundle windows', () => {
    expect(nmHistoryDaysForBundleWindow('7d')).toBe(7);
    expect(nmHistoryDaysForBundleWindow('180d')).toBe(180);
    expect(nmHistoryDaysForBundleWindow('365d')).toBe(365);
  });

  it('blendNearMintUnitUsdFromPreview uses topPrice for approximate when bands absent', () => {
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
    } satisfies PoketraceCollectionPreview;
    expect(blendNearMintUnitUsdFromPreview(p)).toBe(10);
  });

  it('gradeStripFromPoketraceNm repeats NM on all slots', () => {
    expect(gradeStripFromPoketraceNm(42)).toEqual({
      psa10: 42,
      psa9: 42,
      raw: 42,
    });
  });
});
