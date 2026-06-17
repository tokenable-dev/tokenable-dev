import {
  cardNumberTokenForCardhedgerSearch,
  normalizeForExactCardNumberKey,
  relaxedCatalogMatchForAudit,
  exactCatalogMatch,
} from './card-match.util';

describe('cardNumberTokenForCardhedgerSearch', () => {
  it('strips leading zeros for numeric Pokemon-style numbers', () => {
    expect(cardNumberTokenForCardhedgerSearch('024')).toBe('#24');
    expect(cardNumberTokenForCardhedgerSearch('#024')).toBe('#24');
    expect(cardNumberTokenForCardhedgerSearch('085')).toBe('#85');
  });

  it('keeps alphanumeric promo numbers', () => {
    expect(cardNumberTokenForCardhedgerSearch('SWSH029')).toBe('#SWSH029');
  });
});

describe('normalizeForExactCardNumberKey', () => {
  it('treats PSA 085 and Cardhedger 85 as the same key', () => {
    expect(normalizeForExactCardNumberKey('085')).toBe('85');
    expect(normalizeForExactCardNumberKey('85')).toBe('85');
  });
});

describe('relaxedCatalogMatchForAudit', () => {
  const cooperFlaggRow = {
    name: 'Cooper Flagg 2025 Topps Chrome Basketball Refractor',
    number: '251',
    set: '2025 Topps Chrome Basketball',
  };

  it('accepts abbreviated mint components vs full Cardhedger catalog row', () => {
    const r = relaxedCatalogMatchForAudit(
      {
        cardName: 'cooper flagg',
        cardSet: 'topps chrome',
        cardNumber: '251',
      },
      cooperFlaggRow,
    );
    expect(r.ok).toBe(true);
    expect(r.failCodes).toEqual([]);
  });

  it('accepts PSA Subject/Brand mirrors when mint names are abbreviated', () => {
    const r = relaxedCatalogMatchForAudit(
      {
        cardName: 'cooper flagg',
        cardSet: 'topps chrome',
        cardNumber: '251',
        psaSubject: 'COOPER FLAGG',
        psaBrand: 'TOPPS CHROME',
      },
      cooperFlaggRow,
    );
    expect(r.ok).toBe(true);
  });

  it('rejects wrong card number', () => {
    const r = relaxedCatalogMatchForAudit(
      {
        cardName: 'cooper flagg',
        cardSet: 'topps chrome',
        cardNumber: '99',
      },
      cooperFlaggRow,
    );
    expect(r.ok).toBe(false);
    expect(r.failCodes).toContain('number_mismatch');
  });
});

describe('exactCatalogMatch', () => {
  it('fails abbreviated mint vs full catalog (why audit used to clear valid ids)', () => {
    const r = exactCatalogMatch(
      {
        cardName: 'cooper flagg',
        cardSet: 'topps chrome',
        cardNumber: '251',
      },
      {
        name: 'Cooper Flagg 2025 Topps Chrome Basketball Refractor',
        number: '251',
        set: { name: '2025 Topps Chrome Basketball' },
      },
    );
    expect(r.ok).toBe(false);
    expect(r.failCodes).toEqual(
      expect.arrayContaining(['name_mismatch', 'set_mismatch']),
    );
  });
});
