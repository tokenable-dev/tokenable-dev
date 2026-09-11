import { resolveMintSlabSourceUrl } from './rwa-slab-source.util';

describe('resolveMintSlabSourceUrl', () => {
  it('returns PSA certImageSourceUrl when present', () => {
    const url =
      'https://d1htnxwo4o0jhw.cloudfront.net/cert/84089328/front.jpg';
    expect(
      resolveMintSlabSourceUrl({
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
      resolveMintSlabSourceUrl({
        image: 'ipfs://bafyImage',
        properties: { graded: { psa: { certNumber: '1' } } },
      }),
    ).toBeNull();
  });

  it('returns null for empty metadata', () => {
    expect(resolveMintSlabSourceUrl(null)).toBeNull();
    expect(resolveMintSlabSourceUrl({})).toBeNull();
  });
});
