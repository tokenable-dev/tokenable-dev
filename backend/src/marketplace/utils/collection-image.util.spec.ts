import {
  isPsaCertSlabCloudfrontUrl,
  pickCollectionDisplayImageUrl,
} from './collection-image.util';

describe('pickCollectionDisplayImageUrl', () => {
  it('returns catalog HTTPS URLs as-is', () => {
    expect(
      pickCollectionDisplayImageUrl(
        'https://942284f33c575895b4be9de571ca6e40.cdn.bubble.io/foo/resize',
      ),
    ).toBe(
      'https://942284f33c575895b4be9de571ca6e40.cdn.bubble.io/foo/resize',
    );
  });

  it('returns PSA spec cloudfront URLs as-is', () => {
    expect(
      pickCollectionDisplayImageUrl(
        'https://d1htnxwo4o0jhw.cloudfront.net/spec/2427023/a4PuiPdzmECPOwdi1I7juQ.jpg',
      ),
    ).toBe(
      'https://d1htnxwo4o0jhw.cloudfront.net/spec/2427023/a4PuiPdzmECPOwdi1I7juQ.jpg',
    );
  });

  it('rejects legacy normalized cover API paths', () => {
    expect(
      pickCollectionDisplayImageUrl(
        '/api/marketplace/collections/foo/cover-image.jpg',
      ),
    ).toBeNull();
  });

  it('rejects PSA cert slab even when wrongly stored as cover_image_url', () => {
    expect(
      pickCollectionDisplayImageUrl(
        'https://d1htnxwo4o0jhw.cloudfront.net/cert/143719559/uDxUkmwFzE.jpg',
      ),
    ).toBeNull();
  });

  it('returns null when cover is empty', () => {
    expect(pickCollectionDisplayImageUrl(null)).toBeNull();
    expect(pickCollectionDisplayImageUrl('')).toBeNull();
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
