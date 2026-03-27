import {
  extractCollectionRepresentativeImage,
  extractCoverFromJustTcgCardLike,
  extractJustTcgCardIdFromMetadata,
  extractJustTcgRepresentativeImage,
} from './collection-image.util';

describe('extractCollectionRepresentativeImage', () => {
  it('prefers graded.collectionCoverImage over JustTCG', () => {
    const meta = {
      properties: {
        graded: {
          collectionCoverImage: 'ipfs://QmCrop',
          justtcg: {
            topMatch: { image: 'https://cdn.example.com/card.png' },
          },
        },
      },
    };
    expect(extractCollectionRepresentativeImage(meta)).toBe('ipfs://QmCrop');
  });

  it('prefers psa.certImageSourceUrl over JustTCG when no collectionCoverImage', () => {
    const meta = {
      properties: {
        graded: {
          psa: {
            certImageSourceUrl:
              'https://d1htnxwo4o0jhw.cloudfront.net/cert/132386427/large/132386427_f.jpg',
          },
          justtcg: {
            topMatch: { image: 'https://cdn.example.com/card.png' },
          },
        },
      },
    };
    expect(extractCollectionRepresentativeImage(meta)).toBe(
      'https://d1htnxwo4o0jhw.cloudfront.net/cert/132386427/large/132386427_f.jpg',
    );
  });
});

describe('extractJustTcgRepresentativeImage', () => {
  it('returns topMatch image URL, not root image', () => {
    const meta = {
      image: 'ipfs://slab-photo',
      properties: {
        graded: {
          justtcg: {
            topMatch: { image: 'https://cdn.example.com/card.png' },
          },
        },
      },
    };
    expect(extractJustTcgRepresentativeImage(meta)).toBe(
      'https://cdn.example.com/card.png',
    );
  });

  it('returns null when no topMatch', () => {
    expect(extractJustTcgRepresentativeImage({ image: 'ipfs://x' })).toBeNull();
  });

  it('derives TCGPlayer CDN URL from topMatch.tcgplayerId when API omits image fields', () => {
    const meta = {
      properties: {
        graded: {
          justtcg: {
            topMatch: {
              id: 'pokemon-example',
              name: 'Pikachu',
              tcgplayerId: '219042',
              variants: [],
            },
          },
        },
      },
    };
    expect(extractJustTcgRepresentativeImage(meta)).toBe(
      'https://tcgplayer-cdn.tcgplayer.com/product/219042_200w.jpg',
    );
  });

  it('extractJustTcgCardIdFromMetadata reads topMatch.id', () => {
    const meta = {
      properties: {
        graded: {
          justtcg: {
            topMatch: {
              id: 'pokemon-pikachu-ex-surging-sparks-219',
              tcgplayerId: '99999',
            },
          },
        },
      },
    };
    expect(extractJustTcgCardIdFromMetadata(meta)).toBe(
      'pokemon-pikachu-ex-surging-sparks-219',
    );
  });

  it('extractCoverFromJustTcgCardLike matches live /cards shape', () => {
    expect(
      extractCoverFromJustTcgCardLike({
        id: 'pokemon-x',
        tcgplayerId: '219042',
        variants: [],
      }),
    ).toBe('https://tcgplayer-cdn.tcgplayer.com/product/219042_200w.jpg');
  });
});
