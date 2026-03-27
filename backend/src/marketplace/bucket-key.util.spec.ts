import {
  computeMarketBucketKey,
  extractBucketComponentsFromMetadata,
} from './bucket-key.util';

describe('bucket-key.util', () => {
  it('extracts components from properties.graded', () => {
    const meta = {
      properties: {
        graded: {
          gradingCompany: 'PSA',
          card: { name: 'Pikachu', set: 'Van Gogh' },
          grade: { score: 10 },
        },
      },
    };
    const c = extractBucketComponentsFromMetadata(meta);
    expect(c).toEqual({
      gradingCompany: 'psa',
      cardName: 'pikachu',
      cardSet: 'van gogh',
      gradeScore: '10',
    });
  });

  it('computes deterministic 64-char hex key', () => {
    const c = {
      gradingCompany: 'psa',
      cardName: 'pikachu',
      cardSet: 'van gogh',
      gradeScore: '10',
    };
    const k = computeMarketBucketKey(c);
    expect(k).toMatch(/^[0-9a-f]{64}$/);
    expect(computeMarketBucketKey(c)).toBe(k);
  });

  it('returns null without graded block', () => {
    expect(extractBucketComponentsFromMetadata({ name: 'x' })).toBeNull();
  });
});
