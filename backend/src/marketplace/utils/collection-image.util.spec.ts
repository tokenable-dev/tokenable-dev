import { pickCollectionDisplayImageUrl } from './collection-image.util';

describe('pickCollectionDisplayImageUrl', () => {
  it('prefers persisted catalog cover', () => {
    expect(
      pickCollectionDisplayImageUrl('https://cdn.example/card.png', {
        trendingSlabImageUrl: 'https://psa.example/slab.jpg',
      }),
    ).toBe('https://cdn.example/card.png');
  });

  it('falls back to trending slab when cover is empty', () => {
    expect(
      pickCollectionDisplayImageUrl(null, {
        trendingSlabImageUrl: 'https://psa.example/slab.jpg',
      }),
    ).toBe('https://psa.example/slab.jpg');
  });

  it('returns null when neither source exists', () => {
    expect(pickCollectionDisplayImageUrl('', {})).toBeNull();
  });
});
