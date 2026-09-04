import { PortfolioAssetsPageService } from './portfolio-assets-page.service';

describe('PortfolioAssetsPageService', () => {
  const rwaAssetResolve = {
    batchPortfolioMetadata: jest.fn(),
  };
  const collectionService = {
    collectionKeysByTokenIds: jest.fn(),
    resolveCollectionKeyFromTokenMetadata: jest.fn(),
  };
  const collectionMarket = {
    batchPortfolioMarketData: jest.fn(),
  };
  const portfolioHoldings = {
    getHoldingsBatch: jest.fn(),
  };
  const chainConfig = {
    getDefaultChainId: jest.fn(() => 11155111),
  };
  const pageCache = {
    isEnabled: jest.fn(() => false),
    buildKey: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
  };
  const ownerIndex = {
    getTokenIdsByOwner: jest.fn(),
    isIndexReady: jest.fn(),
  };
  const blockchain = {
    getRwaTokensByOwner: jest.fn(),
    healOwnerRegistryIfIncomplete: jest.fn(),
  };

  let service: PortfolioAssetsPageService;

  beforeEach(() => {
    jest.clearAllMocks();
    ownerIndex.isIndexReady.mockResolvedValue(true);
    ownerIndex.getTokenIdsByOwner.mockResolvedValue([42, 41]);
    blockchain.healOwnerRegistryIfIncomplete.mockResolvedValue(false);
    service = new PortfolioAssetsPageService(
      rwaAssetResolve as never,
      collectionService as never,
      collectionMarket as never,
      portfolioHoldings as never,
      chainConfig as never,
      pageCache as never,
      ownerIndex as never,
      blockchain as never,
    );
  });

  it('resolves collection keys from batch metadata without chain/IPFS fallback', async () => {
    const meta = {
      properties: {
        graded: {
          gradingCompany: 'PSA',
          card: { name: 'Test Player', set: 'Topps', number: '1' },
          grade: { score: 10 },
        },
      },
    };

    rwaAssetResolve.batchPortfolioMetadata.mockResolvedValue({
      items: [
        {
          tokenId: 42,
          tokenURI: 'ipfs://x',
          metadata: meta,
          imageUrl: null,
          imageBackUrl: null,
        },
      ],
    });
    portfolioHoldings.getHoldingsBatch.mockResolvedValue([]);
    collectionService.collectionKeysByTokenIds.mockResolvedValue({
      42: 'abc123',
    });
    collectionMarket.batchPortfolioMarketData.mockResolvedValue({ items: [] });

    const result = await service.loadPage(
      '0x0000000000000000000000000000000000000001',
      [42],
    );

    expect(collectionService.resolveCollectionKeyFromTokenMetadata).not.toHaveBeenCalled();
    expect(result.collectionKeys[42]).toBe('abc123');
    expect(result.ownedTokenIds).toEqual([42, 41]);
    expect(result.mintPreviews).toEqual({});
  });

  it('loads first page from DB when tokenIds omitted', async () => {
    rwaAssetResolve.batchPortfolioMetadata.mockResolvedValue({ items: [] });
    portfolioHoldings.getHoldingsBatch.mockResolvedValue([]);
    collectionService.collectionKeysByTokenIds.mockResolvedValue({});
    collectionMarket.batchPortfolioMarketData.mockResolvedValue({ items: [] });

    const result = await service.loadPage(
      '0x0000000000000000000000000000000000000001',
      undefined,
    );

    expect(ownerIndex.getTokenIdsByOwner).toHaveBeenCalled();
    expect(blockchain.healOwnerRegistryIfIncomplete).toHaveBeenCalledWith(
      11155111,
    );
    expect(rwaAssetResolve.batchPortfolioMetadata).toHaveBeenCalledWith(
      [42, 41],
      11155111,
    );
    expect(result.ownedTokenIds).toEqual([42, 41]);
  });
});
