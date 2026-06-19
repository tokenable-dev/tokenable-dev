import { buildMaterializedSnapshotPayload } from './market-snapshot-normalize.util';
import type { MarketCollectionPreview } from './market-reference.types';

describe('buildMaterializedSnapshotPayload PSA estimate fallback', () => {
  const matchedNoSalesPreview: MarketCollectionPreview = {
    enabled: true,
    searchQuery: 'MEGA CHARIZARD X ex',
    matched: true,
    message: 'Catalog matched but no PSA 10 sales',
    card: {
      id: '1762730247647x683133055544505900',
      name: 'MEGA CHARIZARD X ex',
      cardNumber: '23',
      setName: 'Pokemon Mega Evolution Promo',
      setSlug: null,
      image: null,
      tcgplayerId: null,
      currency: 'USD',
      market: null,
      lastUpdated: null,
      topPrice: null,
      totalSaleCount: 0,
      hasGraded: true,
      gradedTiersAvailable: [],
      pricesByGrade: {},
      priceReliability: 'low',
      pricingSuppressedReason: 'cardhedger_no_sales_for_grade',
      ebayNearMint: null,
      tcgplayerNearMint: null,
    },
  };

  it('uses PSA estimate when Cardhedger matched but PSA 10 price is missing', () => {
    const payload = buildMaterializedSnapshotPayload({
      collectionKey: 'abc',
      historyTier: 'PSA_10',
      preview: matchedNoSalesPreview,
      historyPoints: [],
      psaEstimateUsd: 309,
    });

    expect(payload.gradePricesJson?.psa10).toBe(309);
    expect(payload.headlineUsd).toBe(309);
    expect(payload.spotPriceBasis).toBe('psa_estimate');
  });

  it('skips PSA estimate when Cardhedger already has PSA 10 price', () => {
    const preview: MarketCollectionPreview = {
      ...matchedNoSalesPreview,
      card: {
        ...matchedNoSalesPreview.card!,
        topPrice: 450,
        pricesByGrade: { PSA_10: 450 },
      },
    };

    const payload = buildMaterializedSnapshotPayload({
      collectionKey: 'abc',
      historyTier: 'PSA_10',
      preview,
      historyPoints: [],
      psaEstimateUsd: 309,
    });

    expect(payload.gradePricesJson?.psa10).toBe(450);
    expect(payload.spotPriceBasis).not.toBe('psa_estimate');
  });

  it('uses PSA estimate for PSA 9 tier when grade strip is empty', () => {
    const payload = buildMaterializedSnapshotPayload({
      collectionKey: 'abc',
      historyTier: 'PSA_9',
      preview: {
        enabled: true,
        searchQuery: 'Pikachu',
        matched: false,
        card: null,
      },
      historyPoints: [],
      psaEstimateUsd: 300,
    });

    expect(payload.gradePricesJson?.psa9).toBe(300);
    expect(payload.spotPriceBasis).toBe('psa_estimate');
  });
});
