import {
  CATALOG_COVER_MAX_BYTES,
  catalogCoverObjectKeyFromPublicUrl,
  joinCatalogCoverPublicUrl,
  resolveCatalogCoverMime,
  sanitizeCollectionKeyForS3,
  stableCatalogCoverObjectKey,
} from './catalog-cover-s3.service';

describe('catalog-cover-s3 helpers', () => {
  it('sanitizes collection keys for S3 paths', () => {
    expect(sanitizeCollectionKeyForS3('Mock:Markets:listing-3')).toBe(
      'mock_markets_listing-3',
    );
    expect(sanitizeCollectionKeyForS3('  ABC  ')).toBe('abc');
  });

  it('builds a stable per-collection object key (no uuid)', () => {
    expect(stableCatalogCoverObjectKey('covers/', 'AbC')).toBe('covers/abc/cover');
    expect(stableCatalogCoverObjectKey('dev/covers', 'x')).toBe(
      'dev/covers/x/cover',
    );
  });

  it('joins public base URL and object key', () => {
    expect(
      joinCatalogCoverPublicUrl(
        'https://cdn.example.com/',
        'covers/abc/cover',
      ),
    ).toBe('https://cdn.example.com/covers/abc/cover');
  });

  it('extracts object key from our public URLs only', () => {
    const base = 'https://cdn.example.com';
    expect(
      catalogCoverObjectKeyFromPublicUrl(
        'https://cdn.example.com/covers/x/cover',
        base,
      ),
    ).toBe('covers/x/cover');
    expect(
      catalogCoverObjectKeyFromPublicUrl('https://other.com/covers/x/cover', base),
    ).toBeNull();
  });

  it('resolves MIME from declaration or magic bytes', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
    ]);
    const webp = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from('WEBP'),
    ]);

    expect(resolveCatalogCoverMime('image/jpeg', jpeg)).toBe('image/jpeg');
    expect(resolveCatalogCoverMime('image/jpg', jpeg)).toBe('image/jpeg');
    expect(resolveCatalogCoverMime(null, jpeg)).toBe('image/jpeg');
    expect(resolveCatalogCoverMime('application/octet-stream', png)).toBe(
      'image/png',
    );
    expect(resolveCatalogCoverMime('', webp)).toBe('image/webp');
    expect(resolveCatalogCoverMime('text/plain', Buffer.from('hi'))).toBeNull();
  });

  it('exports 8MB max upload size', () => {
    expect(CATALOG_COVER_MAX_BYTES).toBe(8 * 1024 * 1024);
  });
});
