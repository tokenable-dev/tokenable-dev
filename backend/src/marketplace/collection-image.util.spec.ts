import { extractCollectionRepresentativeImage } from './collection-image.util';

describe('extractCollectionRepresentativeImage', () => {
  it('prefers graded.collectionCoverImage over other candidates', () => {
    const meta = {
      properties: {
        graded: {
          collectionCoverImage: 'ipfs://QmCrop',
          cardhedger: {
            imageUrl: 'https://cdn.example.com/cardhedger.png',
          },
        },
      },
    };
    expect(extractCollectionRepresentativeImage(meta)).toBe('ipfs://QmCrop');
  });

  it('prefers psa.certImageSourceUrl when no collectionCoverImage', () => {
    const meta = {
      properties: {
        graded: {
          psa: {
            certImageSourceUrl:
              'https://d1htnxwo4o0jhw.cloudfront.net/cert/132386427/large/132386427_f.jpg',
          },
          cardhedger: {
            imageUrl: 'https://cdn.example.com/cardhedger.png',
          },
        },
      },
    };
    expect(extractCollectionRepresentativeImage(meta)).toBe(
      'https://d1htnxwo4o0jhw.cloudfront.net/cert/132386427/large/132386427_f.jpg',
    );
  });
  it('falls back to graded.cardhedger.imageUrl', () => {
    const meta = {
      properties: {
        graded: {
          cardhedger: {
            imageUrl: 'https://cdn.example.com/cardhedger.png',
          },
        },
      },
    };
    expect(extractCollectionRepresentativeImage(meta)).toBe(
      'https://cdn.example.com/cardhedger.png',
    );
  });

  it('returns null when no supported metadata image exists', () => {
    expect(extractCollectionRepresentativeImage({ image: 'ipfs://x' })).toBeNull();
  });
});
