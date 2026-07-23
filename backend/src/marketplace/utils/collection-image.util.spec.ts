import {
  isCardhedgerBubbleResizeUrl,
  isPsaCertSlabCloudfrontUrl,
  pickCollectionDisplayImageUrl,
  pickPreferredCollectionCoverUrl,
  scoreCollectionCoverUrl,
} from './collection-image.util';

describe('scoreCollectionCoverUrl / pickPreferredCollectionCoverUrl', () => {
  const bubbleResize =
    'https://942284f33c575895b4be9de571ca6e40.cdn.bubble.io/foo/resize';
  const bubbleOther =
    'https://942284f33c575895b4be9de571ca6e40.cdn.bubble.io/foo/card.jpg';
  const pokemonLargeUrl = 'https://images.pokemontcg.io/sv3pt5/199/large.png';
  const pokemonSmallUrl = 'https://images.pokemontcg.io/sv3pt5/199/small.png';

  it('detects Bubble /resize demotion only when path ends with resize', () => {
    expect(isCardhedgerBubbleResizeUrl(bubbleResize)).toBe(true);
    expect(isCardhedgerBubbleResizeUrl(bubbleOther)).toBe(false);
    expect(isCardhedgerBubbleResizeUrl(pokemonLargeUrl)).toBe(false);
  });

  it('ranks Pokémon large above Bubble resize and non-resize', () => {
    expect(scoreCollectionCoverUrl(pokemonLargeUrl)).toBeGreaterThan(
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
