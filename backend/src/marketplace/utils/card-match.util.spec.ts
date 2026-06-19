import {
  cardNumberTokenForCardhedgerSearch,
  catalogRowTrustedForMarketData,
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

describe('catalogRowTrustedForMarketData', () => {
  const italianCharmanderHints = {
    cardName: 'charmander',
    cardSet: 'pokemon game',
    cardNumber: '046',
    psaSubject: 'CHARMANDER',
    psaBrand: '2000 POKEMON GAME ITALIAN',
  };

  const obsidianPromoRow = {
    name: '2023 Pokemon SV Obsidian Flames ETB Black Star Promo Charmander',
    number: '044',
    set: '2023 Pokemon SV Black Star Promo',
  };

  it('rejects 2023 Obsidian Flames promo for 2000 Italian #046 Charmander', () => {
    const r = catalogRowTrustedForMarketData(
      italianCharmanderHints,
      obsidianPromoRow,
    );
    expect(r.ok).toBe(false);
    expect(r.failCodes).toContain('number_mismatch');
  });

  it('rejects same-name wrong-era row even when card numbers were equal', () => {
    const r = catalogRowTrustedForMarketData(italianCharmanderHints, {
      ...obsidianPromoRow,
      number: '046',
    });
    expect(r.ok).toBe(false);
    expect(r.failCodes.length).toBeGreaterThan(0);
  });

  it('accepts aligned vintage catalog row', () => {
    const r = catalogRowTrustedForMarketData(italianCharmanderHints, {
      name: '2000 Pokemon Game Italian Charmander 1st Edition',
      number: '046',
      set: '2000 Pokemon Game Italian',
    });
    expect(r.ok).toBe(true);
    expect(r.failCodes).toEqual([]);
  });

  it('rejects comps when collection card number is missing', () => {
    const r = catalogRowTrustedForMarketData(
      { ...italianCharmanderHints, cardNumber: '' },
      obsidianPromoRow,
    );
    expect(r.ok).toBe(false);
    expect(r.failCodes).toContain('missing_card_number');
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
