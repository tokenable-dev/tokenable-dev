import {
  BUCKET_KEY_VERSION,
  computeMarketBucketKey,
  extractBucketComponentsFromMetadata,
  isSealedBoxCollectionComponents,
  sealedBoxCollectionComponents,
  sealedBoxCollectionKey,
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

  it('keys a sealed box by PriceCharting product, not the graded bucket', () => {
    const key = sealedBoxCollectionKey('10021227');
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(sealedBoxCollectionKey(' 10021227 ')).toBe(key);
    expect(sealedBoxCollectionKey('10021228')).not.toBe(key);
    expect(sealedBoxCollectionKey('')).toBeNull();

    const graded = extractBucketComponentsFromMetadata({
      properties: {
        assetKind: 'sealed_box',
        pricechartingProductId: '10021227',
        graded: {
          gradingCompany: 'PSA',
          card: { name: 'Pikachu', set: 'Base Set', number: '58' },
          grade: { score: '10' },
        },
      },
    });
    expect(computeMarketBucketKey(graded!)).not.toBe(key);

    const components = sealedBoxCollectionComponents({
      id: '10021227',
      productName: 'Booster Box',
      consoleName: 'Pokemon Chinese Gem Pack 2',
      genre: 'Pokemon Card',
      releaseDate: '2024-03-01',
      upc: '0820650852581',
      loosePriceCents: 12999,
      salesVolume: 12,
    });
    expect(isSealedBoxCollectionComponents(components)).toBe(true);
    expect(components).toMatchObject({
      assetKind: 'sealed_box',
      pricechartingProductId: '10021227',
      productName: 'Booster Box',
      consoleName: 'Pokemon Chinese Gem Pack 2',
      language: 'CN',
      year: 2024,
      loosePriceCents: 12999,
      salesVolume: 12,
    });
    expect(components).not.toHaveProperty('gradeScore');
    expect(components).not.toHaveProperty('cardName');
  });

  it('stores JP/KR on sealed-box components from catalog names', () => {
    expect(
      sealedBoxCollectionComponents({
        id: '1',
        productName: 'Booster Box',
        consoleName: 'Pokemon Japanese Scarlet & Violet 151',
      }).language,
    ).toBe('JP');
    expect(
      sealedBoxCollectionComponents({
        id: '2',
        productName: 'Pokemon Korean Sword & Shield Booster Box',
        consoleName: 'Sword & Shield',
      }).language,
    ).toBe('KR');
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

  it('joins the same Pokémon spec when Variety only repeats the set name', () => {
    const card = {
      name: 'FA/MEW VMAX',
      set: 'POKEMON JAPANESE SWORD & SHIELD VSTAR UNIVERSE',
      number: '054',
    };
    const withSetNameVariety = {
      properties: {
        graded: {
          gradingCompany: 'PSA',
          card,
          grade: { score: '10' },
          psa: {
            brand: 'POKEMON JAPANESE SWORD & SHIELD VSTAR UNIVERSE',
            Variety: 'VSTAR UNIVERSE',
          },
        },
      },
    };
    const withoutVariety = {
      properties: {
        graded: {
          gradingCompany: 'PSA',
          card,
          grade: { score: '10' },
          psa: { brand: 'POKEMON JAPANESE SWORD & SHIELD VSTAR UNIVERSE' },
        },
      },
    };
    const a = extractBucketComponentsFromMetadata(withSetNameVariety)!;
    const b = extractBucketComponentsFromMetadata(withoutVariety)!;
    expect(a.marketParallelKey).toBe('base');
    expect(b.marketParallelKey).toBe('base');
    expect(computeMarketBucketKey(a)).toBe(computeMarketBucketKey(b));
  });

  it('still splits Base vs a real parallel Variety', () => {
    const card = {
      name: 'Victor Wembanyama',
      set: 'Panini Prizm',
      number: '136',
    };
    const silver = extractBucketComponentsFromMetadata({
      properties: {
        graded: {
          gradingCompany: 'PSA',
          card,
          grade: { score: '10' },
          psa: { brand: 'PANINI PRIZM', Variety: 'SILVER PRIZM' },
        },
      },
    })!;
    const base = extractBucketComponentsFromMetadata({
      properties: {
        graded: {
          gradingCompany: 'PSA',
          card,
          grade: { score: '10' },
          psa: { brand: 'PANINI PRIZM' },
        },
      },
    })!;
    expect(silver.marketParallelKey).toBe('silver_prizm');
    expect(base.marketParallelKey).toBe('base');
    expect(computeMarketBucketKey(silver)).not.toBe(computeMarketBucketKey(base));
  });
});
