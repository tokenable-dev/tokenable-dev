import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  CollectionService,
} from '../collections/collection.service';
import { UserBuyerListingAlert } from '../entities/user-buyer-listing-alert.entity';
import { Order, OrderSide, OrderStatus } from '../entities/order.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class BuyerListingAlertService {
  private readonly logger = new Logger(BuyerListingAlertService.name);

  constructor(
    @InjectRepository(UserBuyerListingAlert)
    private readonly alerts: Repository<UserBuyerListingAlert>,
    @InjectRepository(Order)
    private readonly orders: Repository<Order>,
    private readonly collections: CollectionService,
    private readonly notifications: NotificationsService,
  ) {}

  private normalizeKey(raw: string): string {
    const key = decodeURIComponent(raw).trim().toLowerCase();
    if (!key) {
      throw new BadRequestException('collectionKey is required');
    }
    return key;
  }

  async isActive(userId: string, rawKey: string): Promise<boolean> {
    const collectionKey = this.normalizeKey(rawKey);
    const row = await this.alerts.findOne({
      where: { userId, collectionKey, firedAt: IsNull() },
    });
    return row != null;
  }

  async subscribe(userId: string, rawKey: string): Promise<{ collectionKey: string; active: true }> {
    const collectionKey = this.normalizeKey(rawKey);
    const row = await this.collections.findOne(collectionKey);
    if (!row) {
      throw new NotFoundException('Collection not found');
    }

    await this.alerts.upsert(
      { userId, collectionKey, firedAt: null },
      ['userId', 'collectionKey'],
    );
    return { collectionKey, active: true };
  }

  async unsubscribe(userId: string, rawKey: string): Promise<void> {
    const collectionKey = this.normalizeKey(rawKey);
    await this.alerts.delete({ userId, collectionKey });
  }

  private async listActiveSubscriberUserIds(
    collectionKey: string,
  ): Promise<string[]> {
    const rows = await this.alerts.find({
      where: { collectionKey, firedAt: IsNull() },
      select: ['userId'],
    });
    return [...new Set(rows.map((r) => r.userId))];
  }

  private async markFired(collectionKey: string, userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;
    const now = new Date();
    await this.alerts
      .createQueryBuilder()
      .update(UserBuyerListingAlert)
      .set({ firedAt: now })
      .where('collection_key = :collectionKey', { collectionKey })
      .andWhere('fired_at IS NULL')
      .andWhere('user_id IN (:...userIds)', { userIds })
      .execute();
  }

  /** First active ask on a collection → notify subscribers once, then auto-off. */
  async onFirstAskListed(ask: Order): Promise<void> {
    if (ask.side !== OrderSide.ASK || ask.status !== OrderStatus.ACTIVE) return;
    const collectionKey = ask.collectionKey?.trim().toLowerCase();
    if (!collectionKey) return;

    const activeAskCount = await this.orders.count({
      where: {
        collectionKey,
        side: OrderSide.ASK,
        status: OrderStatus.ACTIVE,
      },
    });
    if (activeAskCount !== 1) return;

    const userIds = await this.listActiveSubscriberUserIds(collectionKey);
    if (userIds.length === 0) return;

    await this.notifications.notifyBuyerListingAlerts({
      ask,
      collectionKey,
      userIds,
    });
    await this.markFired(collectionKey, userIds);
    this.logger.log(
      `BUYER_LISTING_ALERT fired for ${collectionKey} → ${userIds.length} subscriber(s)`,
    );
  }
}
