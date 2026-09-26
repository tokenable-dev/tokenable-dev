import {
  bucketGradeScoreFromPsaGradeInput,
  cardhedgerGradeFromHistoryTier,
  classifyPsaGradePolicy,
  isMintEligiblePsaGrade,
  marketHistoryTierFromPsaGradeInput,
  mintRejectionMessage,
} from './psa-grade-policy.util';

describe('psa-grade-policy.util', () => {
  describe('mint eligibility (PSA 1–10 + AUTH)', () => {
    it.each([1, 5, 9, 10])('allows PSA %i', (score) => {
      const input = { gradingCompany: 'PSA', gradeScore: score };
      expect(classifyPsaGradePolicy(input)).not.toBe('unknown');
      expect(isMintEligiblePsaGrade(input)).toBe(true);
      expect(mintRejectionMessage(input)).toBeNull();
    });

    it('allows PSA AUTH qualifier', () => {
      const input = {
        gradingCompany: 'PSA',
        gradeLabel: 'AUTHENTIC',
      };
      expect(classifyPsaGradePolicy(input)).toBe('psa_qualifier');
      expect(isMintEligiblePsaGrade(input)).toBe(true);
      expect(mintRejectionMessage(input)).toBeNull();
    });

    it('allows PSA 7 from gradeLabel when gradeScore is missing', () => {
      const input = {
        gradingCompany: 'PSA',
        gradeLabel: 'PSA 7',
      };
      expect(classifyPsaGradePolicy(input)).toBe('psa_sub10');
      expect(isMintEligiblePsaGrade(input)).toBe(true);
      expect(mintRejectionMessage(input)).toBeNull();
    });

    it('rejects unknown grade', () => {
      const input = { gradingCompany: 'PSA' };
      expect(isMintEligiblePsaGrade(input)).toBe(false);
      expect(mintRejectionMessage(input)).toMatch(/PSA 1–10/);
    });
  });

  describe('history tier mapping', () => {
    it.each([
      [10, 'PSA_10'],
      [9, 'PSA_9'],
      [8, 'PSA_8'],
      [1, 'PSA_1'],
    ] as const)('maps numeric PSA %i → %s', (score, tier) => {
      expect(
        marketHistoryTierFromPsaGradeInput({
          gradingCompany: 'PSA',
          gradeScore: score,
        }),
      ).toBe(tier);
    });

    it('maps AUTH qualifier → PSA_AUTH', () => {
      expect(
        marketHistoryTierFromPsaGradeInput({
          gradingCompany: 'PSA',
          gradeScore: 'auth',
        }),
      ).toBe('PSA_AUTH');
    });
  });

  describe('bucket grade score', () => {
    it.each([
      [10, '10'],
      [9, '9'],
      [3, '3'],
    ] as const)('maps PSA %i → "%s"', (score, bucket) => {
      expect(
        bucketGradeScoreFromPsaGradeInput({
          gradingCompany: 'PSA',
          gradeScore: score,
        }),
      ).toBe(bucket);
    });

    it('maps AUTH → auth', () => {
      expect(
        bucketGradeScoreFromPsaGradeInput({
          gradingCompany: 'PSA',
          gradeLabel: 'AUTHENTIC',
        }),
      ).toBe('auth');
    });
  });

  describe('cardhedgerGradeFromHistoryTier', () => {
    it.each([
      ['PSA_10', 'PSA 10'],
      ['PSA_9', 'PSA 9'],
      ['PSA_3', 'PSA 3'],
      ['PSA_AUTH', 'PSA AUTH'],
    ] as const)('maps %s → %s', (tier, grade) => {
      expect(cardhedgerGradeFromHistoryTier(tier)).toBe(grade);
    });
  });
});
