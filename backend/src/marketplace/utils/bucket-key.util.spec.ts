import {
  BUCKET_KEY_VERSION,
  computeMarketBucketKey,
  extractBucketComponentsFromMetadata,
} from './bucket-key.util';

describe('bucket-key.util', () => {
  it('computes stable collection_key for graded metadata', () => {
    const meta = {
      properties: {
        graded: {
          gradingCompany: 'PSA',
          card: { name: 'Pikachu', set: 'Base Set', number: '58' },
          grade: { score: '10' },
          psa: { Variety: 'Holo' },
        },
      },
    };
    const comp = extractBucketComponentsFromMetadata(meta);
    expect(comp).not.toBeNull();
    const key1 = computeMarketBucketKey(comp!);
    const key2 = computeMarketBucketKey(comp!);
    expect(key1).toBe(key2);
    expect(key1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('exposes bucket key version for migrations', () => {
    expect(BUCKET_KEY_VERSION).toBeGreaterThanOrEqual(2);
  });

  it('separates PSA 9 and PSA 10 into different collection keys', () => {
    const base = {
      gradingCompany: 'PSA',
      card: { name: 'Pikachu', set: 'Base Set', number: '58' },
      psa: { Variety: 'Holo' },
    };
    const meta10 = {
      properties: {
        graded: { ...base, grade: { score: '10' } },
      },
    };
    const meta9 = {
      properties: {
        graded: { ...base, grade: { score: '9' } },
      },
    };
    const key10 = computeMarketBucketKey(extractBucketComponentsFromMetadata(meta10)!);
    const key9 = computeMarketBucketKey(extractBucketComponentsFromMetadata(meta9)!);
    expect(key10).not.toBe(key9);
  });
});
