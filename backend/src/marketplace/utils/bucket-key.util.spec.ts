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
});
