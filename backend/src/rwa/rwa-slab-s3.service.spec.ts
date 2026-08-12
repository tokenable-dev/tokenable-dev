import { RwaSlabS3Service } from './rwa-slab-s3.service';

describe('RwaSlabS3Service', () => {
  const catalogCoverS3 = {
    isConfigured: jest.fn(),
    getPublicBaseUrl: jest.fn(),
    downloadRemoteImage: jest.fn(),
    putBytesAtKey: jest.fn(),
  };
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'CATALOG_COVER_S3_PREFIX') return 'dev/covers/';
      return '';
    }),
  };

  let service: RwaSlabS3Service;

  beforeEach(() => {
    jest.clearAllMocks();
    catalogCoverS3.isConfigured.mockReturnValue(true);
    catalogCoverS3.getPublicBaseUrl.mockReturnValue('https://cdn.example.com');
    service = new RwaSlabS3Service(config as never, catalogCoverS3 as never);
  });

  it('returns null from ingest when S3 is not configured', async () => {
    catalogCoverS3.isConfigured.mockReturnValue(false);
    const url = await service.ingestMintSlabBestEffort({
      chainId: 84532,
      certNumber: '84089328',
      sourceUrl: 'https://psa.example/front.jpg',
    });
    expect(url).toBeNull();
    expect(catalogCoverS3.downloadRemoteImage).not.toHaveBeenCalled();
  });

  it('ingests from buffer and returns public URL', async () => {
    catalogCoverS3.putBytesAtKey.mockResolvedValue({
      publicUrl:
        'https://cdn.example.com/dev/covers/rwa-slabs/84532/84089328/slab',
    });
    const url = await service.ingestMintSlabBestEffort({
      chainId: 84532,
      certNumber: '84089328',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
      contentType: 'image/jpeg',
    });
    expect(url).toBe(
      'https://cdn.example.com/dev/covers/rwa-slabs/84532/84089328/slab',
    );
    expect(catalogCoverS3.putBytesAtKey).toHaveBeenCalled();
  });

  it('swallows S3 download failures without throwing', async () => {
    catalogCoverS3.downloadRemoteImage.mockRejectedValue(
      new Error('CATALOG_COVER_FETCH_FAILED'),
    );
    const url = await service.ingestMintSlabBestEffort({
      chainId: 84532,
      certNumber: '84089328',
      sourceUrl: 'https://psa.example/front.jpg',
    });
    expect(url).toBeNull();
  });

  it('swallows S3 put failures without throwing', async () => {
    catalogCoverS3.downloadRemoteImage.mockResolvedValue({
      body: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
      contentType: 'image/jpeg',
      width: 600,
      height: 800,
    });
    catalogCoverS3.putBytesAtKey.mockRejectedValue(new Error('AccessDenied'));
    const url = await service.ingestMintSlabBestEffort({
      chainId: 84532,
      certNumber: '84089328',
      sourceUrl: 'https://psa.example/front.jpg',
    });
    expect(url).toBeNull();
  });

  it('accepts trusted slab URLs for matching cert + chain', () => {
    const trusted =
      'https://cdn.example.com/dev/covers/rwa-slabs/84532/84089328/slab';
    expect(
      service.normalizeTrustedMintSlabUrl(trusted, 84532, '84089328'),
    ).toBe(trusted);
  });

  it('rejects spoofed or mismatched slab URLs', () => {
    expect(
      service.normalizeTrustedMintSlabUrl(
        'https://evil.example/slab.jpg',
        84532,
        '84089328',
      ),
    ).toBeNull();
    expect(
      service.normalizeTrustedMintSlabUrl(
        'https://cdn.example.com/dev/covers/rwa-slabs/84532/99999999/slab',
        84532,
        '84089328',
      ),
    ).toBeNull();
  });
});
