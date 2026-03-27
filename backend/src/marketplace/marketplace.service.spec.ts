import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BucketBidService } from './bucket-bid.service';
import { CollectionService } from './collection.service';
import { MarketplaceService } from './marketplace.service';
import { Order, OrderSide, OrderStatus } from './entities/order.entity';

const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';

const mockConfig = {
  get: jest.fn((k: string) => (k === 'USDC_CONTRACT_ADDRESS' ? USDC : undefined)),
};

const mockBucketBidService = {
  assertPoolBidMatchesSeaportBid: jest.fn().mockResolvedValue(undefined),
  markPoolBidFulfilledIfLinked: jest.fn().mockResolvedValue(undefined),
};

const mockCollectionService = {
  ensureCollectionForListing: jest.fn().mockResolvedValue(null),
};

function baseParameters() {
  return {
    offerer: '0xD5abDD307414718C59949Ac5465930a1F8a52691',
    zone: '0x0000000000000000000000000000000000000000',
    zoneHash: `0x${'0'.repeat(64)}`,
    startTime: '1',
    endTime: '9999999999',
    orderType: 0,
    offer: [
      {
        itemType: 2,
        token: '0x8d14F1518A185A7966AE6e8a6ab94AfC8E4EF6ec',
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
  };
}

describe('MarketplaceService', () => {
  let service: MarketplaceService;
  let repo: jest.Mocked<
    Pick<
      Repository<Order>,
      'findOne' | 'create' | 'save' | 'find' | 'update' | 'createQueryBuilder'
    >
  >;

  beforeEach(async () => {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    repo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    } as unknown as jest.Mocked<
      Pick<
        Repository<Order>,
        | 'findOne'
        | 'create'
        | 'save'
        | 'find'
        | 'update'
        | 'createQueryBuilder'
      >
    >;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketplaceService,
        { provide: getRepositoryToken(Order), useValue: repo },
        { provide: ConfigService, useValue: mockConfig },
        { provide: BucketBidService, useValue: mockBucketBidService },
        { provide: CollectionService, useValue: mockCollectionService },
      ],
    }).compile();
    service = module.get(MarketplaceService);
  });

  it('createOrder rejects duplicate active listing', async () => {
    repo.findOne.mockResolvedValue({ id: 1 } as Order);
    await expect(
      service.createOrder({
        parameters: baseParameters() as never,
        signature: '0x',
        tokenContract: '0x8d14F1518A185A7966AE6e8a6ab94AfC8E4EF6ec',
        tokenId: '0',
        considerationToken: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        considerationAmount: '1000000',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('createOrder saves new order', async () => {
    repo.findOne.mockResolvedValue(null);
    const created = {
      orderHash: '0x',
      status: OrderStatus.ACTIVE,
    } as Order;
    repo.create.mockReturnValue(created);
    repo.save.mockResolvedValue(created);

    const dto = {
      parameters: baseParameters() as never,
      signature: '0xsig',
      tokenContract: '0x8d14F1518A185A7966AE6e8a6ab94AfC8E4EF6ec',
      tokenId: '1',
      considerationToken: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      considerationAmount: '1000000',
    };
    const out = await service.createOrder(dto);
    expect(repo.create).toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalled();
    expect(out).toBe(created);
  });

  it('findByHash throws when missing', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.findByHash('0xmissing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('cancelOrder rejects non-offerer', async () => {
    repo.findOne.mockResolvedValue({
      orderHash: '0xh',
      status: OrderStatus.ACTIVE,
      offerer: '0x0000000000000000000000000000000000000001',
    } as Order);
    await expect(
      service.cancelOrder('0xh', '0x0000000000000000000000000000000000000002'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fulfillOrder sets fulfilled and cancels other active orders for same token', async () => {
    const row = {
      orderHash: '0xh',
      status: OrderStatus.ACTIVE,
      side: OrderSide.ASK,
      tokenContract: '0x8d14F1518A185A7966AE6e8a6ab94AfC8E4EF6ec',
      tokenId: '1',
    } as Order;
    repo.findOne.mockResolvedValue(row);
    repo.save.mockImplementation((o) => Promise.resolve(o as Order));
    repo.update.mockResolvedValue({ affected: 2, raw: [], generatedMaps: [] } as never);
    const out = await service.fulfillOrder('0xh');
    expect(out.status).toBe(OrderStatus.FULFILLED);
    expect(mockBucketBidService.markPoolBidFulfilledIfLinked).toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith(
      {
        tokenContract: row.tokenContract,
        tokenId: row.tokenId,
        status: OrderStatus.ACTIVE,
      },
      { status: OrderStatus.CANCELLED },
    );
  });
});
