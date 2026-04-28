import {
  candidateGamesForCollection,
  formatGameIdLabel,
  parseCardsResponse,
  parseCardsResponseBest,
  percentChangeFromPoints,
} from './collection-market.util';

describe('collection-market.util', () => {
  it('formatGameIdLabel title-cases segments', () => {
    expect(formatGameIdLabel('pokemon')).toBe('Pokemon');
    expect(formatGameIdLabel('magic-the-gathering')).toBe('Magic The Gathering');
  });

  it('percentChangeFromPoints', () => {
    expect(percentChangeFromPoints([])).toBeNull();
    expect(
      percentChangeFromPoints([
        { t: 1, v: 100 },
        { t: 2, v: 115 },
      ]),
    ).toBeCloseTo(15, 5);
  });

  it('parseCardsResponse reads history + grades', () => {
    const now = 1_700_000_000;
    const body = {
      data: [
        {
          id: 'mock-card',
          game: 'pokemon',
          variants: [
            {
              condition: 'Near Mint',
              printing: 'Normal',
              price: 68,
              priceHistory: [
                { p: 60, t: now - 86_400 * 5 },
                { p: 68, t: now },
              ],
            },
            {
              condition: 'Lightly Played',
              printing: 'Normal',
              price: 45,
              priceHistory: [{ p: 45, t: now }],
            },
            {
              condition: 'Heavily Played',
              printing: 'Normal',
              price: 7,
              priceHistory: [{ p: 7, t: now }],
            },
          ],
        },
      ],
    };
    const out = parseCardsResponse(body);
    expect(out.gameLabel).toBe('Pokemon');
    expect(out.history.length).toBeGreaterThanOrEqual(2);
    expect(out.grades.psa10).toBe(68);
    expect(out.grades.psa9).toBe(45);
    expect(out.grades.raw).toBe(7);
  });

  it('parseCardsResponseBest picks the row with richer history', () => {
    const t0 = 1_700_000_000;
    const body = {
      data: [
        {
          game: 'pokemon',
          variants: [
            {
              condition: 'Near Mint',
              printing: 'Normal',
              price: 10,
              priceHistory: [{ p: 10, t: t0 }],
            },
          ],
        },
        {
          game: 'pokemon',
          variants: [
            {
              condition: 'Near Mint',
              printing: 'Normal',
              price: 20,
              priceHistory: [
                { p: 15, t: t0 - 100 },
                { p: 20, t: t0 },
              ],
            },
          ],
        },
      ],
    };
    const out = parseCardsResponseBest(body);
    expect(out.history.length).toBe(2);
    expect(out.grades.psa10).toBe(20);
  });

  it('candidateGamesForCollection orders games from hints', () => {
    const pokemonFirst = candidateGamesForCollection({
      queryUsed: 'Charizard ex',
      displayLabel: 'Something',
      components: {},
    });
    expect(pokemonFirst[0]).toBe('pokemon');

    const mtg = candidateGamesForCollection({
      queryUsed: 'Lightning Bolt mtg',
      displayLabel: 'Alpha',
      components: { cardName: 'Lightning Bolt' },
    });
    expect(mtg[0]).toBe('magic-the-gathering');
  });
});
