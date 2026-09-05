import {
  certPriceDiffPct,
  normalizeCertDigits,
  parseCertPriceResult,
} from './cardhedger-cert-price.util';

describe('cardhedger-cert-price.util', () => {
  it('normalizes cert digits', () => {
    expect(normalizeCertDigits('PSA 76676185')).toBe('76676185');
    expect(normalizeCertDigits('123')).toBe('');
  });

  it('parses batch-prices-by-cert row', () => {
    const parsed = parseCertPriceResult({
      cert_info: { cert: '76676185', grade: 'PSA 10', description: 'Test' },
      card: { card_id: 'abc', description: 'Card' },
      price: 125.5,
      price_low: 110,
      price_high: 140,
      confidence: 0.82,
      method: 'direct',
      card_source: 'gemrate_id',
      match_confidence: 0.95,
    });
    expect(parsed?.cert).toBe('76676185');
    expect(parsed?.price).toBe(125.5);
    expect(parsed?.card?.card_id).toBe('abc');
    expect(parsed?.certInfo?.grade).toBe('PSA 10');
  });

  it('computes diff pct', () => {
    expect(certPriceDiffPct(110, 100)).toBe(10);
    expect(certPriceDiffPct(null, 100)).toBeNull();
  });
});
