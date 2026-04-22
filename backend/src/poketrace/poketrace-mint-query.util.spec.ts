import {
  buildPoketraceQueryFromRwaMetadata,
  exactPoketraceCatalogMatch,
  normalizeForExactCardNumberKey,
  normalizeForExactCatalogMatch,
  normalizePsaCardNameForPoketrace,
  primaryCardNumberForPoketrace,
} from './poketrace-mint-query.util';

describe('normalizePsaCardNameForPoketrace', () => {
  it('strips FA/ prefix from PSA-style slab text', () => {
    expect(normalizePsaCardNameForPoketrace('FA/MEWTWO VSTAR')).toBe('MEWTWO VSTAR');
  });
});

describe('primaryCardNumberForPoketrace', () => {
  it('uses leading number for secret rare 086/078 style', () => {
    expect(primaryCardNumberForPoketrace('086/078')).toBe('086');
  });
});

describe('normalizeForExactCatalogMatch', () => {
  it('folds case, spaces, and punctuation for equality keys', () => {
    expect(normalizeForExactCatalogMatch('Pokemon GO')).toBe('pokemongo');
    expect(normalizeForExactCatalogMatch('  SV  Promo  ')).toBe('svpromo');
  });
});

describe('normalizeForExactCardNumberKey', () => {
  it('strips # and non-alnum so variants align with exact compare', () => {
    expect(normalizeForExactCardNumberKey('#SV49')).toBe('sv49');
    expect(normalizeForExactCardNumberKey('086/078')).toBe('086078');
  });
});

describe('exactPoketraceCatalogMatch', () => {
  const rowOk = {
    name: 'Mewtwo VSTAR',
    cardNumber: '086/078',
    set: { name: 'Pokemon GO' },
  };

  it('accepts when all three normalized keys match', () => {
    const r = exactPoketraceCatalogMatch(
      {
        cardName: 'FA/MEWTWO VSTAR',
        cardSet: 'Pokemon GO',
        cardNumber: '086',
      },
      rowOk,
    );
    expect(r.ok).toBe(true);
    expect(r.failCodes).toEqual([]);
  });

  it('rejects set drift with set_mismatch', () => {
    const r = exactPoketraceCatalogMatch(
      {
        cardName: 'Mewtwo VSTAR',
        cardSet: 'Scarlet & Violet',
        cardNumber: '086',
      },
      rowOk,
    );
    expect(r.ok).toBe(false);
    expect(r.failCodes).toContain('set_mismatch');
    expect(r.failCodes).not.toContain('name_mismatch');
  });

  it('rejects wrong card number', () => {
    const r = exactPoketraceCatalogMatch(
      {
        cardName: 'Mewtwo VSTAR',
        cardSet: 'Pokemon GO',
        cardNumber: '085',
      },
      rowOk,
    );
    expect(r.ok).toBe(false);
    expect(r.failCodes).toContain('number_mismatch');
  });

  it('accepts practical set variants (SVP promo naming)', () => {
    const r = exactPoketraceCatalogMatch(
      {
        cardName: 'Pikachu with Grey Felt Hat',
        cardSet: 'POKEMON SVP EN-SV BLACK STAR PROMO',
        cardNumber: '085',
      },
      {
        name: 'Pikachu with Grey Felt Hat',
        cardNumber: '085',
        set: { name: 'SV Black Star Promos' },
      },
    );
    expect(r.ok).toBe(true);
    expect(r.failCodes).toEqual([]);
  });
});

describe('buildPoketraceQueryFromRwaMetadata', () => {
  it('normalizes PSA card name hints for search + scoring hints', () => {
    const out = buildPoketraceQueryFromRwaMetadata({
      name: 'FA/MEWTWO VSTAR',
      properties: {
        graded: {
          psa: {
            cardNameHint: 'FA/MEWTWO VSTAR',
            cardNumberHint: '086/078',
            setHint: 'POKEMON GO',
            year: '2022',
          },
        },
      },
    });
    expect(out.cardName).toBe('MEWTWO VSTAR');
    expect(out.cardNumber).toBe('086');
    expect(out.cardSet).toBe('POKEMON GO');
    expect(out.query).toContain('MEWTWO VSTAR');
    expect(out.query).toContain('086');
    expect(out.poketraceCardId).toBeNull();
    expect(out.approximatePoketraceCardId).toBeNull();
  });

  it('reads mint-time PokeTrace catalog id from graded.poketrace', () => {
    const out = buildPoketraceQueryFromRwaMetadata({
      properties: {
        graded: {
          poketrace: {
            cardId: 'abc-123',
            searchQuery: 'MEWTWO VSTAR 086 POKEMON GO',
          },
          justtcg: { queryUsed: 'legacy justtcg query' },
        },
      },
    });
    expect(out.poketraceCardId).toBe('abc-123');
    expect(out.approximatePoketraceCardId).toBeNull();
    expect(out.cardSet).toBe('');
    expect(out.query).toContain('legacy');
  });

  it('reads approximate catalog id from graded.poketrace', () => {
    const out = buildPoketraceQueryFromRwaMetadata({
      properties: {
        graded: {
          poketrace: {
            approximateCardId: 'approx-99',
            approximateSearchQuery: 'foo',
          },
        },
      },
    });
    expect(out.approximatePoketraceCardId).toBe('approx-99');
  });
});
