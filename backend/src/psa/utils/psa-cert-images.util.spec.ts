import { extractPsaCertImagesFromGetImagesBody } from './psa-cert-images.util';

describe('extractPsaCertImagesFromGetImagesBody', () => {
  it('accepts IsFrontImage 1 / 0', () => {
    const out = extractPsaCertImagesFromGetImagesBody([
      { ImageURL: 'https://d.cloudfront.net/a_f.jpg', IsFrontImage: 1 },
      { ImageURL: 'https://d.cloudfront.net/a_b.jpg', IsFrontImage: 0 },
    ]);
    expect(out.front).toBe('https://d.cloudfront.net/a_f.jpg');
    expect(out.back).toBe('https://d.cloudfront.net/a_b.jpg');
  });
});
