import { buildCollectionDisplayLabel, extractJustTcgQueryUsed } from './collection-label.util';
import type { MarketBucketComponents } from './bucket-key.util';

describe('collection-label.util', () => {
  const base: MarketBucketComponents = {
    gradingCompany: 'psa',
    cardName: 'pikachu/grey felt hat',
    cardSet: 'svp en-sv black star promo 2023',
    gradeScore: '9',
  };

  it('extractJustTcgQueryUsed from graded.justtcg', () => {
    const meta = {
      properties: {
        graded: {
          justtcg: {
            queryUsed: 'PIKACHU/GREY FELT HAT  POKEMON  SVP  #085',
          },
        },
      },
    };
    expect(extractJustTcgQueryUsed(meta)).toBe(
      'PIKACHU/GREY FELT HAT POKEMON SVP #085',
    );
  });

  it('buildCollectionDisplayLabel prefers queryUsed', () => {
    expect(
      buildCollectionDisplayLabel(base, 'PIKACHU/GREY FELT HAT … #085'),
    ).toBe('PIKACHU/GREY FELT HAT … #085');
  });

  it('buildCollectionDisplayLabel falls back to name company grade', () => {
    const s = buildCollectionDisplayLabel(base, null);
    expect(s).toContain('pikachu/grey felt hat');
    expect(s).toContain('PSA');
    expect(s).toContain('9');
  });
});
