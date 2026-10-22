import {
  buildSealedBoxMaterializedSnapshotPayload,
  pricechartingLooseHistoryToUsdPoints,
} from '../utils/market-snapshot-normalize.util';

describe('pricechartingLooseHistoryToUsdPoints', () => {
  it('turns Seoul loose-price cents into chart dollars and drops blanks', () => {
    const points = pricechartingLooseHistoryToUsdPoints([
      { observedOn: '2024-01-15', loosePriceCents: 12999 },
      { observedOn: '2024-01-16', loosePriceCents: null },
      { observedOn: 'not-a-date', loosePriceCents: 100 },
      { observedOn: '2024-01-17T00:00:00.000Z', loosePriceCents: 0 },
      { observedOn: '2024-01-18', loosePriceCents: 15050 },
    ]);
    expect(points).toEqual([
      {
        t: Math.floor(Date.parse('2024-01-15T12:00:00+09:00') / 1000),
        v: 129.99,
      },
      {
        t: Math.floor(Date.parse('2024-01-18T12:00:00+09:00') / 1000),
        v: 150.5,
      },
    ]);
  });
});

describe('buildSealedBoxMaterializedSnapshotPayload', () => {
  it('stores loose spot on gradePrices.raw for Markets list reads', () => {
    const points = pricechartingLooseHistoryToUsdPoints([
      { observedOn: '2024-01-15', loosePriceCents: 35000 },
      { observedOn: '2024-01-18', loosePriceCents: 26128 },
    ]);
    const payload = buildSealedBoxMaterializedSnapshotPayload({
      collectionKey: 'abc',
      historyPoints: points,
      spotUsd: 261.28,
      categoryLabel: 'Sealed Product',
    });
    expect(payload.spotPriceBasis).toBe('pricecharting');
    expect(payload.historyTier).toBe('PRICECHARTING');
    expect(payload.gradePricesJson.raw).toBe(261.28);
    expect(payload.rawUsd).toBe(261.28);
    expect(payload.externalUsdJson).toHaveLength(2);
    expect(payload.previewJson.matched).toBe(false);
    expect(payload.marketState).toBe('fresh');
  });
});
