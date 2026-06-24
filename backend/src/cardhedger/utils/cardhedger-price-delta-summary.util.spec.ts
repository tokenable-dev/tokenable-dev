import { buildDeltaImportSummary } from './cardhedger-price-delta-summary.util';

describe('buildDeltaImportSummary', () => {
  it('maps updates to collections and counts unmatched rows', () => {
    const cardIdToCollectionKeys = new Map<string, string[]>([
      ['card-a', ['pikachu-base']],
      ['card-b', ['charizard-v']],
    ]);

    const summary = buildDeltaImportSummary({
      sinceIso: '2024-01-01T00:00:00.000Z',
      updates: [
        {
          card_id: 'card-a',
          grade: 'PSA 10',
          price: '120',
          card_desc: 'Pikachu Base',
          update_timestamp: '2024-01-01T01:00:00.000Z',
        },
        {
          card_id: 'card-unknown',
          grade: 'PSA 9',
          price: '50',
          update_timestamp: '2024-01-01T01:01:00.000Z',
        },
      ],
      cardIdToCollectionKeys,
    });

    expect(summary.updateCount).toBe(2);
    expect(summary.deltaMatchedCollectionCount).toBe(1);
    expect(summary.matchedCollectionCount).toBe(1);
    expect(summary.unmatchedUpdateCount).toBe(1);
    expect(summary.enqueuedCollectionKeys).toEqual(['pikachu-base']);
    expect(summary.latestTimestampIso).toBe('2024-01-01T01:01:00.000Z');
    expect(summary.matchedCollections[0]?.collectionKey).toBe('pikachu-base');
  });
});
