import { poketraceHistoryTierFromComponents } from './poketrace-catalog-tier.util';

describe('poketraceHistoryTierFromComponents', () => {
  it('returns PSA_10 for PSA 10', () => {
    expect(
      poketraceHistoryTierFromComponents({
        gradingCompany: 'PSA',
        gradeScore: '10',
      }),
    ).toBe('PSA_10');
  });

  it('returns PSA_8 for PSA 8', () => {
    expect(
      poketraceHistoryTierFromComponents({
        gradingCompany: 'PSA',
        gradeScore: 8,
      }),
    ).toBe('PSA_8');
  });

  it('returns NEAR_MINT for non-PSA', () => {
    expect(
      poketraceHistoryTierFromComponents({
        gradingCompany: 'BGS',
        gradeScore: '10',
      }),
    ).toBe('NEAR_MINT');
  });
});
