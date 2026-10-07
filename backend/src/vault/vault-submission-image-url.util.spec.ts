import { normalizeVaultSubmissionImageUrl } from './vault-submission-image-url.util';

describe('normalizeVaultSubmissionImageUrl', () => {
  it('accepts https URLs within length limit', () => {
    const url = 'https://example.com/slab.jpg';
    expect(normalizeVaultSubmissionImageUrl(url)).toBe(url);
  });

  it('rejects data URLs', () => {
    expect(
      normalizeVaultSubmissionImageUrl('data:image/jpeg;base64,abc'),
    ).toBeNull();
  });

  it('rejects non-http schemes and overlong URLs', () => {
    expect(normalizeVaultSubmissionImageUrl('ftp://x/y')).toBeNull();
    expect(normalizeVaultSubmissionImageUrl(`https://x/${'a'.repeat(2048)}`)).toBeNull();
  });
});
