import { parsePopulationContext } from './cardhedger-ai-insight-population.util';

describe('parsePopulationContext', () => {
  it('reads PSA population from components', () => {
    const pop = parsePopulationContext(
      {
        psaGrade10Population: 450,
        psaSpecTotalPopulation: 6000,
        psaPopulationByGrade: { '9': 2100, '8': 1900 },
      },
      null,
    );
    expect(pop.psa10).toBe(450);
    expect(pop.psa9).toBe(2100);
    expect(pop.specTotal).toBe(6000);
  });

  it('prefers stats PSA 10 population when provided', () => {
    const pop = parsePopulationContext(
      { psaGrade10Population: 450 },
      320,
    );
    expect(pop.psa10).toBe(320);
  });
});
