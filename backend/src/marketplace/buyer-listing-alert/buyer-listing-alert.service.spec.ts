import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull } from 'typeorm';
import { BuyerListingAlertService } from './buyer-listing-alert.service';
import { UserBuyerListingAlert } from '../entities/user-buyer-listing-alert.entity';
import { Order, OrderSide, OrderStatus } from '../entities/order.entity';
import { CollectionService } from '../collections/collection.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('BuyerListingAlertService', () => {
  let service: BuyerListingAlertService;
  const rows: UserBuyerListingAlert[] = [];

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
          (requiresUnfired(where.firedAt) ? r.firedAt == null : true),
      ) ?? null,
    ),
    find: jest.fn(
      async ({
        where,
      }: {
        where: { collectionKey: string; firedAt?: unknown };
      }) =>
        rows.filter(
          (r) =>
            r.collectionKey === where.collectionKey &&
            (requiresUnfired(where.firedAt) ? r.firedAt == null : true),
        ),
    ),
    upsert: jest.fn(async (partial: Partial<UserBuyerListingAlert>) => {
      const key = partial.collectionKey!;
      const userId = partial.userId!;
      const idx = rows.findIndex(
        (r) => r.userId === userId && r.collectionKey === key,
      );
      const row = {
        id: idx >= 0 ? rows[idx]!.id : rows.length + 1,
        userId,
        collectionKey: key,
        createdAt: new Date(),
        firedAt: partial.firedAt ?? null,
      } as UserBuyerListingAlert;
      if (idx >= 0) rows[idx] = row;
      else rows.push(row);
    }),
    delete: jest.fn(async ({ userId, collectionKey }: UserBuyerListingAlert) => {
      const idx = rows.findIndex(
        (r) => r.userId === userId && r.collectionKey === collectionKey,
      );
      if (idx >= 0) rows.splice(idx, 1);
    }),
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
    findOne: jest.fn(async () => ({ collectionKey: 'ch:test' })),
  };

  const notifications = {
    notifyBuyerListingAlerts: jest.fn(async () => undefined),
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
      ],
    }).compile();

    service = module.get(BuyerListingAlertService);
  });

  it('subscribe creates an active row', async () => {
    await service.subscribe('user-1', 'ch:test');
    expect(await service.isActive('user-1', 'ch:test')).toBe(true);
  });

  it('unsubscribe removes the row', async () => {
    await service.subscribe('user-1', 'ch:test');
    await service.unsubscribe('user-1', 'ch:test');
    expect(await service.isActive('user-1', 'ch:test')).toBe(false);
  });

  it('fires BUYER_LISTING_ALERT on first ask and marks subscription off', async () => {
    await service.subscribe('user-1', 'ch:test');
    const ask = {
      side: OrderSide.ASK,
      status: OrderStatus.ACTIVE,
      collectionKey: 'ch:test',
      orderHash: '0xask1',
      considerationAmount: '1000000',
      tokenContract: '0xabc',
      tokenId: '42',
    } as Order;

    await service.onFirstAskListed(ask);

    expect(notifications.notifyBuyerListingAlerts).toHaveBeenCalledWith({
      ask,
      collectionKey: 'ch:test',
      userIds: ['user-1'],
    });
    expect(await service.isActive('user-1', 'ch:test')).toBe(false);
  });

  it('skips when collection already has multiple active asks', async () => {
    await service.subscribe('user-1', 'ch:test');
    ordersRepo.count.mockResolvedValueOnce(2);

    await service.onFirstAskListed({
      side: OrderSide.ASK,
      status: OrderStatus.ACTIVE,
      collectionKey: 'ch:test',
      orderHash: '0xask2',
    } as Order);

    expect(notifications.notifyBuyerListingAlerts).not.toHaveBeenCalled();
  });
});
