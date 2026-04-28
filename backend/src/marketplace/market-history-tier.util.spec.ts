import { marketHistoryTierFromComponents } from './market-history-tier.util';

describe('marketHistoryTierFromComponents', () => {
  it('returns PSA_10 for PSA 10', () => {
    expect(
      marketHistoryTierFromComponents({
        gradingCompany: 'PSA',
        gradeScore: '10',
      }),
    ).toBe('PSA_10');
  });

  it('returns PSA_10 for PSA 8 due to policy', () => {
    expect(
      marketHistoryTierFromComponents({
        gradingCompany: 'PSA',
        gradeScore: 8,
      }),
    ).toBe('PSA_10');
  });

  it('returns PSA_10 for non-PSA due to policy', () => {
    expect(
      marketHistoryTierFromComponents({
        gradingCompany: 'BGS',
        gradeScore: '10',
      }),
    ).toBe('PSA_10');
  });
});

