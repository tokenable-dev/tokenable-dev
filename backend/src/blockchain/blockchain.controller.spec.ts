import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainController } from './blockchain.controller';
import { BlockchainService } from './blockchain.service';
import { USDC_CONTRACT, SKY_NFT_CONTRACT, MARKETPLACE_CONTRACT } from './constants/injection-tokens';

const mockBlockchainService = {
  getTokenInfo: jest
    .fn()
    .mockResolvedValue({ name: 'USD Coin', symbol: 'USDC', decimals: 6 }),
  getTotalSupply: jest.fn().mockResolvedValue('1000000000.0'),
  getTokenBalance: jest.fn().mockResolvedValue('500.0'),
  getNftInfo: jest
    .fn()
    .mockResolvedValue({ name: 'SkyNFT', symbol: 'SKYNFT', totalMinted: 3 }),
  getNftOwner: jest.fn().mockResolvedValue('0xD5abDD307414718C59949Ac5465930a1F8a52691'),
  getNftTokenURI: jest.fn().mockResolvedValue('ipfs://QmTest'),
  getNftBalance: jest.fn().mockResolvedValue(2),
  getNftTokensByOwner: jest.fn().mockResolvedValue([0, 1]),
  getMarketplaceListings: jest.fn().mockResolvedValue([]),
  getMarketplaceListing: jest.fn().mockResolvedValue({
    tokenId: 0,
    seller: '0xD5abDD307414718C59949Ac5465930a1F8a52691',
    price: '10.0',
    tokenURI: 'ipfs://QmTest',
  }),
};

describe('BlockchainController', () => {
  let controller: BlockchainController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BlockchainController],
      providers: [
        { provide: BlockchainService, useValue: mockBlockchainService },
        { provide: USDC_CONTRACT, useValue: {} },
        { provide: SKY_NFT_CONTRACT, useValue: {} },
        { provide: MARKETPLACE_CONTRACT, useValue: {} },
      ],
    }).compile();

    controller = module.get<BlockchainController>(BlockchainController);
  });

  describe('GET /blockchain/token/info', () => {
    it('should return USDC token info', async () => {
      const result = await controller.getTokenInfo();
      expect(result).toEqual({ name: 'USD Coin', symbol: 'USDC', decimals: 6 });
    });
  });

  describe('GET /blockchain/token/supply', () => {
    it('should return USDC total supply', async () => {
      const result = await controller.getTotalSupply();
      expect(result).toBe('1000000000.0');
    });
  });

  describe('GET /blockchain/token/balance/:address', () => {
    it('should return USDC balance of address', async () => {
      const result = await controller.getTokenBalance(
        '0xD5abDD307414718C59949Ac5465930a1F8a52691',
      );
      expect(result).toBe('500.0');
    });
  });

  describe('GET /blockchain/nft/info', () => {
    it('should return SkyNFT contract info', async () => {
      const result = await controller.getNftInfo();
      expect(result).toEqual({ name: 'SkyNFT', symbol: 'SKYNFT', totalMinted: 3 });
    });
  });

  describe('GET /blockchain/nft/tokens/:address', () => {
    it('should return tokenId list owned by address', async () => {
      const result = await controller.getNftTokensByOwner(
        '0xD5abDD307414718C59949Ac5465930a1F8a52691',
      );
      expect(result).toEqual([0, 1]);
    });
  });

  describe('GET /blockchain/marketplace/listings', () => {
    it('should return active marketplace listings', async () => {
      const result = await controller.getMarketplaceListings();
      expect(result).toEqual([]);
    });
  });

  describe('GET /blockchain/marketplace/listing/:tokenId', () => {
    it('should return listing info for a tokenId', async () => {
      const result = await controller.getMarketplaceListing(0);
      expect(result).toMatchObject({ tokenId: 0, price: '10.0' });
    });
  });
});
