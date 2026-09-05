import { RwaAssetResolveService } from './rwa-asset-resolve.service';
import type { RwaToken } from '../marketplace/entities/rwa-token.entity';

describe('RwaAssetResolveService', () => {
  const blockchain = {
    getResolvedRwaAsset: jest.fn(),
    batchRwaMetadata: jest.fn(),
  };
  const ipfs = {
    fetchMetadataJson: jest.fn(),
    resolveUriToHttps: jest.fn(),
    resolveImageToHttps: jest.fn(),
  };
  const config = { get: jest.fn() };
  const chainConfig = {
    getRwaAddress: jest.fn().mockReturnValue('0xrwa'),
    getDefaultChainId: jest.fn().mockReturnValue(11155111),
  };
  const rwaTokenRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
  };

  let service: RwaAssetResolveService;

  const sampleMetadata = {
    name: '2020 Panini Prizm Joe Burrow #307',
    properties: {
      graded: {
        psa: { subject: 'Joe Burrow', gradeScore: '10' },
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RwaAssetResolveService(
      blockchain as never,
      ipfs as never,
      config as never,
      chainConfig as never,
      rwaTokenRepo as never,
    );
  });

  it('batchRwaMetadata dedupes IPFS fetches by token_uri across tokens', async () => {
    const rowA = {
      tokenId: '1',
      tokenContract: '0xrwa',
      tokenUri: 'ipfs://QmShared',
      displayImageUrl: 'https://cdn.example/1.jpg',
      displayImageBackUrl: null,
    } as RwaToken;
    const rowB = {
      tokenId: '2',
      tokenContract: '0xrwa',
      tokenUri: 'ipfs://QmShared',
      displayImageUrl: 'https://cdn.example/2.jpg',
      displayImageBackUrl: null,
    } as RwaToken;

    rwaTokenRepo.find.mockResolvedValue([rowA, rowB]);
    ipfs.fetchMetadataJson.mockResolvedValue(sampleMetadata);
    ipfs.resolveUriToHttps.mockImplementation(async (uri: string) => uri);

    await service.batchRwaMetadata([1, 2], 11155111);

    expect(ipfs.fetchMetadataJson).toHaveBeenCalledTimes(1);
    expect(ipfs.fetchMetadataJson).toHaveBeenCalledWith('ipfs://QmShared');
  });

  it('batchPortfolioMetadata loads graded IPFS metadata and prefers DB slab image', async () => {
    const row = {
      tokenId: '117',
      tokenContract: '0xrwa',
      tokenUri: 'ipfs://QmMeta117',
      certNumber: '164014763',
      displayName: null,
      displayImageUrl: 'https://cdn.example/slab-117.jpg',
      displayImageBackUrl: null,
    } as RwaToken;

    rwaTokenRepo.find.mockResolvedValue([row]);
    ipfs.fetchMetadataJson.mockResolvedValue(sampleMetadata);
    ipfs.resolveUriToHttps.mockImplementation(async (uri: string) => uri);

    const { items } = await service.batchPortfolioMetadata([117], 11155111);

    expect(ipfs.fetchMetadataJson).toHaveBeenCalledWith('ipfs://QmMeta117');
    expect(blockchain.batchRwaMetadata).not.toHaveBeenCalled();
    expect(items[0]?.imageUrl).toBe('https://cdn.example/slab-117.jpg');
    expect(items[0]?.metadata).toEqual(sampleMetadata);
    expect(rwaTokenRepo.update).toHaveBeenCalledWith(
      { tokenContract: '0xrwa', tokenId: '117' },
      expect.objectContaining({
        displayName: '2020 Panini Prizm Joe Burrow #307',
      }),
    );
  });

  it('batchPortfolioMetadata falls back to on-chain for owner-index stubs without URI', async () => {
    const stub = {
      tokenId: '108',
      tokenContract: '0xrwa',
      tokenUri: null,
      metadataCid: null,
      certNumber: null,
      displayName: null,
      displayImageUrl: null,
      displayImageBackUrl: null,
    } as RwaToken;

    rwaTokenRepo.find.mockResolvedValue([stub]);
    blockchain.batchRwaMetadata.mockResolvedValue({
      items: [
        {
          tokenId: 108,
          tokenURI: 'ipfs://QmOnChain108',
          metadata: sampleMetadata,
          imageUrl: 'https://ipfs.example/108.png',
        },
      ],
    });

    const { items } = await service.batchPortfolioMetadata([108], 11155111);

    expect(blockchain.batchRwaMetadata).toHaveBeenCalledWith([108], 11155111);
    expect(items[0]?.metadata).toEqual(sampleMetadata);
    expect(items[0]?.tokenURI).toBe('ipfs://QmOnChain108');
    expect(items[0]?.imageUrl).toBe('https://ipfs.example/108.png');
    expect(rwaTokenRepo.update).toHaveBeenCalledWith(
      { tokenContract: '0xrwa', tokenId: '108' },
      expect.objectContaining({
        displayName: '2020 Panini Prizm Joe Burrow #307',
        tokenUri: 'ipfs://QmOnChain108',
      }),
    );
  });

  it('batchPortfolioMetadata falls back to cert stub when IPFS fails', async () => {
    const row = {
      tokenId: '116',
      tokenContract: '0xrwa',
      tokenUri: 'ipfs://QmMissing',
      certNumber: '78892815',
      displayName: 'Fallback Name',
      displayImageUrl: null,
      displayImageBackUrl: null,
    } as RwaToken;

    rwaTokenRepo.find.mockResolvedValue([row]);
    ipfs.fetchMetadataJson.mockRejectedValue(new Error('ipfs down'));

    const { items } = await service.batchPortfolioMetadata([116], 11155111);

    expect(items[0]?.metadata).toMatchObject({
      name: 'Fallback Name',
      properties: { graded: { psa: { certNumber: '78892815' } } },
    });
  });

  it('batchPortfolioMetadata returns thin shells for tokens missing registry and chain', async () => {
    rwaTokenRepo.find.mockResolvedValue([]);
    blockchain.batchRwaMetadata.mockResolvedValue({
      items: [
        {
          tokenId: 999,
          tokenURI: null,
          metadata: null,
          imageUrl: null,
        },
      ],
    });

    const { items } = await service.batchPortfolioMetadata([999], 11155111);

    expect(blockchain.batchRwaMetadata).toHaveBeenCalledWith([999], 11155111);
    expect(items[0]).toEqual({
      tokenId: 999,
      tokenURI: null,
      metadata: null,
      imageUrl: null,
      imageBackUrl: null,
      displayImageUrlOverride: null,
    });
  });

  it('batchRwaMetadata uses DB token_uri only (no on-chain RPC) when registry row exists', async () => {
    const row = {
      tokenId: '112',
      tokenContract: '0xrwa',
      tokenUri: 'ipfs://QmMeta112',
      displayImageUrl: 'https://cdn.example/slab-112.jpg',
      displayImageBackUrl: null,
    } as RwaToken;

    rwaTokenRepo.find.mockResolvedValue([row]);
    ipfs.fetchMetadataJson.mockResolvedValue(sampleMetadata);
    ipfs.resolveUriToHttps.mockImplementation(async (uri: string) => uri);

    const { items } = await service.batchRwaMetadata([112], 11155111);

    expect(blockchain.batchRwaMetadata).not.toHaveBeenCalled();
    expect(ipfs.fetchMetadataJson).toHaveBeenCalledWith('ipfs://QmMeta112');
    expect(items[0]?.metadata).toEqual(sampleMetadata);
    expect(items[0]?.imageUrl).toBe('https://cdn.example/slab-112.jpg');
    expect(items[0]?.displayImageUrlOverride).toBe(
      'https://cdn.example/slab-112.jpg',
    );
  });

  it('batchRwaMetadata falls back to on-chain only for tokens missing registry token_uri', async () => {
    blockchain.batchRwaMetadata.mockResolvedValue({
      items: [
        {
          tokenId: 100,
          tokenURI: 'ipfs://QmOnChain',
          metadata: sampleMetadata,
          imageUrl: null,
        },
      ],
    });

    rwaTokenRepo.find.mockResolvedValue([]);
    ipfs.fetchMetadataJson.mockResolvedValue(sampleMetadata);

    const { items } = await service.batchRwaMetadata([100], 11155111);

    expect(blockchain.batchRwaMetadata).toHaveBeenCalledWith([100], 11155111);
    expect(items[0]?.metadata).toEqual(sampleMetadata);
    expect(items[0]?.tokenURI).toBe('ipfs://QmOnChain');
  });
});
