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
