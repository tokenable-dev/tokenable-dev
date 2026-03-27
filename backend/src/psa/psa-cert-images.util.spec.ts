import {
  buildPsaCertImageFallbackUrls,
  extractPsaCertImageUrlsFromApiBody,
} from './psa-cert-images.util';

describe('buildPsaCertImageFallbackUrls', () => {
  it('builds large front/back jpg paths', () => {
    const u = buildPsaCertImageFallbackUrls('132386427');
    expect(u.front).toBe(
      'https://cert-images.psa.com/132386427/large/132386427_f.jpg',
    );
    expect(u.back).toBe(
      'https://cert-images.psa.com/132386427/large/132386427_b.jpg',
    );
  });
});

describe('extractPsaCertImageUrlsFromApiBody', () => {
  it('reads images.front / images.back', () => {
    const raw = {
      images: {
        front: 'https://cert-images.psa.com/132386427/large/132386427_f.jpg',
        back: 'https://cert-images.psa.com/132386427/large/132386427_b.jpg',
      },
      PSACert: { CertNumber: '132386427' },
    };
    const x = extractPsaCertImageUrlsFromApiBody(raw, '132386427');
    expect(x.front).toContain('132386427_f');
    expect(x.back).toContain('132386427_b');
  });

  it('falls back to constructed URLs when no images in body', () => {
    const raw = { PSACert: { CertNumber: '132386427' } };
    const x = extractPsaCertImageUrlsFromApiBody(raw, '132386427');
    expect(x.front).toBe(
      'https://cert-images.psa.com/132386427/large/132386427_f.jpg',
    );
  });
});
