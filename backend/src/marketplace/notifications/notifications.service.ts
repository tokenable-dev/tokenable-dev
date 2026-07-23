import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { microsToUsdc } from '../admin/platform-analytics.util';
import {
  MarketplaceNotification,
  type MarketplaceNotificationType,
} from '../entities/marketplace-notification.entity';
import { Order, OrderSide, OrderStatus } from '../entities/order.entity';
import {
  isTokenBidOrder,
  isValidDecimalTokenId,
} from '../utils/platform-tape.util';

function normalizeWallet(addr: string): string {
  return addr.trim().toLowerCase();
}

function normalizeDecimalTokenId(raw: string): string {
  const s = String(raw ?? '').trim();
  if (!/^\d+$/.test(s)) return s;
  let i = 0;
  while (i < s.length - 1 && s[i] === '0') i++;
  return s.slice(i);
}

export type NotificationListItem = {
  id: number;
  type: MarketplaceNotificationType;
  title: string;
  body: string;
  payload: {
    bidOrderHash?: string;
    tokenId?: string;
    askOrderHash?: string;
    bidUsdc?: number;
    collectionKey?: string | null;
    ctaLabel?: string;
  };
  readAt: string | null;
  createdAt: string;
  href: string | null;
  /** Primary action label for deep-link rows (e.g. Accept offer). */
  ctaLabel: string | null;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(MarketplaceNotification)
    private readonly notifications: Repository<MarketplaceNotification>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  /**
   * When a card-level token bid is posted, notify the wallet that holds an
   * active ask on that tokenId (not all collection sellers).
   */
  async notifyAskOwnerOfTokenBid(bid: Order): Promise<void> {
    if (!isTokenBidOrder(bid) || bid.status !== OrderStatus.ACTIVE) return;

    const tid = String(bid.tokenId ?? '').trim();
    if (!isValidDecimalTokenId(tid)) return;

    const variants = [
      ...new Set(
        [tid, normalizeDecimalTokenId(tid)].filter((s) => s.length > 0),
      ),
    ];
    const ask = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.token_id IN (:...variants)', { variants })
      .andWhere('o.status = :st', { st: OrderStatus.ACTIVE })
      .andWhere('o.side = :side', { side: OrderSide.ASK })
      .andWhere('LOWER(o.token_contract) = :contract', {
        contract: bid.tokenContract.toLowerCase(),
      })
      .orderBy('o.created_at', 'DESC')
      .getOne();

    if (!ask) return;

    const recipient = normalizeWallet(ask.offerer);
    const bidder = normalizeWallet(bid.offerer);
    if (!recipient || recipient === bidder) return;

    const bidUsdc = microsToUsdc(
      String(
        (bid.parameters as { offer?: Array<{ startAmount?: string }> })?.offer?.[0]
          ?.startAmount ?? bid.considerationAmount,
      ),
    );
    const priceLabel =
      Number.isFinite(bidUsdc) && bidUsdc > 0
        ? `${bidUsdc.toLocaleString('en-US', { maximumFractionDigits: 2 })} USDC`
        : 'an offer';

    const dedupeKey = `token_bid:${bid.orderHash}`;
    const existing = await this.notifications.findOne({
      where: { recipientWallet: recipient, dedupeKey },
    });
    if (existing) return;

    const row = this.notifications.create({
      recipientWallet: recipient,
      type: 'bid',
      title: 'New offer on your listing',
      body: `Someone offered ${priceLabel} on token #${normalizeDecimalTokenId(tid)}. Accept the offer without changing your ask.`,
      dedupeKey,
      payload: {
        bidOrderHash: bid.orderHash,
        tokenId: normalizeDecimalTokenId(tid),
        askOrderHash: ask.orderHash,
        bidUsdc,
        collectionKey: ask.collectionKey ?? bid.collectionKey,
        ctaLabel: 'Accept offer',
      },
      readAt: null,
    });

    try {
      await this.notifications.save(row);
      this.logger.log(
        `notifyAskOwnerOfTokenBid → ${recipient.slice(0, 10)}… token #${tid} bid ${bid.orderHash.slice(0, 10)}…`,
      );
    } catch (e) {
      // Unique race: another insert won — treat as success.
      this.logger.warn(
        `notifyAskOwnerOfTokenBid save skipped: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  async listForWallets(
    wallets: string[],
    limit = 50,
  ): Promise<NotificationListItem[]> {
    const addrs = [
      ...new Set(wallets.map(normalizeWallet).filter((a) => a.length > 0)),
    ];
    if (addrs.length === 0) return [];

    const take = Math.min(Math.max(1, limit), 100);
    const rows = await this.notifications.find({
      where: { recipientWallet: In(addrs) },
      order: { createdAt: 'DESC' },
      take,
    });
    return rows.map((r) => this.toListItem(r));
  }

  async markRead(
    id: number,
    wallets: string[],
  ): Promise<NotificationListItem> {
    const addrs = [
      ...new Set(wallets.map(normalizeWallet).filter((a) => a.length > 0)),
    ];
    const row = await this.notifications.findOne({ where: { id } });
    if (!row || !addrs.includes(normalizeWallet(row.recipientWallet))) {
      throw new NotFoundException(`Notification not found: ${id}`);
    }
    if (!row.readAt) {
      row.readAt = new Date();
      await this.notifications.save(row);
    }
    return this.toListItem(row);
  }

  async markAllRead(wallets: string[]): Promise<{ updated: number }> {
    const addrs = [
      ...new Set(wallets.map(normalizeWallet).filter((a) => a.length > 0)),
    ];
    if (addrs.length === 0) return { updated: 0 };
    const result = await this.notifications
      .createQueryBuilder()
      .update(MarketplaceNotification)
      .set({ readAt: () => 'NOW()' })
      .where('recipient_wallet IN (:...addrs)', { addrs })
      .andWhere('read_at IS NULL')
      .execute();
    return { updated: result.affected ?? 0 };
  }

  private toListItem(row: MarketplaceNotification): NotificationListItem {
    const payload = (row.payload ?? {}) as NotificationListItem['payload'];
    const bidHash =
      typeof payload.bidOrderHash === 'string' ? payload.bidOrderHash : '';
    const tokenId =
      typeof payload.tokenId === 'string' ? payload.tokenId : '';
    const askHash =
      typeof payload.askOrderHash === 'string' ? payload.askOrderHash : '';

    let href: string | null = null;
    let ctaLabel: string | null = null;
    if (row.type === 'bid' && bidHash && tokenId) {
      const sp = new URLSearchParams();
      sp.set('acceptBid', bidHash);
      sp.set('tokenId', tokenId);
      if (askHash) sp.set('askHash', askHash);
      href = `/portfolio?${sp.toString()}`;
      ctaLabel =
        typeof payload.ctaLabel === 'string' && payload.ctaLabel.trim()
          ? payload.ctaLabel.trim()
          : 'Accept offer';
    }

    return {
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      payload,
      readAt: row.readAt ? row.readAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      href,
      ctaLabel,
    };
  }
}
