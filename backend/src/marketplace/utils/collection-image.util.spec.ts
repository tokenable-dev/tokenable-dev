import {
  isPsaCertSlabCloudfrontUrl,
  pickCollectionDisplayImageUrl,
} from './collection-image.util';

describe('pickCollectionDisplayImageUrl', () => {
  it('returns persisted catalog cover', () => {
    expect(
      pickCollectionDisplayImageUrl('https://cdn.example/card.png', {
        trendingSlabImageUrl:
          'https://d1htnxwo4o0jhw.cloudfront.net/cert/1/x.jpg',
      }),
    ).toBe('https://cdn.example/card.png');
  });

  it('never falls back to trending slab (PSA cert or otherwise)', () => {
    expect(
      pickCollectionDisplayImageUrl(null, {
        trendingSlabImageUrl: 'https://psa.example/slab.jpg',
      }),
    ).toBeNull();
    expect(
      pickCollectionDisplayImageUrl(null, {
        psaSpecId: '2427023',
        trendingSlabImageUrl:
          'https://d1htnxwo4o0jhw.cloudfront.net/cert/143719559/uDxUkmwFzE.jpg',
      }),
    ).toBeNull();
  });

  it('rejects PSA cert slab even when wrongly stored as cover_image_url', () => {
    expect(
      pickCollectionDisplayImageUrl(
        'https://d1htnxwo4o0jhw.cloudfront.net/cert/143719559/uDxUkmwFzE.jpg',
        {},
      ),
    ).toBeNull();
  });

  it('returns null when cover is empty', () => {
    expect(pickCollectionDisplayImageUrl('', {})).toBeNull();
  });
});

describe('isPsaCertSlabCloudfrontUrl', () => {
  it('detects cert cloudfront paths', () => {
    expect(
      isPsaCertSlabCloudfrontUrl(
        'https://d1htnxwo4o0jhw.cloudfront.net/cert/143719559/uDxUkmwFzE.jpg',
      ),
    ).toBe(true);
    expect(
      isPsaCertSlabCloudfrontUrl(
        'https://d1htnxwo4o0jhw.cloudfront.net/spec/2427023/a4PuiPdzmECPOwdi1I7juQ.jpg',
      ),
    ).toBe(false);
  });
});
