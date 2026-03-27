import {
  extractPsaCertImageUrlsFromApiBody,
  extractPsaCertImagesFromGetImagesBody,
} from './psa-cert-images.util';

describe('extractPsaCertImagesFromGetImagesBody', () => {
  it('unwraps Images wrapper when present', () => {
    const raw = {
      Images: [
        {
          ImageURL: 'https://example.com/front.jpg',
          IsFrontImage: true,
        },
      ],
    };
    const x = extractPsaCertImagesFromGetImagesBody(raw);
    expect(x.front).toBe('https://example.com/front.jpg');
  });

  it('maps ImageURL + IsFrontImage to front/back', () => {
    const raw = [
      {
        ImageURL: 'https://d1htnxwo4o0jhw.cloudfront.net/cert/132386427/large/abc_f.jpg',
        IsFrontImage: true,
      },
      {
        ImageURL: 'https://d1htnxwo4o0jhw.cloudfront.net/cert/132386427/large/abc_b.jpg',
        IsFrontImage: false,
      },
    ];
    const x = extractPsaCertImagesFromGetImagesBody(raw);
    expect(x.front).toContain('cloudfront.net');
    expect(x.front).toContain('_f.jpg');
    expect(x.back).toContain('_b.jpg');
  });
});

describe('extractPsaCertImageUrlsFromApiBody', () => {
  it('reads images.front / images.back', () => {
    const raw = {
      images: {
        front:
          'https://d1htnxwo4o0jhw.cloudfront.net/cert/132386427/large/132386427_f.jpg',
        back:
          'https://d1htnxwo4o0jhw.cloudfront.net/cert/132386427/large/132386427_b.jpg',
      },
      PSACert: { CertNumber: '132386427' },
    };
    const x = extractPsaCertImageUrlsFromApiBody(raw, '132386427');
    expect(x.front).toContain('132386427_f');
    expect(x.back).toContain('132386427_b');
  });

  it('does not fabricate URLs when no images in body', () => {
    const raw = { PSACert: { CertNumber: '132386427' } };
    const x = extractPsaCertImageUrlsFromApiBody(raw, '132386427');
    expect(x.front).toBeUndefined();
    expect(x.back).toBeUndefined();
  });
});
