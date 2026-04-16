import {
  buildPoketraceQueryFromRwaMetadata,
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
    expect(out.query).toContain('MEWTWO VSTAR');
    expect(out.query).toContain('086');
    expect(out.poketraceCardId).toBeNull();
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
    expect(out.query).toContain('legacy');
  });
});
