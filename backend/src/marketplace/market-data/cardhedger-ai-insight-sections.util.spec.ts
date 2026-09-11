import {
  buildAiInsightSections,
  historyToMiniSeries,
} from './cardhedger-ai-insight-sections.util';
import type { AiInsightSectionInput } from './cardhedger-ai-insight.types';
import type { CollectionAiInsightPricingStats } from './cardhedger-market-data.types';

function baseStats(
  overrides: Partial<CollectionAiInsightPricingStats> = {},
): CollectionAiInsightPricingStats {
  return {
    psa10SpotUsd: 1200,
    rawSpotUsd: 400,
    premiumVsRawPct: 200,
    sales7d: 4,
    sales30d: 18,
    change7dPct: 2.5,
    change30dPct: 6.2,
    change90dPct: 12.4,
    change365dPct: 28.0,
    points90d: 24,
    points365d: 120,
    psaTotalPopulation: 320,
    psa10PriceConfidence: 'high',
    psa10PricingNote: null,
    psa10SpotLowUsd: 1100,
    psa10SpotHighUsd: 1350,
    psa10CatalogUsd: 1200,
    ...overrides,
  };
}

function baseInput(
  overrides: Partial<AiInsightSectionInput> = {},
): AiInsightSectionInput {
  const now = Math.floor(Date.now() / 1000);
  return {
    displayLabel: 'Charizard Base Set',
    gradeLabel: 'PSA 10',
    stats: baseStats(),
    history90: [
      { t: now - 80 * 86_400, v: 1000 },
      { t: now - 60 * 86_400, v: 1050 },
      { t: now - 40 * 86_400, v: 1100 },
      { t: now - 20 * 86_400, v: 1180 },
      { t: now - 5 * 86_400, v: 1200 },
    ],
    history365: [
      { t: now - 300 * 86_400, v: 800 },
      { t: now - 200 * 86_400, v: 950 },
      { t: now - 100 * 86_400, v: 1100 },
      { t: now - 5 * 86_400, v: 1200 },
    ],
    compsRaw: [
      { t: now - 3 * 86_400, v: 1220, platform: 'eBay' },
      { t: now - 10 * 86_400, v: 1180, platform: 'PWCC' },
      { t: now - 18 * 86_400, v: 1150, platform: 'eBay' },
    ],
    compsLowUsd: 1150,
    compsHighUsd: 1220,
    fmv: null,
    allPricesRow: null,
    matchConfidence: 'verified',
    psaCertNumber: '12345678',
    population: {
      psa10: 320,
      psa9: 1800,
      specTotal: 5000,
      byGrade: { '9': 1800, '8': 2200 },
      hasCompleteByGrade: false,
    },
    enrichment: {
      platform: {
        activeListingCount: 2,
        floorUsd: 1250,
        listingPricesUsd: [1250, 1300],
      },
      watchlistCount: 3,
      psaCertSnapshot: {
        CertNumber: '12345678',
        CardGrade: '10',
        IsValidRequest: true,
      },
      top100Rank: null,
      listingGradeScore: '10',
    },
    components: {
      year: 1999,
      cardSet: 'Base Set',
      gradeScore: '10',
      gradingCompany: 'PSA',
    },
    marketTone: 'Uptrend',
    riskScore: 35,
    riskLabel: 'Low',
    ...overrides,
  };
}

describe('buildAiInsightSections', () => {
  it('builds market performance from real trend windows', () => {
    const sections = buildAiInsightSections(baseInput());
    expect(sections.marketPerformance?.trends).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ window: '30d', changePct: 6.2 }),
        expect.objectContaining({ window: '90d', changePct: 12.4 }),
      ]),
    );
    expect(sections.marketPerformance?.commentary.length).toBeGreaterThan(0);
  });

  it('omits sections when underlying data is absent', () => {
    const sections = buildAiInsightSections(
      baseInput({
        stats: baseStats({
          change7dPct: null,
          change30dPct: null,
          change90dPct: null,
          change365dPct: null,
          sales7d: null,
          sales30d: null,
        }),
        compsRaw: [],
        history90: [],
        population: {
          psa10: null,
          psa9: null,
          specTotal: null,
          byGrade: null,
          hasCompleteByGrade: false,
        },
        psaCertNumber: null,
        enrichment: {
          platform: {
            activeListingCount: 0,
            floorUsd: null,
            listingPricesUsd: [],
          },
          watchlistCount: 0,
          psaCertSnapshot: null,
          top100Rank: null,
          listingGradeScore: null,
        },
      }),
    );
    expect(sections.marketPerformance).toBeUndefined();
    expect(sections.salesTimeline).toBeUndefined();
    expect(sections.rarity).toBeUndefined();
    expect(sections.psaVerification).toBeUndefined();
  });

  it('derives demand score algorithmically', () => {
    const sections = buildAiInsightSections(baseInput());
    expect(sections.demand?.score).toBeGreaterThan(0);
    expect(sections.demand?.score).toBeLessThanOrEqual(100);
    expect(sections.demand?.reasoning.length).toBeGreaterThan(0);
  });

  it('builds sales timeline from comps only', () => {
    const sections = buildAiInsightSections(baseInput());
    expect(sections.salesTimeline?.entries).toHaveLength(3);
    expect(sections.salesTimeline?.entries[0].marketplace).toBe('eBay');
  });
});

describe('historyToMiniSeries', () => {
  it('returns real price values without fabrication', () => {
    const series = historyToMiniSeries([
      { t: 1, v: 100 },
      { t: 2, v: 110 },
      { t: 3, v: 105 },
    ]);
    expect(series).toEqual([100, 110, 105]);
  });

  it('returns empty array when insufficient points', () => {
    expect(historyToMiniSeries([{ t: 1, v: 100 }])).toEqual([]);
  });
});
