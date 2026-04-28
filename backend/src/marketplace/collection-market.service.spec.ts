import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CollectionMarketService } from './collection-market.service';
import { CollectionService } from './collection.service';
import { CardhedgerMarketDataService } from './cardhedger-market-data.service';
import { Order, OrderSide, OrderStatus } from './entities/order.entity';

const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';

function usdcMicro(amount: number): string {
  return String(BigInt(Math.round(amount * 1_000_000)));
}

function minimalAskOrder(
  priceUsdc: number,
  tokenId = '1',
  considerationToken = USDC,
): Order {
  return {
    id: 1,
    orderHash: '0x1',
    offerer: '0x0',
    side: OrderSide.ASK,
    tokenContract: '0x0',
    tokenId,
    collectionKey: 'test-col',
    considerationToken,
    considerationAmount: usdcMicro(priceUsdc),
    parameters: {},
    signature: '0x',
    status: OrderStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Order;
}

describe('CollectionMarketService.getCollectionMarketStats', () => {
  let svc: CollectionMarketService;
  const collectionService = {
    findOne: jest.fn(),
    activeListingsForCollection: jest.fn(),
  };
  const cardMarketDataService = {
    getPreviewForCollection: jest.fn(),
    getNearMintHistoryForCollection: jest.fn(),
  };
  const orderRepo = { find: jest.fn() };
  const configService = {
    get: jest.fn((k: string) => (k === 'USDC_CONTRACT_ADDRESS' ? USDC : undefined)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    orderRepo.find.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectionMarketService,
        { provide: CollectionService, useValue: collectionService },
        { provide: CardhedgerMarketDataService, useValue: cardMarketDataService },
        { provide: ConfigService, useValue: configService },
        { provide: getRepositoryToken(Order), useValue: orderRepo },
      ],
    }).compile();
    svc = module.get(CollectionMarketService);
  });

  it('returns empty unreliable stats when collection row is missing (no 404)', async () => {
    collectionService.findOne.mockResolvedValue(null);
    collectionService.activeListingsForCollection.mockResolvedValue([]);
    const s = await svc.getCollectionMarketStats('missing');
    expect(s.collectionKey).toBe('missing');
    expect(s.sampleSize).toBe(0);
    expect(s.isReliable).toBe(false);
    expect(s.floor).toBeNull();
    expect(s.reference?.cardhedgerCardId).toBeNull();
  });

  it('same collectionKey + same listings yields identical stats (deterministic)', async () => {
    collectionService.findOne.mockResolvedValue({
      collectionKey: 'ab',
      components: { cardhedgerCardId: 'ref-1' },
    });
    collectionService.activeListingsForCollection.mockResolvedValue([
      minimalAskOrder(10, '1'),
      minimalAskOrder(20, '2'),
      minimalAskOrder(30, '3'),
      minimalAskOrder(40, '4'),
      minimalAskOrder(50, '5'),
    ]);
    const first = await svc.getCollectionMarketStats('AB');
    const second = await svc.getCollectionMarketStats('ab');
    expect(second).toEqual(first);
    expect(first.collectionKey).toBe('ab');
    expect(first.sampleSize).toBe(5);
    expect(first.isReliable).toBe(true);
    expect(first.dataQuality.currency).toBe('USDC');
    expect(first.dataQuality.sampleSize).toBe(5);
    expect(first.floor).not.toBeNull();
    expect(first.median).not.toBeNull();
    expect(first.reference?.cardhedgerCardId).toBe('ref-1');
  });

  it('changing cardhedgerCardId reference does not change numeric pool stats', async () => {
    collectionService.activeListingsForCollection.mockResolvedValue([
      minimalAskOrder(5, '1'),
      minimalAskOrder(15, '2'),
      minimalAskOrder(16, '3'),
      minimalAskOrder(17, '4'),
      minimalAskOrder(18, '5'),
    ]);
    collectionService.findOne.mockResolvedValueOnce({
      collectionKey: 'c',
      components: { cardhedgerCardId: 'card-a' },
    });
    const withA = await svc.getCollectionMarketStats('c');
    collectionService.findOne.mockResolvedValueOnce({
      collectionKey: 'c',
      components: { cardhedgerCardId: 'card-b' },
    });
    const withB = await svc.getCollectionMarketStats('c');
    expect(withA.reference?.cardhedgerCardId).toBe('card-a');
    expect(withB.reference?.cardhedgerCardId).toBe('card-b');
    expect(withB.floor).toBe(withA.floor);
    expect(withB.median).toBe(withA.median);
    expect(withB.p25).toBe(withA.p25);
    expect(withB.p75).toBe(withA.p75);
    expect(withB.sampleSize).toBe(withA.sampleSize);
    expect(withB.volatility).toBe(withA.volatility);
  });

  it('changing active listings updates stats immediately (same mock call order)', async () => {
    collectionService.findOne.mockResolvedValue({
      collectionKey: 'd',
      components: {},
    });
    collectionService.activeListingsForCollection
      .mockResolvedValueOnce([
        minimalAskOrder(100, '1'),
        minimalAskOrder(101, '2'),
        minimalAskOrder(102, '3'),
        minimalAskOrder(103, '4'),
        minimalAskOrder(104, '5'),
      ])
      .mockResolvedValueOnce([
        minimalAskOrder(100, '1'),
        minimalAskOrder(200, '2'),
        minimalAskOrder(210, '3'),
        minimalAskOrder(220, '4'),
        minimalAskOrder(230, '5'),
      ]);
    const one = await svc.getCollectionMarketStats('d');
    const two = await svc.getCollectionMarketStats('d');
    expect(one.sampleSize).toBe(5);
    expect(two.sampleSize).toBe(5);
    expect(one.isReliable).toBe(true);
    expect(two.isReliable).toBe(true);
    expect(one.median).not.toBe(two.median);
  });

  it('fewer than 5 USDC listings → isReliable false but pool numerics still populated', async () => {
    collectionService.findOne.mockResolvedValue({
      collectionKey: 'small',
      components: {},
    });
    collectionService.activeListingsForCollection.mockResolvedValue([
      minimalAskOrder(10, '1'),
      minimalAskOrder(20, '2'),
      minimalAskOrder(30, '3'),
    ]);
    const s = await svc.getCollectionMarketStats('small');
    expect(s.isReliable).toBe(false);
    expect(s.median).toBe(20);
    expect(s.floor).not.toBeNull();
    expect(s.sampleSize).toBe(3);
    expect(s.dataQuality.trimmed).toBe(false);
  });

  it('non-USDC consideration is ignored and logs a warning', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    collectionService.findOne.mockResolvedValue({
      collectionKey: 'cur',
      components: {},
    });
    collectionService.activeListingsForCollection.mockResolvedValue([
      minimalAskOrder(100, '1'),
      minimalAskOrder(110, '2'),
      minimalAskOrder(120, '3'),
      minimalAskOrder(130, '4'),
      minimalAskOrder(140, '5'),
      minimalAskOrder(150, '6', '0x0000000000000000000000000000000000000001'),
    ]);
    const s = await svc.getCollectionMarketStats('cur');
    expect(s.sampleSize).toBe(5);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('non-USDC'),
    );
    warnSpy.mockRestore();
  });
});
