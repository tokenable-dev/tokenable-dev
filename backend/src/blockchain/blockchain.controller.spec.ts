import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainController } from './blockchain.controller';
import { BlockchainService } from './blockchain.service';
import { SKY_TOKEN_CONTRACT } from './constants/injection-tokens';

const mockBlockchainService = {
  getTokenInfo: jest
    .fn()
    .mockResolvedValue({ name: 'SkyToken', symbol: 'SKY', decimals: 18 }),
  getTotalSupply: jest.fn().mockResolvedValue('1000000000.0'),
  getBalance: jest.fn().mockResolvedValue('100.0'),
};

describe('BlockchainController', () => {
  let controller: BlockchainController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BlockchainController],
      providers: [
        { provide: BlockchainService, useValue: mockBlockchainService },
        { provide: SKY_TOKEN_CONTRACT, useValue: {} },
      ],
    }).compile();

    controller = module.get<BlockchainController>(BlockchainController);
  });

  describe('GET /blockchain/token/info', () => {
    it('should return token info', async () => {
      const result = await controller.getTokenInfo();
      expect(result).toEqual({ name: 'SkyToken', symbol: 'SKY', decimals: 18 });
    });
  });

  describe('GET /blockchain/token/supply', () => {
    it('should return total supply', async () => {
      const result = await controller.getTotalSupply();
      expect(result).toBe('1000000000.0');
    });
  });

  describe('GET /blockchain/token/balance/:address', () => {
    it('should return balance of address', async () => {
      const result = await controller.getBalance(
        '0xD5abDD307414718C59949Ac5465930a1F8a52691',
      );
      expect(result).toBe('100.0');
    });
  });
});
