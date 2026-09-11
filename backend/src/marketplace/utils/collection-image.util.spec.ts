import {
  isCardhedgerBubbleResizeUrl,
  isHttpOrHttpsUrl,
  isPsaCertSlabCloudfrontUrl,
  pickCollectionDisplayImageUrl,
  pickPreferredCollectionCoverUrl,
  pickSearchTokenImageUrl,
  rankCollectionCoverUrls,
  scoreCollectionCoverUrl,
} from './collection-image.util';

describe('isHttpOrHttpsUrl', () => {
  it('accepts http(s) and rejects ipfs / protocol-relative / empty', () => {
    expect(isHttpOrHttpsUrl('https://cdn.example/a.jpg')).toBe(true);
    expect(isHttpOrHttpsUrl('http://cdn.example/a.jpg')).toBe(true);
    expect(isHttpOrHttpsUrl('  https://cdn.example/a.jpg  ')).toBe(true);
    expect(isHttpOrHttpsUrl('ipfs://bafy')).toBe(false);
    expect(isHttpOrHttpsUrl('//cdn.example/a.jpg')).toBe(false);
    expect(isHttpOrHttpsUrl('')).toBe(false);
    expect(isHttpOrHttpsUrl(null)).toBe(false);
  });
});

describe('scoreCollectionCoverUrl / pickPreferredCollectionCoverUrl', () => {
  const bubbleResize =
    'https://942284f33c575895b4be9de571ca6e40.cdn.bubble.io/foo/resize';
  const bubbleCrop =
    'https://942284f33c575895b4be9de571ca6e40.cdn.bubble.io/foo/crop_image';
  const bubbleOther =
    'https://942284f33c575895b4be9de571ca6e40.cdn.bubble.io/foo/card.jpg';
  const pokemonLargeUrl = 'https://images.pokemontcg.io/sv3pt5/199/large.png';
  const pokemonHiresUrl = 'https://images.pokemontcg.io/sv10/49_hires.png';
  const pokemonSmallUrl = 'https://images.pokemontcg.io/sv3pt5/199/small.png';

  it('detects Bubble /resize demotion only when path ends with resize', () => {
    expect(isCardhedgerBubbleResizeUrl(bubbleResize)).toBe(true);
    expect(isCardhedgerBubbleResizeUrl(bubbleOther)).toBe(false);
    expect(isCardhedgerBubbleResizeUrl(pokemonLargeUrl)).toBe(false);
  });

  it('ranks Pokémon large / hires above Bubble crop and resize', () => {
    expect(scoreCollectionCoverUrl(pokemonLargeUrl)).toBeGreaterThan(
      scoreCollectionCoverUrl(bubbleCrop),
    );
    expect(scoreCollectionCoverUrl(pokemonHiresUrl)).toBeGreaterThan(
      scoreCollectionCoverUrl(bubbleCrop),
    );
    expect(scoreCollectionCoverUrl(bubbleCrop)).toBeGreaterThan(
      scoreCollectionCoverUrl(bubbleOther),
    );
    expect(scoreCollectionCoverUrl(bubbleOther)).toBeGreaterThan(
      scoreCollectionCoverUrl(bubbleResize),
    );
    expect(scoreCollectionCoverUrl(pokemonLargeUrl)).toBeGreaterThan(
      scoreCollectionCoverUrl(pokemonSmallUrl),
    );
  });

  it('picks the best candidate without assuming /resize exists', () => {
    expect(
      pickPreferredCollectionCoverUrl([bubbleOther, pokemonLargeUrl]),
    ).toBe(pokemonLargeUrl);
    expect(pickPreferredCollectionCoverUrl([bubbleOther])).toBe(bubbleOther);
    expect(
      pickPreferredCollectionCoverUrl([bubbleResize, bubbleOther]),
    ).toBe(bubbleOther);
    expect(
      rankCollectionCoverUrls([bubbleResize, bubbleCrop, pokemonHiresUrl]),
    ).toEqual([pokemonHiresUrl, bubbleCrop, bubbleResize]);
  });

  it('excludes platform rwa-slabs mint copies from cover ranking', () => {
    const slabCopy =
      'https://tokenable-catalog-covers.s3.ap-northeast-2.amazonaws.com/dev/covers/rwa-slabs/84532/63028611/slab';
    expect(scoreCollectionCoverUrl(slabCopy)).toBe(0);
    expect(pickPreferredCollectionCoverUrl([slabCopy, bubbleCrop])).toBe(
      bubbleCrop,
    );
  });
});

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

describe('pickSearchTokenImageUrl', () => {
  it('keeps PSA cert slab URLs for individual token hits', () => {
    const slab =
      'https://d1htnxwo4o0jhw.cloudfront.net/cert/143719559/uDxUkmwFzE.jpg';
    expect(pickSearchTokenImageUrl(slab, null)).toBe(slab);
  });

  it('falls back to catalog cover when the token has no image', () => {
    expect(
      pickSearchTokenImageUrl(
        null,
        'https://images.pokemontcg.io/sv3pt5/199/large.png',
      ),
    ).toBe('https://images.pokemontcg.io/sv3pt5/199/large.png');
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
