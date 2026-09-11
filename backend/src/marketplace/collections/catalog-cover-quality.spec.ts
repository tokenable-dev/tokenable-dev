import {
  CATALOG_COVER_MIN_HEIGHT,
  CATALOG_COVER_MIN_WIDTH,
  CatalogCoverS3Service,
} from './catalog-cover-s3.service';

describe('CatalogCoverS3Service cover quality gate', () => {
  const svc = new CatalogCoverS3Service({
    get: () => undefined,
  } as never);

  it('requires at least 400x400', () => {
    expect(CATALOG_COVER_MIN_WIDTH).toBe(400);
    expect(CATALOG_COVER_MIN_HEIGHT).toBe(400);
    expect(svc.isAdequateCatalogCoverSize(187, 262)).toBe(false);
    expect(svc.isAdequateCatalogCoverSize(399, 500)).toBe(false);
    expect(svc.isAdequateCatalogCoverSize(400, 400)).toBe(true);
    expect(svc.isAdequateCatalogCoverSize(866, 1188)).toBe(true);
  });
});
