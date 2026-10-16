import { RwaSlabBackfillService } from './rwa-slab-backfill.service';

describe('RwaSlabBackfillService', () => {
  const rwaTokens = {
    find: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
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
  const blockchain = {
    getRwaTokenURI: jest.fn(),
  };
  const config = {
    get: jest.fn().mockReturnValue('0'),
  };

  let service: RwaSlabBackfillService;

  beforeEach(() => {
    jest.clearAllMocks();
    rwaSlabS3.isConfigured.mockReturnValue(true);
    config.get.mockReturnValue('0');
    service = new RwaSlabBackfillService(
      rwaTokens as never,
      chainConfig as never,
      ipfs as never,
      rwaSlabS3 as never,
      blockchain as never,
      config as never,
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
      displayImageUrl: null as string | null,
    };
    rwaTokens.find.mockResolvedValue([row]);
    ipfs.fetchMetadataJson.mockResolvedValue({
      image: 'https://psa.example/slab.jpg',
    });
    rwaSlabS3.ingestMintSlabBestEffort.mockResolvedValue(
      'https://cdn.example/slab',
    );
    rwaSlabS3.normalizeTrustedMintSlabUrl.mockReturnValue(
      'https://cdn.example/slab',
    );
    rwaTokens.save.mockResolvedValue(row);

    const result = await service.backfillMissingDisplayImages();

    expect(result.updated).toBe(1);
    expect(row.displayImageUrl).toBe('https://cdn.example/slab');
  });

  it('backfillListReadyFields fills name cert and collection_key from IPFS', async () => {
    const row = {
      tokenId: '12',
      tokenUri: 'ipfs://meta12',
      displayName: null as string | null,
      certNumber: null as string | null,
      collectionKey: null as string | null,
      displayImageUrl: 'https://cdn.example/already.jpg',
      metadataCid: null as string | null,
      metadataSyncedAt: null as Date | null,
    };
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([row]),
    };
    rwaTokens.createQueryBuilder.mockReturnValue(qb);
    ipfs.fetchMetadataJson.mockResolvedValue({
      name: '2020 Panini Prizm Joe Burrow #307',
      properties: {
        graded: {
          gradingCompany: 'PSA',
          card: { name: 'Joe Burrow', set: 'Prizm', number: '307' },
          grade: { score: 10 },
          psa: { certNumber: '164014763' },
        },
      },
    });
    rwaTokens.save.mockResolvedValue(row);

    const result = await service.backfillListReadyFields({ limit: 10 });

    expect(result.updated).toBe(1);
    expect(row.displayName).toBe('Joe Burrow · #307 · PSA 10');
    expect(row.certNumber).toBe('164014763');
    expect(row.collectionKey).toMatch(/^[a-f0-9]{64}$/);
    expect(result.details[0]?.fields).toEqual(
      expect.arrayContaining(['display_name', 'cert_number', 'collection_key']),
    );
  });

  it('cronBackfillListReady no-ops unless RWA_LIST_READY_BACKFILL_ENABLED', async () => {
    const spy = jest.spyOn(service, 'backfillListReadyFields');
    await service.cronBackfillListReady();
    expect(spy).not.toHaveBeenCalled();
  });
});
