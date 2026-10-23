import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ChainConfigService } from '../../blockchain/chain-config.service';
import { UserService } from '../../user/user.service';
import { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import { MarketplaceNotification } from '../entities/marketplace-notification.entity';
import { Order, OrderSide, OrderStatus } from '../entities/order.entity';
import { RwaToken } from '../entities/rwa-token.entity';
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
    find: jest.fn(
      async ({
        where,
      }: {
        where: { recipientWallet?: unknown; chainId?: number };
      }) => {
        const chainId = where.chainId;
        return saved.filter((r) =>
          chainId == null ? true : r.chainId === chainId,
        );
      },
    ),
    createQueryBuilder: jest.fn(() => ({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn(async () => ({ affected: 0 })),
    })),
  };

  const askQuery = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getMany: jest.fn(),
  };

  const orderRepo = {
    createQueryBuilder: jest.fn(() => askQuery),
    find: jest.fn(async () => []),
  };

  const rwaTokensRepo = {
    findOne: jest.fn(),
  };

  const collectionsRepo = {
    findOne: jest.fn(),
  };

  const chainConfig = {
    resolveChainIdFromRwaAddress: jest.fn(() => 11155111),
    getDefaultChainId: jest.fn(() => 11155111),
  };

  const users = {
    listWalletsForUser: jest.fn(async () => [
      {
        walletAddress: '0xSELLER000000000000000000000000000000001',
        isPrimary: true,
      },
    ]),
  };

  const config = {
    get: jest.fn((key: string) =>
      key === 'PLATFORM_FEE_BPS' ? '250' : undefined,
    ),
  };

  beforeEach(async () => {
    saved.length = 0;
    jest.clearAllMocks();
    askQuery.getOne.mockResolvedValue(null);
    askQuery.getMany.mockResolvedValue([]);
    rwaTokensRepo.findOne.mockResolvedValue(null);
    collectionsRepo.findOne.mockResolvedValue(null);
    chainConfig.resolveChainIdFromRwaAddress.mockReturnValue(11155111);

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(MarketplaceNotification),
          useValue: notificationsRepo,
        },
        { provide: getRepositoryToken(Order), useValue: orderRepo },
        { provide: getRepositoryToken(RwaToken), useValue: rwaTokensRepo },
        {
          provide: getRepositoryToken(MarketplaceCollection),
          useValue: collectionsRepo,
        },
        { provide: ChainConfigService, useValue: chainConfig },
        { provide: UserService, useValue: users },
        { provide: ConfigService, useValue: config },
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
      considerationAmount: '54500000000',
      collectionKey: 'ck',
      status: OrderStatus.ACTIVE,
      parameters: {
        offer: [{ itemType: 1, startAmount: '54500000000' }],
        consideration: [{ itemType: 2, identifierOrCriteria: '42' }],
      },
      ...overrides,
    }) as Order;

  it('creates a top-bid notification for the active ask owner', async () => {
    askQuery.getOne.mockResolvedValue({
      orderHash: '0xaskhash',
      offerer: '0xSELLER000000000000000000000000000000001',
      collectionKey: 'ck',
      side: OrderSide.ASK,
      status: OrderStatus.ACTIVE,
      tokenId: '42',
    });
    rwaTokensRepo.findOne.mockResolvedValue({
      displayName: 'LeBron James Rookie Chrome · BGS 9.5',
      displayImageUrl: 'https://cdn.example/lebron.png',
      collectionKey: 'ck',
    });

    await service.notifyAskOwnerOfTokenBid(tokenBid());

    expect(notificationsRepo.save).toHaveBeenCalledTimes(1);
    expect(saved[0].recipientWallet).toBe(
      '0xseller000000000000000000000000000000001',
    );
    expect(saved[0].chainId).toBe(11155111);
    expect(saved[0].type).toBe('bid');
    expect(saved[0].title).toBe(
      'Top bid updated on your LeBron James Rookie Chrome · BGS 9.5',
    );
    expect(saved[0].body).toBe('The highest bid is now $54,500.');
    expect(saved[0].dedupeKey).toBe('top_bid:0xbidhash');
    expect(saved[0].payload).toMatchObject({
      eventKey: 'SELLER_TOP_BID_UPDATED',
      bidOrderHash: '0xbidhash',
      tokenId: '42',
      askOrderHash: '0xaskhash',
      cardLabel: 'LeBron James Rookie Chrome · BGS 9.5',
      imageUrl: 'https://cdn.example/lebron.png',
      ctaLabel: 'Edit price',
    });
  });

  it('skips top-bid notify when the bid is not a new high', async () => {
    askQuery.getOne.mockResolvedValue({
      orderHash: '0xaskhash',
      offerer: '0xSELLER000000000000000000000000000000001',
      collectionKey: 'ck',
    });
    askQuery.getMany.mockResolvedValue([
      {
        orderHash: '0xhigher',
        offerer: '0xOTHER',
        status: OrderStatus.ACTIVE,
        side: OrderSide.BID,
        tokenId: '42',
        tokenContract: '0xRWA',
        considerationAmount: '60000000000',
        parameters: {
          offer: [{ itemType: 1, startAmount: '60000000000' }],
          consideration: [{ itemType: 2 }],
        },
      },
    ]);

    await service.notifyAskOwnerOfTokenBid(tokenBid());
    expect(notificationsRepo.save).not.toHaveBeenCalled();
  });

  it('stores Polygon chainId when the bid RWA is on Polygon', async () => {
    chainConfig.resolveChainIdFromRwaAddress.mockReturnValue(137);
    askQuery.getOne.mockResolvedValue({
      orderHash: '0xaskhash',
      offerer: '0xSELLER000000000000000000000000000000001',
      collectionKey: 'ck',
    });

    await service.notifyAskOwnerOfTokenBid(tokenBid());

    expect(saved[0].chainId).toBe(137);
  });

  it('lists only notifications for the requested chain', async () => {
    saved.push(
      {
        id: 1,
        recipientWallet: '0xseller',
        chainId: 11155111,
        type: 'bid',
        title: 'Sepolia bid',
        body: 'body',
        dedupeKey: 'token_bid:0xsepolia',
        payload: {},
        readAt: null,
        createdAt: new Date(),
      } as MarketplaceNotification,
      {
        id: 2,
        recipientWallet: '0xseller',
        chainId: 137,
        type: 'bid',
        title: 'Polygon bid',
        body: 'body',
        dedupeKey: 'token_bid:0xpolygon',
        payload: {},
        readAt: null,
        createdAt: new Date(),
      } as MarketplaceNotification,
    );

    const sepolia = await service.listForWallets(['0xSELLER'], 11155111);
    expect(sepolia.map((i) => i.title)).toEqual(['Sepolia bid']);

    const polygon = await service.listForWallets(['0xSELLER'], 137);
    expect(polygon.map((i) => i.title)).toEqual(['Polygon bid']);
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

  it('creates a cancelled-bid notification for the active ask owner', async () => {
    askQuery.getOne.mockResolvedValue({
      orderHash: '0xaskhash',
      offerer: '0xSELLER000000000000000000000000000000001',
      collectionKey: 'ck',
      tokenId: '42',
    });
    rwaTokensRepo.findOne.mockResolvedValue({
      displayName: 'LeBron James Rookie Chrome · BGS 9.5',
      displayImageUrl: 'https://cdn.example/lebron.png',
      collectionKey: 'ck',
    });

    await service.notifyAskOwnerOfTokenBidCancelled(
      tokenBid({ status: OrderStatus.CANCELLED }),
    );

    expect(notificationsRepo.save).toHaveBeenCalledTimes(1);
    expect(saved[0].title).toBe('Offer cancelled');
    expect(saved[0].dedupeKey).toBe('token_bid_cancelled:0xbidhash');
    expect(saved[0].payload).toMatchObject({
      event: 'cancelled',
      eventKey: 'SELLER_BID_CANCELLED',
    });
  });

  it('skips cancelled notify without an active ask', async () => {
    await service.notifyAskOwnerOfTokenBidCancelled(
      tokenBid({ status: OrderStatus.CANCELLED }),
    );
    expect(notificationsRepo.save).not.toHaveBeenCalled();
  });

  it('notifies ask owner when a bid is unfilled', async () => {
    askQuery.getOne.mockResolvedValue({
      orderHash: '0xaskhash',
      offerer: '0xSELLER000000000000000000000000000000001',
      collectionKey: 'ck',
      tokenId: '42',
    });
    rwaTokensRepo.findOne.mockResolvedValue({
      displayName: 'LeBron James Rookie Chrome · BGS 9.5',
      displayImageUrl: 'https://cdn.example/lebron.png',
      collectionKey: 'ck',
    });

    await service.notifyAskOwnerOfUnfilledBid(
      tokenBid({ status: OrderStatus.CANCELLED }),
    );

    expect(notificationsRepo.save).toHaveBeenCalledTimes(1);
    expect(saved[0].title).toBe('Offer could not be filled');
    expect(saved[0].body).toContain('buyer could not pay');
    expect(saved[0].dedupeKey).toBe('token_bid_unfilled:0xbidhash');
    expect(saved[0].payload).toMatchObject({
      event: 'unfilled',
      bidOrderHash: '0xbidhash',
      askOrderHash: '0xaskhash',
    });
  });

  it('notifies the bidder when their dead bid is removed', async () => {
    rwaTokensRepo.findOne.mockResolvedValue({
      displayName: 'LeBron James Rookie Chrome · BGS 9.5',
      displayImageUrl: 'https://cdn.example/lebron.png',
      collectionKey: 'ck',
    });

    await service.notifyBidderOfDeadBid(
      tokenBid({ status: OrderStatus.CANCELLED }),
    );

    expect(notificationsRepo.save).toHaveBeenCalledTimes(1);
    expect(saved[0].recipientWallet).toBe(
      '0xbuyer0000000000000000000000000000000001',
    );
    expect(saved[0].title).toBe("Your offer couldn't be filled");
    expect(saved[0].body).toBe('Add funds and re-bid.');
    expect(saved[0].dedupeKey).toBe('token_bid_dead_bidder:0xbidhash');
    expect(saved[0].payload).toMatchObject({
      event: 'dead_bidder',
      eventKey: 'BUYER_FILL_FAILED',
      bidOrderHash: '0xbidhash',
      tokenId: '42',
      ctaLabel: 'Add funds',
    });
  });

  it('is idempotent for bidder dead-bid notify', async () => {
    await service.notifyBidderOfDeadBid(
      tokenBid({ status: OrderStatus.CANCELLED }),
    );
    await service.notifyBidderOfDeadBid(
      tokenBid({ status: OrderStatus.CANCELLED }),
    );
    expect(notificationsRepo.save).toHaveBeenCalledTimes(1);
  });

  it('does not build accept-offer href for cancelled bid notifications', async () => {
    saved.push({
      id: 10,
      recipientWallet: '0xseller',
      chainId: 11155111,
      type: 'bid',
      title: 'Offer cancelled',
      body: 'body',
      dedupeKey: 'token_bid_cancelled:0xbid',
      payload: {
        event: 'cancelled',
        bidOrderHash: '0xbid',
        tokenId: '7',
        askOrderHash: '0xask',
      },
      readAt: null,
      createdAt: new Date('2026-07-23T00:00:00.000Z'),
    } as MarketplaceNotification);

    const items = await service.listForWallets(['0xSELLER'], 11155111);
    expect(items[0].href).toBeNull();
    expect(items[0].ctaLabel).toBeNull();
  });

  it('builds edit-price href on list items', async () => {
    saved.push({
      id: 9,
      recipientWallet: '0xseller',
      chainId: 11155111,
      type: 'bid',
      title: 'Top bid updated',
      body: 'body',
      dedupeKey: 'top_bid:0xbid',
      payload: {
        eventKey: 'SELLER_TOP_BID_UPDATED',
        bidOrderHash: '0xbid',
        tokenId: '7',
        askOrderHash: '0xask',
        imageUrl: 'https://cdn.example/card.png',
        // Legacy bare portfolio href must be upgraded on read.
        href: '/portfolio',
      },
      readAt: null,
      createdAt: new Date('2026-07-23T00:00:00.000Z'),
    } as MarketplaceNotification);

    const items = await service.listForWallets(['0xSELLER'], 11155111);
    expect(items[0].href).toBe('/portfolio?tab=assets&setprice=7');
    expect(items[0].ctaLabel).toBe('Edit price');
    expect(items[0].imageUrl).toBe('https://cdn.example/card.png');
    expect(items[0].chainId).toBe(11155111);
  });

  it('rewrites legacy portfolio hrefs for bid / sale CTAs', async () => {
    saved.push(
      {
        id: 11,
        recipientWallet: '0xseller',
        chainId: 11155111,
        type: 'bid',
        title: 'Bid placed',
        body: 'body',
        dedupeKey: 'bid_placed:0xbid',
        payload: {
          eventKey: 'BUYER_BID_PLACED',
          href: '/portfolio',
          ctaLabel: 'View bids',
        },
        readAt: null,
        createdAt: new Date('2026-07-23T00:00:00.000Z'),
      } as MarketplaceNotification,
      {
        id: 12,
        recipientWallet: '0xseller',
        chainId: 11155111,
        type: 'trade',
        title: 'Sold',
        body: 'body',
        dedupeKey: 'seller_sold:0xask',
        payload: {
          eventKey: 'SELLER_SOLD',
          href: '/portfolio',
          ctaLabel: 'View sale',
        },
        readAt: null,
        createdAt: new Date('2026-07-23T00:00:01.000Z'),
      } as MarketplaceNotification,
    );

    const items = await service.listForWallets(['0xSELLER'], 11155111);
    const byId = new Map(items.map((i) => [i.id, i]));
    expect(byId.get(11)?.href).toBe('/portfolio?tab=bids');
    expect(byId.get(12)?.href).toBe('/portfolio?tab=history');
  });

  it('emits seller sold with net after fees', async () => {
    rwaTokensRepo.findOne.mockResolvedValue({
      displayName: 'Card A',
      displayImageUrl: null,
      collectionKey: 'ck',
    });

    await service.notifyTradeSettled({
      ask: {
        orderHash: '0xask',
        offerer: '0xSELLER000000000000000000000000000000001',
        side: OrderSide.ASK,
        tokenContract: '0xRWA',
        tokenId: '42',
        considerationAmount: '100000000',
        collectionKey: 'ck',
        status: OrderStatus.FULFILLED,
        parameters: {},
      } as Order,
      bid: tokenBid({
        orderHash: '0xbidhash',
        status: OrderStatus.FULFILLED,
        considerationAmount: '100000000',
        parameters: {
          offer: [{ itemType: 1, startAmount: '100000000' }],
          consideration: [{ itemType: 2 }],
        },
      }),
      settlementMicros: '100000000',
    });

    const titles = saved.map((r) => r.title);
    expect(titles).toContain('Sold — Card A at $100');
    expect(titles).toContain('You won Card A at $100');
    expect(titles).toContain('Owned — Card A');
    const sold = saved.find((r) => r.payload?.['eventKey'] === 'SELLER_SOLD');
    expect(sold?.body).toBe('You receive $97.50 after fees.');
  });

  it('emits redeem stage notifications with dedupe keys', async () => {
    const wallet = '0xabc0000000000000000000000000000000000001';
    await service.notifyRedeemPaymentReceived({
      ownerWallet: wallet,
      paymentBatchId: 'batch-1',
      cardCount: 2,
      chainId: 11155111,
    });
    await service.notifyRedeemPreparing({
      ownerWallet: wallet,
      paymentBatchId: 'batch-1',
      chainId: 11155111,
    });
    await service.notifyRedeemShipped({
      ownerWallet: wallet,
      paymentBatchId: 'batch-1',
      shipmentKey: 'psa_vault',
      trackingNumber: '1ZTEST',
      chainId: 11155111,
    });
    await service.notifyRedeemCompleted({
      ownerWallet: wallet,
      paymentBatchId: 'batch-1',
      chainId: 11155111,
    });
    await service.notifySellerRedeemShipRequired({
      partnerWallet: '0xdef0000000000000000000000000000000000002',
      redemptionId: 'red-1',
      tokenId: '7',
      chainId: 11155111,
    });
    await service.notifyRedeemRefunded({
      ownerWallet: wallet,
      paymentBatchId: 'batch-1',
      chainId: 11155111,
    });

    expect(saved).toHaveLength(6);
    const keys = saved.map((r) => r.dedupeKey);
    expect(keys).toContain('redeem_paid:batch:batch-1');
    expect(keys).toContain('redeem_preparing:batch:batch-1');
    expect(keys).toContain('wd_shipped:batch-1:psa_vault');
    expect(keys).toContain('redeem_completed:batch:batch-1');
    expect(keys).toContain('seller_redeem_ship:red-1');
    expect(keys).toContain('redeem_refunded:batch:batch-1');
    const eventKeys = saved.map((r) => r.payload?.['eventKey']);
    expect(eventKeys).toContain('RD_PAID_PREPARING');
    expect(eventKeys).toContain('RD_SHIPPED');
    expect(eventKeys).toContain('PARTNER_SHIPMENT_REQUEST');
    expect(eventKeys).toContain('RD_AUTO_CANCELLED_REFUND');
  });
});
