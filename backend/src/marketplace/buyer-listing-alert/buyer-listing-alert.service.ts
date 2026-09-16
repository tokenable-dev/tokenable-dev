import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  ChainConfigService,
  type SupportedChainId,
} from '../../blockchain/chain-config.service';
import { CollectionService } from '../collections/collection.service';
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
    private readonly chainConfig: ChainConfigService,
  ) {}

  private normalizeKey(raw: string): string {
    const key = decodeURIComponent(raw).trim().toLowerCase();
    if (!key) {
      throw new BadRequestException('collectionKey is required');
    }
    return key;
  }

  private tokenContractForChain(chainId?: SupportedChainId): string {
    const resolved = chainId ?? this.chainConfig.getDefaultChainId();
    return this.chainConfig.getRwaAddress(resolved).toLowerCase();
  }

  async isActive(
    userId: string,
    rawKey: string,
    chainId?: SupportedChainId,
  ): Promise<boolean> {
    const collectionKey = this.normalizeKey(rawKey);
    const tokenContract = this.tokenContractForChain(chainId);
    const row = await this.alerts.findOne({
      where: { userId, collectionKey, tokenContract, firedAt: IsNull() },
    });
    return row != null;
  }

  async subscribe(
    userId: string,
    rawKey: string,
    chainId?: SupportedChainId,
  ): Promise<{ collectionKey: string; active: true }> {
    const collectionKey = this.normalizeKey(rawKey);
    const resolved = chainId ?? this.chainConfig.getDefaultChainId();
    const row = await this.collections.findOne(collectionKey, resolved);
    if (!row) {
      throw new NotFoundException('Collection not found');
    }
    const tokenContract = row.tokenContract.toLowerCase();

    await this.alerts.upsert(
      { userId, collectionKey, tokenContract, firedAt: null },
      ['userId', 'collectionKey', 'tokenContract'],
    );
    return { collectionKey, active: true };
  }

  async unsubscribe(
    userId: string,
    rawKey: string,
    chainId?: SupportedChainId,
  ): Promise<void> {
    const collectionKey = this.normalizeKey(rawKey);
    const tokenContract = this.tokenContractForChain(chainId);
    await this.alerts.delete({ userId, collectionKey, tokenContract });
  }

  private async listActiveSubscriberUserIds(
    collectionKey: string,
    tokenContract: string,
  ): Promise<string[]> {
    const rows = await this.alerts.find({
      where: {
        collectionKey,
        tokenContract: tokenContract.toLowerCase(),
        firedAt: IsNull(),
      },
      select: ['userId'],
    });
    return [...new Set(rows.map((r) => r.userId))];
  }

  private async markFired(
    collectionKey: string,
    tokenContract: string,
    userIds: string[],
  ): Promise<void> {
    if (userIds.length === 0) return;
    const now = new Date();
    await this.alerts
      .createQueryBuilder()
      .update(UserBuyerListingAlert)
      .set({ firedAt: now })
      .where('collection_key = :collectionKey', { collectionKey })
      .andWhere('LOWER(token_contract) = :tokenContract', {
        tokenContract: tokenContract.toLowerCase(),
      })
      .andWhere('fired_at IS NULL')
      .andWhere('user_id IN (:...userIds)', { userIds })
      .execute();
  }

  /** First active ask on a collection+RWA → notify subscribers once, then auto-off. */
  async onFirstAskListed(ask: Order): Promise<void> {
    if (ask.side !== OrderSide.ASK || ask.status !== OrderStatus.ACTIVE) return;
    const collectionKey = ask.collectionKey?.trim().toLowerCase();
    const tokenContract = ask.tokenContract?.trim().toLowerCase();
    if (!collectionKey || !tokenContract) return;

    const activeAskCount = await this.orders.count({
      where: {
        collectionKey,
        tokenContract,
        side: OrderSide.ASK,
        status: OrderStatus.ACTIVE,
      },
    });
    if (activeAskCount !== 1) return;

    const userIds = await this.listActiveSubscriberUserIds(
      collectionKey,
      tokenContract,
    );
    if (userIds.length === 0) return;

    await this.notifications.notifyBuyerListingAlerts({
      ask,
      collectionKey,
      userIds,
    });
    await this.markFired(collectionKey, tokenContract, userIds);
    this.logger.log(
      `BUYER_LISTING_ALERT fired for ${collectionKey} @ ${tokenContract} → ${userIds.length} subscriber(s)`,
    );
  }
}
