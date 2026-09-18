import {
  hasCompletePsaPopulationByGrade,
  parsePsaSpecPopulationBody,
  psaPopulationByGradeRecord,
} from './psa-spec-population.util';

describe('parsePsaSpecPopulationBody', () => {
  it('parses Grade1–10 and Total from PSAPop', () => {
    const body = {
      PSAPop: {
        Grade1: 12,
        Grade2: 8,
        Grade3: 5,
        Grade4: 3,
        Grade5: 2,
        Grade6: 1,
        Grade7: 4,
        Grade8: 20,
        Grade9: 150,
        Grade10: 48_400,
        Total: 111_100,
      },
    };
    const pop = parsePsaSpecPopulationBody(body);
    expect(pop.total).toBe(111_100);
    expect(pop.grade10).toBe(48_400);
    expect(pop.byGrade['9']).toBe(150);
    expect(pop.byGrade['1']).toBe(12);
    expect(psaPopulationByGradeRecord(pop.byGrade)).toEqual({
      '1': 12,
      '2': 8,
      '3': 5,
      '4': 3,
      '5': 2,
      '6': 1,
      '7': 4,
      '8': 20,
      '9': 150,
      '10': 48_400,
    });
  });

  it('allows zero counts per grade', () => {
    const body = {
      PSAPop: {
        Grade9: 0,
        Grade10: 100,
        Total: 100,
      },
    };
    const pop = parsePsaSpecPopulationBody(body);
    expect(pop.byGrade['9']).toBe(0);
    expect(pop.byGrade['10']).toBe(100);
  });
});

describe('hasCompletePsaPopulationByGrade', () => {
  it('returns true when all grade keys are present', () => {
    const map: Record<string, number> = {};
    for (let g = 1; g <= 10; g++) map[String(g)] = g * 10;
    expect(
      hasCompletePsaPopulationByGrade({ psaPopulationByGrade: map }),
    ).toBe(true);
  });

  it('returns false when grade 9 is missing', () => {
    expect(
      hasCompletePsaPopulationByGrade({
        psaPopulationByGrade: { '10': 100, Total: 100 },
      }),
    ).toBe(false);
  });
});
