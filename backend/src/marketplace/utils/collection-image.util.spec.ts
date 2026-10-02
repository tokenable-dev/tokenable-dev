import {
  COLLECTION_COVER_PLACEHOLDER_PATH,
  isCardhedgerBubbleResizeUrl,
  isHttpOrHttpsUrl,
  isPsaCertSlabCloudfrontUrl,
  pickCollectionDisplayImageUrl,
  pickPreferredCollectionCoverUrl,
  pickPsaCertSlabBackImageRef,
  pickRwaAssetDisplayImageRef,
  pickRwaAssetHttpsSlabIngestUrl,
  pickSearchTokenImageUrl,
  withRwaSlabDisplayCacheBust,
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

  it('uses Tokenable placeholder for legacy normalized cover API paths', () => {
    expect(
      pickCollectionDisplayImageUrl(
        '/api/marketplace/collections/foo/cover-image.jpg',
      ),
    ).toBe(COLLECTION_COVER_PLACEHOLDER_PATH);
  });

  it('uses placeholder when cover is wrongly stored as PSA cert slab', () => {
    expect(
      pickCollectionDisplayImageUrl(
        'https://d1htnxwo4o0jhw.cloudfront.net/cert/143719559/uDxUkmwFzE.jpg',
      ),
    ).toBe(COLLECTION_COVER_PLACEHOLDER_PATH);
  });

  it('uses Tokenable placeholder when cover is empty', () => {
    expect(pickCollectionDisplayImageUrl(null)).toBe(
      COLLECTION_COVER_PLACEHOLDER_PATH,
    );
    expect(pickCollectionDisplayImageUrl('')).toBe(
      COLLECTION_COVER_PLACEHOLDER_PATH,
    );
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

describe('pickPsaCertSlabBackImageRef', () => {
  it('returns PSA certImageBackUrl when present', () => {
    const url =
      'https://d1htnxwo4o0jhw.cloudfront.net/cert/84089328/back.jpg';
    expect(
      pickPsaCertSlabBackImageRef({
        properties: {
          graded: {
            psa: { certImageBackUrl: url },
          },
        },
      }),
    ).toBe(url);
  });
});

describe('pickRwaAssetHttpsSlabIngestUrl', () => {
  it('returns PSA certImageSourceUrl when present', () => {
    const url =
      'https://d1htnxwo4o0jhw.cloudfront.net/cert/84089328/front.jpg';
    expect(
      pickRwaAssetHttpsSlabIngestUrl({
        properties: {
          graded: {
            psa: { certImageSourceUrl: url },
          },
        },
      }),
    ).toBe(url);
  });

  it('returns null for ipfs-only metadata image', () => {
    expect(
      pickRwaAssetHttpsSlabIngestUrl({
        image: 'ipfs://bafyImage',
        properties: { graded: { psa: { certNumber: '1' } } },
      }),
    ).toBeNull();
  });
});

describe('withRwaSlabDisplayCacheBust', () => {
  const slab =
    'https://cdn.example/dev/covers/rwa-slabs/11155111/65172349/slab';

  it('appends v= from updatedAt for slab URLs', () => {
    const out = withRwaSlabDisplayCacheBust(slab, new Date('2026-01-02T00:00:00Z'));
    expect(out).toBe(`${slab}?v=1767312000`);
  });

  it('leaves non-slab URLs unchanged', () => {
    const cover = 'https://cdn.example/dev/covers/abc/cover';
    expect(withRwaSlabDisplayCacheBust(cover, new Date())).toBe(cover);
  });
});

describe('pickRwaAssetDisplayImageRef', () => {
  const bubbleResize =
    'https://942284f33c575895b4be9de571ca6e40.cdn.bubble.io/d112/f1785814814999x241518332733346780/resize';

  it('prefers pinned NFT image over Cardhedger catalog when mintImageSource is user_upload', () => {
    const ref = pickRwaAssetDisplayImageRef({
      image: 'ipfs://QmUserSlabPhoto',
      properties: {
        mintImageSource: 'user_upload',
        graded: {
          cardhedger: {
            cardId: '1630254144684x954648640340207700',
            imageUrl: bubbleResize,
          },
        },
      },
    });
    expect(ref).toBe('ipfs://QmUserSlabPhoto');
  });
});
