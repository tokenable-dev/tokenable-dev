import {
  CARDHEDGER_FMV_BATCH_MAX_ITEMS,
  cardhedgerFmvMapKey,
  chunkFmvBatchItems,
  parseCardhedgerFmvRecord,
  type CardhedgerFmvBatchItem,
} from './cardhedger-fmv.util';

describe('cardhedger-fmv.util', () => {
  it('cardhedgerFmvMapKey normalizes grade case', () => {
    expect(cardhedgerFmvMapKey('abc', 'PSA 10')).toBe('abc:psa 10');
  });

  it('chunkFmvBatchItems splits at 100', () => {
    const items = Array.from({ length: 150 }, (_, i) => i);
    const chunks = chunkFmvBatchItems(items);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(100);
    expect(chunks[1]).toHaveLength(50);
  });

  it('parseCardhedgerFmvRecord maps batch item fields', () => {
    const parsed = parseCardhedgerFmvRecord({
      card_id: 'x',
      grade: 'PSA 10',
      price: 416.25,
      price_low: 397.26,
      price_high: 435.24,
      confidence: 0.66,
      confidence_grade: 'B',
      method: 'direct',
      freshness_days: 1,
    });
    expect(parsed).toEqual({
      price: 416.25,
      price_low: 397.26,
      price_high: 435.24,
      confidence: 0.66,
      confidence_grade: 'B',
      method: 'direct',
      freshness_days: 1,
    });
  });

  it('parseCardhedgerFmvRecord returns null price for no_data', () => {
    const parsed = parseCardhedgerFmvRecord({
      price: null,
      method: 'no_data',
      confidence_grade: 'D',
    });
    expect(parsed?.price).toBeNull();
    expect(parsed?.method).toBe('no_data');
  });

  it('dedupes batch items by map key preserving first', () => {
    const items: CardhedgerFmvBatchItem[] = [
      { card_id: 'a', grade: 'PSA 10' },
      { card_id: 'a', grade: 'PSA 10' },
      { card_id: 'b', grade: 'PSA 9' },
    ];
    const seen = new Set<string>();
    const unique = items.filter((it) => {
      const k = cardhedgerFmvMapKey(it.card_id, it.grade);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    expect(unique).toHaveLength(2);
    expect(CARDHEDGER_FMV_BATCH_MAX_ITEMS).toBe(100);
  });
});
