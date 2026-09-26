import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull } from 'typeorm';
import { BuyerListingAlertService } from './buyer-listing-alert.service';
import { UserBuyerListingAlert } from '../entities/user-buyer-listing-alert.entity';
import { Order, OrderSide, OrderStatus } from '../entities/order.entity';
import { CollectionService } from '../collections/collection.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChainConfigService } from '../../blockchain/chain-config.service';

describe('BuyerListingAlertService', () => {
  let service: BuyerListingAlertService;
  const rows: UserBuyerListingAlert[] = [];
  const RWA = '0xabc';

  const requiresUnfired = (firedAt: unknown) =>
    firedAt === null ||
    firedAt === IsNull() ||
    (typeof firedAt === 'object' &&
      firedAt != null &&
      '_type' in firedAt &&
      (firedAt as { _type: string })._type === 'isNull');

  const alertsRepo = {
    findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
      rows.find(
        (r) =>
          r.userId === where.userId &&
          r.collectionKey === where.collectionKey &&
          r.tokenContract === where.tokenContract &&
          (requiresUnfired(where.firedAt) ? r.firedAt == null : true),
      ) ?? null,
    ),
    find: jest.fn(
      async ({
        where,
      }: {
        where: {
          collectionKey: string;
          tokenContract?: string;
          firedAt?: unknown;
        };
      }) =>
        rows.filter(
          (r) =>
            r.collectionKey === where.collectionKey &&
            (where.tokenContract == null ||
              r.tokenContract === where.tokenContract) &&
            (requiresUnfired(where.firedAt) ? r.firedAt == null : true),
        ),
    ),
    upsert: jest.fn(async (partial: Partial<UserBuyerListingAlert>) => {
      const key = partial.collectionKey!;
      const userId = partial.userId!;
      const tokenContract = partial.tokenContract!;
      const idx = rows.findIndex(
        (r) =>
          r.userId === userId &&
          r.collectionKey === key &&
          r.tokenContract === tokenContract,
      );
      const row = {
        id: idx >= 0 ? rows[idx]!.id : rows.length + 1,
        userId,
        collectionKey: key,
        tokenContract,
        createdAt: new Date(),
        firedAt: partial.firedAt ?? null,
      } as UserBuyerListingAlert;
      if (idx >= 0) rows[idx] = row;
      else rows.push(row);
    }),
    delete: jest.fn(
      async ({
        userId,
        collectionKey,
        tokenContract,
      }: UserBuyerListingAlert) => {
        const idx = rows.findIndex(
          (r) =>
            r.userId === userId &&
            r.collectionKey === collectionKey &&
            r.tokenContract === tokenContract,
        );
        if (idx >= 0) rows.splice(idx, 1);
      },
    ),
    createQueryBuilder: jest.fn(() => ({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn(async () => {
        for (const r of rows) {
          if (r.firedAt == null) r.firedAt = new Date();
        }
        return { affected: rows.length };
      }),
    })),
  };

  const ordersRepo = {
    count: jest.fn(async () => 1),
  };

  const collections = {
    findOne: jest.fn(async () => ({
      collectionKey: 'ch:test',
      tokenContract: RWA,
    })),
  };

  const notifications = {
    notifyBuyerListingAlerts: jest.fn(async () => undefined),
  };

  const chainConfig = {
    getDefaultChainId: jest.fn(() => 11155111),
    getRwaAddress: jest.fn(() => RWA),
    resolveChainId: jest.fn(() => 11155111),
  };

  beforeEach(async () => {
    rows.length = 0;
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        BuyerListingAlertService,
        { provide: getRepositoryToken(UserBuyerListingAlert), useValue: alertsRepo },
        { provide: getRepositoryToken(Order), useValue: ordersRepo },
        { provide: CollectionService, useValue: collections },
        { provide: NotificationsService, useValue: notifications },
        { provide: ChainConfigService, useValue: chainConfig },
      ],
    }).compile();

    service = module.get(BuyerListingAlertService);
  });

  it('subscribe creates an active row scoped to token_contract', async () => {
    await service.subscribe('user-1', 'ch:test', 11155111);
    expect(await service.isActive('user-1', 'ch:test', 11155111)).toBe(true);
    expect(alertsRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ tokenContract: RWA }),
      ['userId', 'collectionKey', 'tokenContract'],
    );
  });

  it('unsubscribe removes the row', async () => {
    await service.subscribe('user-1', 'ch:test', 11155111);
    await service.unsubscribe('user-1', 'ch:test', 11155111);
    expect(await service.isActive('user-1', 'ch:test', 11155111)).toBe(false);
  });

  it('fires BUYER_LISTING_ALERT on first ask and marks subscription off', async () => {
    await service.subscribe('user-1', 'ch:test', 11155111);
    const ask = {
      side: OrderSide.ASK,
      status: OrderStatus.ACTIVE,
      collectionKey: 'ch:test',
      orderHash: '0xask1',
      considerationAmount: '1000000',
      tokenContract: RWA,
      tokenId: '42',
    } as Order;

    await service.onFirstAskListed(ask);

    expect(ordersRepo.count).toHaveBeenCalledWith({
      where: {
        collectionKey: 'ch:test',
        tokenContract: RWA,
        side: OrderSide.ASK,
        status: OrderStatus.ACTIVE,
      },
    });
    expect(notifications.notifyBuyerListingAlerts).toHaveBeenCalledWith({
      ask,
      collectionKey: 'ch:test',
      userIds: ['user-1'],
    });
    expect(await service.isActive('user-1', 'ch:test', 11155111)).toBe(false);
  });

  it('skips when collection already has multiple active asks on same RWA', async () => {
    await service.subscribe('user-1', 'ch:test', 11155111);
    ordersRepo.count.mockResolvedValueOnce(2);

    await service.onFirstAskListed({
      side: OrderSide.ASK,
      status: OrderStatus.ACTIVE,
      collectionKey: 'ch:test',
      tokenContract: RWA,
      orderHash: '0xask2',
    } as Order);

    expect(notifications.notifyBuyerListingAlerts).not.toHaveBeenCalled();
  });
});
