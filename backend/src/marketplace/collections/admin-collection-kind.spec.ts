import {
  adminCollectionKindSql,
  sealedBoxSimilarFacetScore,
} from './collection.service';

describe('adminCollectionKindSql', () => {
  it('splits sealed boxes from graded card rows', () => {
    expect(adminCollectionKindSql('box')).toContain("= 'sealed_box'");
    expect(adminCollectionKindSql('card')).toContain('IS DISTINCT FROM');
    expect(adminCollectionKindSql(undefined)).toBe('TRUE');
  });
});

describe('sealedBoxSimilarFacetScore', () => {
  it('ranks the same product and set above one facet', () => {
    const target = { productName: 'Booster Box', consoleName: 'Scarlet & Violet 151' };
    expect(
      sealedBoxSimilarFacetScore(
        { productName: 'Booster Box', consoleName: 'Scarlet & Violet 151' },
        target,
      ),
    ).toBe(2);
    expect(
      sealedBoxSimilarFacetScore(
        { productName: 'Elite Trainer Box', consoleName: 'scarlet & violet 151' },
        target,
      ),
    ).toBe(1);
    expect(
      sealedBoxSimilarFacetScore(
        { productName: 'Booster Box', consoleName: 'Evolving Skies' },
        target,
      ),
    ).toBe(1);
    expect(
      sealedBoxSimilarFacetScore(
        { productName: 'Tin', consoleName: 'Evolving Skies' },
        target,
      ),
    ).toBe(0);
  });
});
