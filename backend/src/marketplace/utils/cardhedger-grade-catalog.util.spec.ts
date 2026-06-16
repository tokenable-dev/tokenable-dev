import {
  catalogFromPricesByGradeMap,
  collectionGradeLabelFromHistoryTier,
  parseGraderFromGradeLabel,
} from './cardhedger-grade-catalog.util';

describe('cardhedger-grade-catalog.util', () => {
  it('parses grader from grade label', () => {
    expect(parseGraderFromGradeLabel('PSA 10')).toBe('PSA');
    expect(parseGraderFromGradeLabel('BGS 9.5')).toBe('BGS');
    expect(parseGraderFromGradeLabel('SGC 10')).toBe('SGC');
  });

  it('maps history tier to Cardhedger grade label', () => {
    expect(collectionGradeLabelFromHistoryTier('PSA_8')).toBe('PSA 8');
    expect(collectionGradeLabelFromHistoryTier('PSA_AUTH')).toBe('PSA AUTH');
  });

  it('sorts multi-grader catalog from pricesByGrade', () => {
    const rows = catalogFromPricesByGradeMap({
      'BGS 9.5': 120,
      'PSA 10': 200,
      'PSA 9': 150,
      Ungraded: 40,
    });
    const grades = rows.map((r) => r.grade);
    expect(grades.indexOf('PSA 10')).toBeLessThan(grades.indexOf('BGS 9.5'));
    expect(rows.find((r) => r.grade === 'PSA 10')?.priceUsd).toBe(200);
  });
});
