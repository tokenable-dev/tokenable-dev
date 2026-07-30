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
    /** `cancelled` = bid withdrawn; omit / other = new offer. */
    event?: 'cancelled';
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

    const ctx = await this.resolveAskOwnerNotifyContext(bid);
    if (!ctx) return;

    const { recipient, tidNorm, ask, bidUsdc, priceLabel } = ctx;
    const dedupeKey = `token_bid:${bid.orderHash}`;
    const existing = await this.notifications.findOne({
      where: { recipientWallet: recipient, dedupeKey },
    });
    if (existing) return;

    const row = this.notifications.create({
      recipientWallet: recipient,
      type: 'bid',
      title: 'New offer on your listing',
      body: `Someone offered ${priceLabel} on token #${tidNorm}. Accept the offer without changing your ask.`,
      dedupeKey,
      payload: {
        bidOrderHash: bid.orderHash,
        tokenId: tidNorm,
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
        `notifyAskOwnerOfTokenBid → ${recipient.slice(0, 10)}… token #${tidNorm} bid ${bid.orderHash.slice(0, 10)}…`,
      );
    } catch (e) {
      // Unique race: another insert won — treat as success.
      this.logger.warn(
        `notifyAskOwnerOfTokenBid save skipped: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /**
   * When a card-level token bid is cancelled, notify the active ask owner on
   * that tokenId (same recipient rules as new-offer notifications).
   */
  async notifyAskOwnerOfTokenBidCancelled(bid: Order): Promise<void> {
    if (!isTokenBidOrder(bid) || bid.status !== OrderStatus.CANCELLED) return;

    const ctx = await this.resolveAskOwnerNotifyContext(bid);
    if (!ctx) return;

    const { recipient, tidNorm, ask, bidUsdc, priceLabel } = ctx;
    const dedupeKey = `token_bid_cancelled:${bid.orderHash}`;
    const existing = await this.notifications.findOne({
      where: { recipientWallet: recipient, dedupeKey },
    });
    if (existing) return;

    const row = this.notifications.create({
      recipientWallet: recipient,
      type: 'bid',
      title: 'Offer cancelled',
      body: `An offer of ${priceLabel} on token #${tidNorm} was cancelled.`,
      dedupeKey,
      payload: {
        event: 'cancelled',
        bidOrderHash: bid.orderHash,
        tokenId: tidNorm,
        askOrderHash: ask.orderHash,
        bidUsdc,
        collectionKey: ask.collectionKey ?? bid.collectionKey,
      },
      readAt: null,
    });

    try {
      await this.notifications.save(row);
      this.logger.log(
        `notifyAskOwnerOfTokenBidCancelled → ${recipient.slice(0, 10)}… token #${tidNorm} bid ${bid.orderHash.slice(0, 10)}…`,
      );
    } catch (e) {
      this.logger.warn(
        `notifyAskOwnerOfTokenBidCancelled save skipped: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  private async resolveAskOwnerNotifyContext(bid: Order): Promise<{
    recipient: string;
    tidNorm: string;
    ask: Order;
    bidUsdc: number;
    priceLabel: string;
  } | null> {
    const tid = String(bid.tokenId ?? '').trim();
    if (!isValidDecimalTokenId(tid)) return null;

    const tidNorm = normalizeDecimalTokenId(tid);
    const variants = [...new Set([tid, tidNorm].filter((s) => s.length > 0))];
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

    if (!ask) return null;

    const recipient = normalizeWallet(ask.offerer);
    const bidder = normalizeWallet(bid.offerer);
    if (!recipient || recipient === bidder) return null;

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

    return { recipient, tidNorm, ask, bidUsdc, priceLabel };
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
    const isCancelled = payload.event === 'cancelled';
    if (row.type === 'bid' && !isCancelled && bidHash && tokenId) {
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
