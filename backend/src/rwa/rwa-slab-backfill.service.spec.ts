import { RwaSlabBackfillService } from './rwa-slab-backfill.service';

describe('RwaSlabBackfillService', () => {
  const rwaTokens = {
    find: jest.fn(),
    save: jest.fn(),
  };
  const chainConfig = {
    getDefaultChainId: jest.fn().mockReturnValue(84532),
    getRwaAddress: jest.fn().mockReturnValue('0xrwa'),
  };
  const ipfs = {
    fetchMetadataJson: jest.fn(),
  };
  const rwaSlabS3 = {
    isConfigured: jest.fn().mockReturnValue(true),
    ingestMintSlabBestEffort: jest.fn(),
    normalizeTrustedMintSlabUrl: jest.fn(),
  };

  let service: RwaSlabBackfillService;

  beforeEach(() => {
    jest.clearAllMocks();
    rwaSlabS3.isConfigured.mockReturnValue(true);
    service = new RwaSlabBackfillService(
      rwaTokens as never,
      chainConfig as never,
      ipfs as never,
      rwaSlabS3 as never,
    );
  });

  it('skips all rows when S3 is not configured', async () => {
    rwaSlabS3.isConfigured.mockReturnValue(false);
    rwaTokens.find.mockResolvedValue([
      { tokenId: '1', certNumber: '84089328', tokenUri: 'ipfs://x' },
    ]);

    const result = await service.backfillMissingDisplayImages({ limit: 10 });

    expect(result.skipped).toBe(1);
    expect(result.updated).toBe(0);
    expect(ipfs.fetchMetadataJson).not.toHaveBeenCalled();
  });

  it('skips tokens without cert or token URI', async () => {
    rwaTokens.find.mockResolvedValue([
      { tokenId: '1', certNumber: null, tokenUri: 'ipfs://x' },
      { tokenId: '2', certNumber: '111', tokenUri: null },
    ]);

    const result = await service.backfillMissingDisplayImages();

    expect(result.skipped).toBe(2);
    expect(result.details.map((d) => d.reason)).toEqual([
      'no_cert_number',
      'no_token_uri',
    ]);
  });

  it('skips when metadata has no HTTPS image source', async () => {
    rwaTokens.find.mockResolvedValue([
      {
        tokenId: '3',
        certNumber: '84089328',
        tokenUri: 'ipfs://meta',
      },
    ]);
    ipfs.fetchMetadataJson.mockResolvedValue({ image: 'ipfs://img' });

    const result = await service.backfillMissingDisplayImages();

    expect(result.skipped).toBe(1);
    expect(result.details[0]?.reason).toBe('no_https_image_source');
  });

  it('updates display_image_url when ingest succeeds', async () => {
    const row = {
      tokenId: '9',
      certNumber: '84089328',
      tokenUri: 'ipfs://meta',
      displayImageUrl: null,
    };
    rwaTokens.find.mockResolvedValue([row]);
    ipfs.fetchMetadataJson.mockResolvedValue({
      properties: {
        graded: {
          psa: {
            certImageSourceUrl:
              'https://psa.example/cert/84089328/front.jpg',
          },
        },
      },
    });
    const url =
      'https://cdn.example.com/dev/covers/rwa-slabs/84532/84089328/slab';
    rwaSlabS3.ingestMintSlabBestEffort.mockResolvedValue(url);
    rwaSlabS3.normalizeTrustedMintSlabUrl.mockReturnValue(url);

    const result = await service.backfillMissingDisplayImages();

    expect(result.updated).toBe(1);
    expect(rwaTokens.save).toHaveBeenCalledWith(
      expect.objectContaining({ displayImageUrl: url }),
    );
  });

  it('counts failed when S3 ingest returns null', async () => {
    rwaTokens.find.mockResolvedValue([
      {
        tokenId: '4',
        certNumber: '84089328',
        tokenUri: 'ipfs://meta',
      },
    ]);
    ipfs.fetchMetadataJson.mockResolvedValue({
      properties: {
        graded: {
          psa: { certImageSourceUrl: 'https://psa.example/front.jpg' },
        },
      },
    });
    rwaSlabS3.ingestMintSlabBestEffort.mockResolvedValue(null);

    const result = await service.backfillMissingDisplayImages();

    expect(result.failed).toBe(1);
    expect(rwaTokens.save).not.toHaveBeenCalled();
  });
});
