import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MarketplaceNotification } from '../entities/marketplace-notification.entity';
import { Order, OrderSide, OrderStatus } from '../entities/order.entity';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  const saved: MarketplaceNotification[] = [];

  const notificationsRepo = {
    findOne: jest.fn(
      async ({
        where,
      }: {
        where: { recipientWallet: string; dedupeKey: string };
      }) =>
        saved.find(
          (r) =>
            r.recipientWallet === where.recipientWallet &&
            r.dedupeKey === where.dedupeKey,
        ) ?? null,
    ),
    create: jest.fn((partial: Partial<MarketplaceNotification>) => ({
      ...partial,
    })),
    save: jest.fn(async (row: MarketplaceNotification) => {
      const withId = { ...row, id: saved.length + 1, createdAt: new Date() };
      saved.push(withId as MarketplaceNotification);
      return withId;
    }),
    find: jest.fn(async () => saved),
  };

  const askQuery = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };

  const orderRepo = {
    createQueryBuilder: jest.fn(() => askQuery),
  };

  beforeEach(async () => {
    saved.length = 0;
    jest.clearAllMocks();
    askQuery.getOne.mockResolvedValue(null);

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(MarketplaceNotification),
          useValue: notificationsRepo,
        },
        { provide: getRepositoryToken(Order), useValue: orderRepo },
      ],
    }).compile();

    service = moduleRef.get(NotificationsService);
  });

  const tokenBid = (overrides?: Partial<Order>): Order =>
    ({
      orderHash: '0xbidhash',
      offerer: '0xBUYER0000000000000000000000000000000001',
      side: OrderSide.BID,
      tokenContract: '0xRWA',
      tokenId: '42',
      considerationAmount: '38000000',
      collectionKey: 'ck',
      status: OrderStatus.ACTIVE,
      parameters: {
        offer: [{ itemType: 1, startAmount: '38000000' }],
        consideration: [{ itemType: 2, identifierOrCriteria: '42' }],
      },
      ...overrides,
    }) as Order;

  it('creates a bid notification for the active ask owner', async () => {
    askQuery.getOne.mockResolvedValue({
      orderHash: '0xaskhash',
      offerer: '0xSELLER000000000000000000000000000000001',
      collectionKey: 'ck',
      side: OrderSide.ASK,
      status: OrderStatus.ACTIVE,
      tokenId: '42',
    });

    await service.notifyAskOwnerOfTokenBid(tokenBid());

    expect(notificationsRepo.save).toHaveBeenCalledTimes(1);
    expect(saved[0].recipientWallet).toBe(
      '0xseller000000000000000000000000000000001',
    );
    expect(saved[0].type).toBe('bid');
    expect(saved[0].dedupeKey).toBe('token_bid:0xbidhash');
    expect(saved[0].payload).toMatchObject({
      bidOrderHash: '0xbidhash',
      tokenId: '42',
      askOrderHash: '0xaskhash',
    });
  });

  it('skips when there is no active ask', async () => {
    await service.notifyAskOwnerOfTokenBid(tokenBid());
    expect(notificationsRepo.save).not.toHaveBeenCalled();
  });

  it('skips self-bids (same wallet as ask offerer)', async () => {
    askQuery.getOne.mockResolvedValue({
      orderHash: '0xaskhash',
      offerer: '0xBUYER0000000000000000000000000000000001',
      collectionKey: 'ck',
    });
    await service.notifyAskOwnerOfTokenBid(tokenBid());
    expect(notificationsRepo.save).not.toHaveBeenCalled();
  });

  it('is idempotent for the same bid hash', async () => {
    askQuery.getOne.mockResolvedValue({
      orderHash: '0xaskhash',
      offerer: '0xSELLER000000000000000000000000000000001',
      collectionKey: 'ck',
    });
    await service.notifyAskOwnerOfTokenBid(tokenBid());
    await service.notifyAskOwnerOfTokenBid(tokenBid());
    expect(notificationsRepo.save).toHaveBeenCalledTimes(1);
  });

  it('builds accept-offer href on list items', async () => {
    saved.push({
      id: 9,
      recipientWallet: '0xseller',
      type: 'bid',
      title: 'New offer',
      body: 'body',
      dedupeKey: 'token_bid:0xbid',
      payload: {
        bidOrderHash: '0xbid',
        tokenId: '7',
        askOrderHash: '0xask',
      },
      readAt: null,
      createdAt: new Date('2026-07-23T00:00:00.000Z'),
    } as MarketplaceNotification);

    const items = await service.listForWallets(['0xSELLER']);
    expect(items[0].href).toBe(
      '/portfolio?acceptBid=0xbid&tokenId=7&askHash=0xask',
    );
    expect(items[0].ctaLabel).toBe('Accept offer');
  });
});
