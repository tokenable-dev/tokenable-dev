import {
  bucketGradeScoreFromPsaGradeInput as feBucket,
  classifyPsaGradePolicy as feClassify,
  isMintEligiblePsaGrade as feMint,
  marketHistoryTierFromPsaGradeInput as feTier,
} from '@/lib/market/psaGradePolicy';
import {
  bucketGradeScoreFromPsaGradeInput,
  classifyPsaGradePolicy,
  isMintEligiblePsaGrade,
  marketHistoryTierFromPsaGradeInput,
  type PsaGradePolicyInput,
} from './psa-grade-policy.util';

/**
 * BE and FE keep separate copies (no shared package). These cases must stay
 * identical so mint eligibility and Markets history tiers do not drift.
 */
const CASES: Array<{ name: string; input: PsaGradePolicyInput }> = [
  { name: 'PSA 10', input: { gradingCompany: 'PSA', gradeScore: 10 } },
  { name: 'PSA 7', input: { gradingCompany: 'PSA', gradeScore: 7 } },
  { name: 'PSA 1', input: { gradingCompany: 'PSA', gradeScore: 1 } },
  { name: 'label PSA 7', input: { gradingCompany: 'PSA', gradeLabel: 'PSA 7' } },
  { name: 'AUTHENTIC', input: { gradingCompany: 'PSA', gradeLabel: 'AUTHENTIC' } },
  { name: 'auth score', input: { gradingCompany: 'PSA', gradeScore: 'auth' } },
  { name: 'empty', input: { gradingCompany: 'PSA' } },
];

describe('psa-grade-policy FE/BE parity (no shared package)', () => {
  it.each(CASES)('$name classify / mint / tier / bucket match', ({ input }) => {
    expect(feClassify(input)).toBe(classifyPsaGradePolicy(input));
    expect(feMint(input)).toBe(isMintEligiblePsaGrade(input));
    expect(feTier(input)).toBe(marketHistoryTierFromPsaGradeInput(input));
    expect(feBucket(input)).toBe(bucketGradeScoreFromPsaGradeInput(input));
  });
});
