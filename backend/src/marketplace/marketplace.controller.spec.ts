import { Test, TestingModule } from '@nestjs/testing';
import { CollectionMarketService } from './collection-market.service';
import { CollectionService } from './collection.service';
import { MarketplaceController } from './marketplace.controller';
import { PoketraceService } from '../poketrace/poketrace.service';
import { MarketplaceService } from './marketplace.service';
import { OrderStatus } from './entities/order.entity';

describe('MarketplaceController', () => {
  const collectionService = {
    listSummaries: jest.fn(),
    findOne: jest.fn(),
    activeListingsForCollection: jest.fn(),
    activeBidsForCollection: jest.fn(),
    resolveRepresentativeImageForCollection: jest.fn(),
    merkleEligibleTokenIds: jest.fn(),
  };

  const service = {
    createOrder: jest.fn(),
    findActiveOrders: jest.fn(),
    findByTokenId: jest.fn(),
    findByHash: jest.fn(),
    cancelOrder: jest.fn(),
    fulfillOrder: jest.fn(),
    fulfillMatchedPair: jest.fn(),
  };

  const collectionMarketService = {
    batchListSnapshots: jest.fn(),
    getCollectionMarketBundle: jest.fn(),
  };

  const poketraceService = {
    getPreviewForCollection: jest.fn(),
    getNearMintHistoryForCollection: jest.fn(),
    getBatchMintPreviews: jest.fn(),
  };

  let controller: MarketplaceController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MarketplaceController],
      providers: [
        { provide: MarketplaceService, useValue: service },
        { provide: CollectionService, useValue: collectionService },
        { provide: CollectionMarketService, useValue: collectionMarketService },
        { provide: PoketraceService, useValue: poketraceService },
      ],
    }).compile();
    controller = module.get(MarketplaceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('createOrder forwards to service', async () => {
    const dto = {
      signature: '0x',
      tokenContract: '0x02819e6bc9B864649Ca348a57B4E60B4299cB3D9',
      tokenId: '0',
      considerationToken: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      considerationAmount: '1000000',
      parameters: {
        offerer: '0xD5abDD307414718C59949Ac5465930a1F8a52691',
        zone: '0x0000000000000000000000000000000000000000',
        zoneHash: `0x${'0'.repeat(64)}`,
        startTime: '1',
        endTime: '9999999999',
        orderType: 0,
        offer: [
          {
            itemType: 2,
            token: '0x02819e6bc9B864649Ca348a57B4E60B4299cB3D9',
            identifierOrCriteria: '0',
            startAmount: '1',
            endAmount: '1',
          },
        ],
        consideration: [
          {
            itemType: 1,
            token: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
            identifierOrCriteria: '0',
            startAmount: '1000000',
            endAmount: '1000000',
            recipient: '0xD5abDD307414718C59949Ac5465930a1F8a52691',
          },
        ],
        totalOriginalConsiderationItems: 1,
        salt: '1',
        conduitKey: `0x${'0'.repeat(64)}`,
        counter: '0',
      },
    };
    const saved = { id: 1, orderHash: '0xhh', status: OrderStatus.ACTIVE };
    service.createOrder.mockResolvedValue(saved);
    const out = await controller.createOrder(dto as never);
    expect(service.createOrder).toHaveBeenCalledWith(dto);
    expect(out).toBe(saved);
  });

  it('findActiveOrders forwards to service', async () => {
    service.findActiveOrders.mockResolvedValue([]);
    await expect(controller.findActiveOrders()).resolves.toEqual([]);
  });

  it('findByTokenId forwards to service', async () => {
    service.findByTokenId.mockResolvedValue([]);
    await expect(controller.findByTokenId('3')).resolves.toEqual([]);
    expect(service.findByTokenId).toHaveBeenCalledWith('3');
  });

  it('findOrder forwards to service', async () => {
    const o = { orderHash: '0xh' };
    service.findByHash.mockResolvedValue(o);
    await expect(controller.findOrder('0xh')).resolves.toBe(o);
  });

  it('cancelOrder forwards hash and caller', async () => {
    service.cancelOrder.mockResolvedValue({} as never);
    await controller.cancelOrder(
      '0xh',
      '0xD5abDD307414718C59949Ac5465930a1F8a52691',
    );
    expect(service.cancelOrder).toHaveBeenCalledWith(
      '0xh',
      '0xD5abDD307414718C59949Ac5465930a1F8a52691',
    );
  });

  it('fulfillOrder forwards to service', async () => {
    service.fulfillOrder.mockResolvedValue({} as never);
    await controller.fulfillOrder('0xh');
    expect(service.fulfillOrder).toHaveBeenCalledWith('0xh');
  });
});
