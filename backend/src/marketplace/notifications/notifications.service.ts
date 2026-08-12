import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import {
  ChainConfigService,
  type SupportedChainId,
} from '../../blockchain/chain-config.service';
import { UserService } from '../../user/user.service';
import { microsToUsdc } from '../admin/platform-analytics.util';
import {
  MarketplaceNotification,
  type MarketplaceNotificationType,
} from '../entities/marketplace-notification.entity';
import { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import { Order, OrderSide, OrderStatus } from '../entities/order.entity';
import { RwaToken } from '../entities/rwa-token.entity';
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

/** Design-system money label: `$54,500` (USDC treated 1:1). */
function formatUsdLabel(usdc: number): string {
  if (!Number.isFinite(usdc) || usdc <= 0) return 'an offer';
  const fractionDigits = Number.isInteger(usdc) ? 0 : 2;
  return `$${usdc.toLocaleString('en-US', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  })}`;
}

function bidOfferUsdc(bid: Order): number {
  return microsToUsdc(
    String(
      (bid.parameters as { offer?: Array<{ startAmount?: string }> })?.offer?.[0]
        ?.startAmount ?? bid.considerationAmount,
    ),
  );
}

export type NotificationListItem = {
  id: number;
  type: MarketplaceNotificationType;
  title: string;
  body: string;
  chainId: number;
  payload: {
    eventKey?: string;
    event?: 'cancelled' | 'unfilled' | 'dead_bidder';
    bidOrderHash?: string;
    tokenId?: string;
    askOrderHash?: string;
    bidUsdc?: number;
    collectionKey?: string | null;
    ctaLabel?: string;
    cardLabel?: string;
    imageUrl?: string | null;
    href?: string;
    submissionPublicId?: string;
  };
  readAt: string | null;
  createdAt: string;
  href: string | null;
  ctaLabel: string | null;
  imageUrl: string | null;
};

type EmitInboxParams = {
  recipientWallet: string;
  chainId: SupportedChainId;
  type: MarketplaceNotificationType;
  eventKey: string;
  title: string;
  body: string;
  dedupeKey: string;
  payload?: Record<string, unknown>;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(MarketplaceNotification)
    private readonly notifications: Repository<MarketplaceNotification>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(RwaToken)
    private readonly rwaTokens: Repository<RwaToken>,
    @InjectRepository(MarketplaceCollection)
    private readonly collections: Repository<MarketplaceCollection>,
    private readonly chainConfig: ChainConfigService,
    private readonly users: UserService,
    private readonly config: ConfigService,
  ) {}

  private chainIdForOrder(order: Order): SupportedChainId {
    return (
      this.chainConfig.resolveChainIdFromRwaAddress(order.tokenContract) ??
      this.chainConfig.getDefaultChainId()
    );
  }

  private platformFeeBps(): number {
    const raw = parseInt(
      this.config.get<string>('PLATFORM_FEE_BPS') ?? '250',
      10,
    );
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  }

  private sellerNetUsdc(grossUsdc: number): number {
    const bps = this.platformFeeBps();
    if (!(grossUsdc > 0) || bps <= 0) return Math.max(0, grossUsdc);
    return Math.max(0, (grossUsdc * (10_000 - bps)) / 10_000);
  }

  private async emitInbox(params: EmitInboxParams): Promise<boolean> {
    const recipient = normalizeWallet(params.recipientWallet);
    if (!recipient) return false;

    const existing = await this.notifications.findOne({
      where: { recipientWallet: recipient, dedupeKey: params.dedupeKey },
    });
    if (existing) return false;

    const row = this.notifications.create({
      recipientWallet: recipient,
      chainId: params.chainId,
      type: params.type,
      title: params.title,
      body: params.body,
      dedupeKey: params.dedupeKey,
      payload: {
        eventKey: params.eventKey,
        ...(params.payload ?? {}),
      },
      readAt: null,
    });

    try {
      await this.notifications.save(row);
      this.logger.log(
        `notify ${params.eventKey} → ${recipient.slice(0, 10)}… chain ${params.chainId}`,
      );
      return true;
    } catch (e) {
      this.logger.warn(
        `notify ${params.eventKey} save skipped: ${e instanceof Error ? e.message : String(e)}`,
      );
      return false;
    }
  }

  private async primaryWalletForUser(userId: string): Promise<string | null> {
    const wallets = await this.users.listWalletsForUser(userId);
    if (wallets.length === 0) return null;
    const primary =
      wallets.find((w) => w.isPrimary) ??
      wallets.find((w) => Boolean(w.walletAddress?.trim())) ??
      wallets[0];
    const addr = primary?.walletAddress?.trim();
    return addr ? normalizeWallet(addr) : null;
  }

  /**
   * When a card-level token bid is posted, notify the ask owner only if this
   * bid is a new highest (SELLER_TOP_BID_UPDATED). Low bids do not spam.
   */
  async notifyAskOwnerOfTokenBid(bid: Order): Promise<void> {
    if (!isTokenBidOrder(bid) || bid.status !== OrderStatus.ACTIVE) return;

    const ctx = await this.resolveAskOwnerNotifyContext(bid);
    if (!ctx) return;

    if (!(await this.isNewTopTokenBid(bid, ctx.tidNorm, ctx.bidUsdc))) return;

    const {
      recipient,
      tidNorm,
      ask,
      bidUsdc,
      priceLabel,
      cardLabel,
      imageUrl,
      chainId,
    } = ctx;

    await this.emitInbox({
      recipientWallet: recipient,
      chainId,
      type: 'bid',
      eventKey: 'SELLER_TOP_BID_UPDATED',
      title: `Top bid updated on your ${cardLabel}`,
      body: `The highest bid is now ${priceLabel}.`,
      dedupeKey: `top_bid:${bid.orderHash}`,
      payload: {
        bidOrderHash: bid.orderHash,
        tokenId: tidNorm,
        askOrderHash: ask.orderHash,
        bidUsdc,
        collectionKey: ask.collectionKey ?? bid.collectionKey,
        cardLabel,
        imageUrl,
        ctaLabel: 'Edit price',
        href: `/portfolio?tab=assets&setprice=${encodeURIComponent(tidNorm)}`,
      },
    });
  }

  /** Buyer confirmation that their token bid was placed (BUYER_BID_PLACED). */
  async notifyBidderOfBidPlaced(bid: Order): Promise<void> {
    if (!isTokenBidOrder(bid) || bid.status !== OrderStatus.ACTIVE) return;

    const tid = String(bid.tokenId ?? '').trim();
    if (!isValidDecimalTokenId(tid)) return;
    const tidNorm = normalizeDecimalTokenId(tid);
    const recipient = normalizeWallet(bid.offerer);
    if (!recipient) return;

    const bidUsdc = bidOfferUsdc(bid);
    const priceLabel = formatUsdLabel(bidUsdc);
    const { cardLabel, imageUrl } = await this.resolveCardPresentation(
      bid.tokenContract,
      tidNorm,
      bid.collectionKey,
    );

    await this.emitInbox({
      recipientWallet: recipient,
      chainId: this.chainIdForOrder(bid),
      type: 'bid',
      eventKey: 'BUYER_BID_PLACED',
      title: 'Bid placed',
      body: `${priceLabel} on ${cardLabel}.`,
      dedupeKey: `bid_placed:${bid.orderHash}`,
      payload: {
        bidOrderHash: bid.orderHash,
        tokenId: tidNorm,
        bidUsdc,
        collectionKey: bid.collectionKey,
        cardLabel,
        imageUrl,
        ctaLabel: 'View bids',
        href: '/portfolio?tab=bids',
      },
    });
  }

  async notifyAskOwnerOfTokenBidCancelled(bid: Order): Promise<void> {
    if (!isTokenBidOrder(bid) || bid.status !== OrderStatus.CANCELLED) return;

    const ctx = await this.resolveAskOwnerNotifyContext(bid);
    if (!ctx) return;

    const {
      recipient,
      tidNorm,
      ask,
      bidUsdc,
      priceLabel,
      cardLabel,
      imageUrl,
      chainId,
    } = ctx;

    await this.emitInbox({
      recipientWallet: recipient,
      chainId,
      type: 'bid',
      eventKey: 'SELLER_BID_CANCELLED',
      title: 'Offer cancelled',
      body: `An offer of ${priceLabel} on ${cardLabel} was cancelled.`,
      dedupeKey: `token_bid_cancelled:${bid.orderHash}`,
      payload: {
        event: 'cancelled',
        bidOrderHash: bid.orderHash,
        tokenId: tidNorm,
        askOrderHash: ask.orderHash,
        bidUsdc,
        collectionKey: ask.collectionKey ?? bid.collectionKey,
        cardLabel,
        imageUrl,
      },
    });
  }

  async notifyAskOwnerOfUnfilledBid(bid: Order): Promise<void> {
    if (!isTokenBidOrder(bid) || bid.status !== OrderStatus.CANCELLED) return;

    const ctx = await this.resolveAskOwnerNotifyContext(bid);
    if (!ctx) return;

    const {
      recipient,
      tidNorm,
      ask,
      bidUsdc,
      priceLabel,
      cardLabel,
      imageUrl,
      chainId,
    } = ctx;

    await this.emitInbox({
      recipientWallet: recipient,
      chainId,
      type: 'bid',
      eventKey: 'SELLER_BID_UNFILLED',
      title: 'Offer could not be filled',
      body: `The ${priceLabel} offer on ${cardLabel} was removed because the buyer could not pay.`,
      dedupeKey: `token_bid_unfilled:${bid.orderHash}`,
      payload: {
        event: 'unfilled',
        bidOrderHash: bid.orderHash,
        tokenId: tidNorm,
        askOrderHash: ask.orderHash,
        bidUsdc,
        collectionKey: ask.collectionKey ?? bid.collectionKey,
        cardLabel,
        imageUrl,
      },
    });
  }

  /** BUYER_FILL_FAILED — balance/allowance insufficient at fill time. */
  async notifyBidderOfDeadBid(bid: Order): Promise<void> {
    if (!isTokenBidOrder(bid) || bid.status !== OrderStatus.CANCELLED) return;

    const tid = String(bid.tokenId ?? '').trim();
    if (!isValidDecimalTokenId(tid)) return;

    const tidNorm = normalizeDecimalTokenId(tid);
    const recipient = normalizeWallet(bid.offerer);
    if (!recipient) return;

    const bidUsdc = bidOfferUsdc(bid);
    const { cardLabel, imageUrl } = await this.resolveCardPresentation(
      bid.tokenContract,
      tidNorm,
      bid.collectionKey,
    );

    await this.emitInbox({
      recipientWallet: recipient,
      chainId: this.chainIdForOrder(bid),
      type: 'bid',
      eventKey: 'BUYER_FILL_FAILED',
      title: "Your offer couldn't be filled",
      body: 'Add funds and re-bid.',
      dedupeKey: `token_bid_dead_bidder:${bid.orderHash}`,
      payload: {
        event: 'dead_bidder',
        bidOrderHash: bid.orderHash,
        tokenId: tidNorm,
        bidUsdc,
        collectionKey: bid.collectionKey,
        cardLabel,
        imageUrl,
        ctaLabel: 'Add funds',
        href: '/portfolio?tab=assets&addfunds=1',
      },
    });
  }

  /** SELLER_LISTING_LIVE — ask posted. */
  async notifySellerListingLive(ask: Order): Promise<void> {
    if (ask.side !== OrderSide.ASK || ask.status !== OrderStatus.ACTIVE) return;
    const tid = String(ask.tokenId ?? '').trim();
    if (!isValidDecimalTokenId(tid)) return;
    const tidNorm = normalizeDecimalTokenId(tid);
    const recipient = normalizeWallet(ask.offerer);
    if (!recipient) return;

    const { cardLabel, imageUrl } = await this.resolveCardPresentation(
      ask.tokenContract,
      tidNorm,
      ask.collectionKey,
    );

    await this.emitInbox({
      recipientWallet: recipient,
      chainId: this.chainIdForOrder(ask),
      type: 'trade',
      eventKey: 'SELLER_LISTING_LIVE',
      title: `${cardLabel} is now listed`,
      body: '',
      dedupeKey: `listing_live:${ask.orderHash}`,
      payload: {
        tokenId: tidNorm,
        askOrderHash: ask.orderHash,
        collectionKey: ask.collectionKey,
        cardLabel,
        imageUrl,
        ctaLabel: 'View listing',
        href: `/marketplace/${encodeURIComponent(tidNorm)}`,
      },
    });
  }

  /**
   * After a vault sale settles: SELLER_SOLD + BUYER_BID_FILLED (if bid) +
   * BUYER_VAULT_PURCHASED.
   */
  async notifyTradeSettled(params: {
    ask: Order;
    bid?: Order | null;
    buyerWallet?: string | null;
    settlementMicros?: string | null;
  }): Promise<void> {
    const { ask, bid } = params;
    if (ask.side !== OrderSide.ASK) return;

    const tid = String(ask.tokenId ?? '').trim();
    if (!isValidDecimalTokenId(tid)) return;
    const tidNorm = normalizeDecimalTokenId(tid);
    const seller = normalizeWallet(ask.offerer);
    const buyer = normalizeWallet(
      params.buyerWallet ?? bid?.offerer ?? '',
    );
    const chainId = this.chainIdForOrder(ask);

    const settlementMicros =
      params.settlementMicros?.trim() ||
      (bid
        ? String(
            bid.parameters?.offer?.[0]?.startAmount ??
              bid.considerationAmount ??
              ask.considerationAmount ??
              '0',
          )
        : String(ask.considerationAmount ?? '0'));
    const saleUsdc = microsToUsdc(settlementMicros);
    const saleLabel = formatUsdLabel(saleUsdc);
    const netLabel = formatUsdLabel(this.sellerNetUsdc(saleUsdc));
    const { cardLabel, imageUrl } = await this.resolveCardPresentation(
      ask.tokenContract,
      tidNorm,
      ask.collectionKey ?? bid?.collectionKey,
    );

    if (seller) {
      await this.emitInbox({
        recipientWallet: seller,
        chainId,
        type: 'trade',
        eventKey: 'SELLER_SOLD',
        title: `Sold — ${cardLabel} at ${saleLabel}`,
        body: `You receive ${netLabel} after fees.`,
        dedupeKey: `seller_sold:${ask.orderHash}`,
        payload: {
          tokenId: tidNorm,
          askOrderHash: ask.orderHash,
          bidOrderHash: bid?.orderHash,
          bidUsdc: saleUsdc,
          collectionKey: ask.collectionKey,
          cardLabel,
          imageUrl,
          ctaLabel: 'View sale',
          href: '/portfolio?tab=history',
        },
      });
    }

    if (!buyer || buyer === seller) return;

    if (bid && isTokenBidOrder(bid)) {
      await this.emitInbox({
        recipientWallet: buyer,
        chainId,
        type: 'bid',
        eventKey: 'BUYER_BID_FILLED',
        title: `You won ${cardLabel} at ${saleLabel}`,
        body: '',
        dedupeKey: `bid_filled:${bid.orderHash}`,
        payload: {
          tokenId: tidNorm,
          askOrderHash: ask.orderHash,
          bidOrderHash: bid.orderHash,
          bidUsdc: saleUsdc,
          collectionKey: ask.collectionKey ?? bid.collectionKey,
          cardLabel,
          imageUrl,
          ctaLabel: 'View purchase',
          href: `/marketplace/${encodeURIComponent(tidNorm)}`,
        },
      });
    }

    await this.emitInbox({
      recipientWallet: buyer,
      chainId,
      type: 'trade',
      eventKey: 'BUYER_VAULT_PURCHASED',
      title: `Owned — ${cardLabel}`,
      body: 'It stays safe in the vault.',
      dedupeKey: `vault_purchased:${ask.orderHash}:${buyer}`,
      payload: {
        tokenId: tidNorm,
        askOrderHash: ask.orderHash,
        bidOrderHash: bid?.orderHash,
        bidUsdc: saleUsdc,
        collectionKey: ask.collectionKey,
        cardLabel,
        imageUrl,
        ctaLabel: 'View in portfolio',
        href: '/portfolio?tab=assets',
      },
    });
  }

  async notifyBidderOfBidExpired(bid: Order): Promise<void> {
    if (!isTokenBidOrder(bid)) return;
    const tid = String(bid.tokenId ?? '').trim();
    if (!isValidDecimalTokenId(tid)) return;
    const tidNorm = normalizeDecimalTokenId(tid);
    const recipient = normalizeWallet(bid.offerer);
    if (!recipient) return;

    const bidUsdc = bidOfferUsdc(bid);
    const { cardLabel, imageUrl } = await this.resolveCardPresentation(
      bid.tokenContract,
      tidNorm,
      bid.collectionKey,
    );

    await this.emitInbox({
      recipientWallet: recipient,
      chainId: this.chainIdForOrder(bid),
      type: 'bid',
      eventKey: 'BUYER_BID_EXPIRED',
      title: 'Your bid expired',
      body: 'Re-bid anytime.',
      dedupeKey: `bid_expired:${bid.orderHash}`,
      payload: {
        bidOrderHash: bid.orderHash,
        tokenId: tidNorm,
        bidUsdc,
        collectionKey: bid.collectionKey,
        cardLabel,
        imageUrl,
        ctaLabel: 'Re-bid',
        href: tidNorm
          ? `/marketplace/${encodeURIComponent(tidNorm)}`
          : '/portfolio?tab=bids',
      },
    });
  }

  async notifyBidderOfBidExpiring(bid: Order): Promise<void> {
    if (!isTokenBidOrder(bid) || bid.status !== OrderStatus.ACTIVE) return;
    const tid = String(bid.tokenId ?? '').trim();
    if (!isValidDecimalTokenId(tid)) return;
    const tidNorm = normalizeDecimalTokenId(tid);
    const recipient = normalizeWallet(bid.offerer);
    if (!recipient) return;

    const bidUsdc = bidOfferUsdc(bid);
    const priceLabel = formatUsdLabel(bidUsdc);
    const { cardLabel, imageUrl } = await this.resolveCardPresentation(
      bid.tokenContract,
      tidNorm,
      bid.collectionKey,
    );

    await this.emitInbox({
      recipientWallet: recipient,
      chainId: this.chainIdForOrder(bid),
      type: 'bid',
      eventKey: 'BUYER_BID_EXPIRING',
      title: 'Your bid expires tomorrow',
      body: `${priceLabel} on ${cardLabel}.`,
      dedupeKey: `bid_expiring:${bid.orderHash}`,
      payload: {
        bidOrderHash: bid.orderHash,
        tokenId: tidNorm,
        bidUsdc,
        collectionKey: bid.collectionKey,
        cardLabel,
        imageUrl,
        ctaLabel: 'Re-bid',
        href: '/portfolio?tab=bids',
      },
    });
  }

  /** Hourly: token bids ending within 24h (BUYER_BID_EXPIRING). */
  @Cron('15 * * * *')
  async cronNotifyExpiringBids(): Promise<void> {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const rows = await this.orderRepo.find({
      where: {
        status: OrderStatus.ACTIVE,
        side: OrderSide.BID,
        endTime: LessThan(in24h),
      },
      take: 200,
    });
    const upcoming = rows.filter(
      (o) =>
        o.endTime != null &&
        o.endTime.getTime() > now.getTime() &&
        isTokenBidOrder(o),
    );
    for (const bid of upcoming) {
      try {
        await this.notifyBidderOfBidExpiring(bid);
      } catch (e) {
        this.logger.warn(
          `cronNotifyExpiringBids: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }

  async notifySellerKycResult(params: {
    userId: string;
    approved: boolean;
    reason?: string | null;
  }): Promise<void> {
    const recipient = await this.primaryWalletForUser(params.userId);
    if (!recipient) return;
    const chainId = this.chainConfig.getDefaultChainId();

    if (params.approved) {
      await this.emitInbox({
        recipientWallet: recipient,
        chainId,
        type: 'vault',
        eventKey: 'SELLER_KYC_RESULT',
        title: "You're verified",
        body: 'You can now list cards for sale.',
        dedupeKey: `kyc_approved:${params.userId}`,
        payload: {
          ctaLabel: 'Go to Sell',
          href: '/sell',
        },
      });
      return;
    }

    const reason = params.reason?.trim();
    await this.emitInbox({
      recipientWallet: recipient,
      chainId,
      type: 'vault',
      eventKey: 'SELLER_KYC_RESULT',
      title: 'Verification needs another look',
      body: reason || 'Please review your verification and try again.',
      dedupeKey: `kyc_rejected:${params.userId}:${Date.now()}`,
      payload: {
        ctaLabel: 'Go to Sell',
        href: '/kyc',
      },
    });
  }

  async notifySellerSubmissionReceived(params: {
    userId: string;
    submissionPublicId: string;
    cardLabel?: string | null;
  }): Promise<void> {
    const recipient = await this.primaryWalletForUser(params.userId);
    if (!recipient) return;
    const card = params.cardLabel?.trim() || 'your card';

    await this.emitInbox({
      recipientWallet: recipient,
      chainId: this.chainConfig.getDefaultChainId(),
      type: 'vault',
      eventKey: 'SELLER_SUBMISSION_RECEIVED',
      title: 'Your card arrived at the vault',
      body: `We're verifying ${card}.`,
      dedupeKey: `submission_received:${params.submissionPublicId}`,
      payload: {
        submissionPublicId: params.submissionPublicId,
        cardLabel: card,
        ctaLabel: 'View',
        href: `/vault/submissions/${encodeURIComponent(params.submissionPublicId)}`,
      },
    });
  }

  async notifySellerVerifyDoneSetPrice(params: {
    userId: string;
    submissionPublicId: string;
    itemId: string;
    cardLabel?: string | null;
    tokenId?: string | null;
  }): Promise<void> {
    const recipient = await this.primaryWalletForUser(params.userId);
    if (!recipient) return;
    const card = params.cardLabel?.trim() || 'Your card';
    const tid = params.tokenId?.trim();
    const href = tid
      ? `/portfolio?tab=assets&setprice=${encodeURIComponent(tid)}`
      : `/vault/submissions/${encodeURIComponent(params.submissionPublicId)}`;

    await this.emitInbox({
      recipientWallet: recipient,
      chainId: this.chainConfig.getDefaultChainId(),
      type: 'vault',
      eventKey: 'SELLER_VERIFY_DONE_SET_PRICE',
      title: `${card} is ready to list`,
      body: 'Set your price to publish it.',
      dedupeKey: `verify_done:${params.itemId}`,
      payload: {
        submissionPublicId: params.submissionPublicId,
        tokenId: tid || undefined,
        cardLabel: card,
        ctaLabel: 'Set price',
        href,
      },
    });
  }

  async notifySellerCardRejected(params: {
    userId: string;
    submissionPublicId: string;
    itemId: string;
    cardLabel?: string | null;
    reason?: string | null;
  }): Promise<void> {
    const recipient = await this.primaryWalletForUser(params.userId);
    if (!recipient) return;
    const card = params.cardLabel?.trim() || 'Your card';

    await this.emitInbox({
      recipientWallet: recipient,
      chainId: this.chainConfig.getDefaultChainId(),
      type: 'vault',
      eventKey: 'SELLER_CARD_REJECTED',
      title: `${card} couldn't be vaulted`,
      body: "It's being returned to you. Return shipping applies.",
      dedupeKey: `card_rejected:${params.itemId}`,
      payload: {
        submissionPublicId: params.submissionPublicId,
        cardLabel: card,
        ctaLabel: 'View details',
        href: `/vault/submissions/${encodeURIComponent(params.submissionPublicId)}`,
      },
    });
  }

  async notifySellerListingFailed(params: {
    userId: string;
    submissionPublicId: string;
    itemId: string;
    cardLabel?: string | null;
  }): Promise<void> {
    const recipient = await this.primaryWalletForUser(params.userId);
    if (!recipient) return;
    const card = params.cardLabel?.trim() || 'your card';

    await this.emitInbox({
      recipientWallet: recipient,
      chainId: this.chainConfig.getDefaultChainId(),
      type: 'vault',
      eventKey: 'SELLER_LISTING_FAILED',
      title: `We're having trouble listing ${card}`,
      body: "Your card is safe — we're retrying.",
      dedupeKey: `listing_failed:${params.itemId}`,
      payload: {
        submissionPublicId: params.submissionPublicId,
        cardLabel: card,
        ctaLabel: 'View status',
        href: `/vault/submissions/${encodeURIComponent(params.submissionPublicId)}`,
      },
    });
  }

  /** Reminder while approved/completed items sit without a live ask. */
  async notifySellerPricePendingReminder(params: {
    userId: string;
    itemId: string;
    submissionPublicId: string;
    cardLabel?: string | null;
    tokenId?: string | null;
  }): Promise<void> {
    const recipient = await this.primaryWalletForUser(params.userId);
    if (!recipient) return;
    const card = params.cardLabel?.trim() || 'Your card';
    const tid = params.tokenId?.trim();

    await this.emitInbox({
      recipientWallet: recipient,
      chainId: this.chainConfig.getDefaultChainId(),
      type: 'vault',
      eventKey: 'SELLER_PRICE_PENDING_REMINDER',
      title: 'Your card is waiting for a price',
      body: `${card} won't go live until you set a price.`,
      dedupeKey: `price_pending:${params.itemId}`,
      payload: {
        submissionPublicId: params.submissionPublicId,
        tokenId: tid || undefined,
        cardLabel: card,
        ctaLabel: 'Set price',
        href: tid
          ? `/portfolio?tab=assets&setprice=${encodeURIComponent(tid)}`
          : `/vault/submissions/${encodeURIComponent(params.submissionPublicId)}`,
      },
    });
  }

  /** Legacy unpaid redeem request (prepaid model preferred — keep for old path). */
  async notifyWithdrawalRequested(params: {
    ownerWallet: string;
    tokenId?: string | null;
    redemptionId: string;
    chainId?: SupportedChainId;
  }): Promise<void> {
    const recipient = normalizeWallet(params.ownerWallet);
    if (!recipient) return;
    const tid = params.tokenId?.trim();

    await this.emitInbox({
      recipientWallet: recipient,
      chainId: params.chainId ?? this.chainConfig.getDefaultChainId(),
      type: 'vault',
      eventKey: 'RD_PAID_PREPARING',
      title: 'Redemption confirmed',
      body: 'Complete payment so we can prepare your cards.',
      dedupeKey: `wd_requested:${params.redemptionId}`,
      payload: {
        tokenId: tid || undefined,
        ctaLabel: 'View',
        href: '/portfolio?tab=assets',
        redemptionId: params.redemptionId,
      },
    });
  }

  /**
   * RD_PAID_PREPARING — ship-from-vault prepaid request confirmed
   * (Notifications spec v2).
   */
  async notifyRedeemPaymentReceived(params: {
    ownerWallet: string;
    paymentBatchId: string;
    cardCount: number;
    chainId?: SupportedChainId;
    totalPaidUsdc?: number | null;
  }): Promise<void> {
    const recipient = normalizeWallet(params.ownerWallet);
    if (!recipient) return;
    const count = Math.max(1, params.cardCount);
    const cardLabel = count === 1 ? 'card' : 'cards';
    const paid =
      params.totalPaidUsdc != null && Number.isFinite(params.totalPaidUsdc)
        ? formatUsdLabel(params.totalPaidUsdc)
        : null;
    const body = paid
      ? `${count} ${cardLabel} · ${paid} paid — being prepared.`
      : 'Payment received — your cards are being prepared.';

    await this.emitInbox({
      recipientWallet: recipient,
      chainId: params.chainId ?? this.chainConfig.getDefaultChainId(),
      type: 'vault',
      eventKey: 'RD_PAID_PREPARING',
      title: 'Redemption confirmed',
      body,
      dedupeKey: `redeem_paid:batch:${params.paymentBatchId}`,
      payload: {
        ctaLabel: 'View',
        href: '/portfolio/redeem?view=resume',
        paymentBatchId: params.paymentBatchId,
      },
    });
  }

  /**
   * RD_PAID_PREPARING — custody complete (same v2 key; separate dedupe stage).
   */
  async notifyRedeemPreparing(params: {
    ownerWallet: string;
    paymentBatchId: string;
    chainId?: SupportedChainId;
  }): Promise<void> {
    const recipient = normalizeWallet(params.ownerWallet);
    if (!recipient) return;

    await this.emitInbox({
      recipientWallet: recipient,
      chainId: params.chainId ?? this.chainConfig.getDefaultChainId(),
      type: 'vault',
      eventKey: 'RD_PAID_PREPARING',
      title: 'Redemption confirmed',
      body: 'Payment received — your cards are being prepared.',
      dedupeKey: `redeem_preparing:batch:${params.paymentBatchId}`,
      payload: {
        ctaLabel: 'View',
        href: '/portfolio/redeem?view=preparing',
        paymentBatchId: params.paymentBatchId,
      },
    });
  }

  /** RD_SHIPPED — tracking set for a vault shipment. */
  async notifyRedeemShipped(params: {
    ownerWallet: string;
    paymentBatchId: string;
    shipmentKey: string;
    trackingNumber?: string | null;
    chainId?: SupportedChainId;
  }): Promise<void> {
    const recipient = normalizeWallet(params.ownerWallet);
    if (!recipient) return;
    const tracking = params.trackingNumber?.trim();

    await this.emitInbox({
      recipientWallet: recipient,
      chainId: params.chainId ?? this.chainConfig.getDefaultChainId(),
      type: 'vault',
      eventKey: 'RD_SHIPPED',
      title: 'Your cards are on their way',
      body: tracking
        ? `Tracking: ${tracking}.`
        : 'Your shipment has left the vault.',
      dedupeKey: `wd_shipped:${params.paymentBatchId}:${params.shipmentKey}`,
      payload: {
        ctaLabel: 'Track',
        href: '/portfolio/redeem?view=transit',
        paymentBatchId: params.paymentBatchId,
        shipmentKey: params.shipmentKey,
      },
    });
  }

  /** RD_SHIPPED — legacy admin confirm-release after burn. */
  async notifyWithdrawalShipped(params: {
    ownerWallet: string;
    redemptionId: string;
    trackingNumber?: string | null;
    chainId?: SupportedChainId;
  }): Promise<void> {
    const recipient = normalizeWallet(params.ownerWallet);
    if (!recipient) return;
    const tracking = params.trackingNumber?.trim();

    await this.emitInbox({
      recipientWallet: recipient,
      chainId: params.chainId ?? this.chainConfig.getDefaultChainId(),
      type: 'vault',
      eventKey: 'RD_SHIPPED',
      title: 'Your cards are on their way',
      body: tracking ? `Tracking: ${tracking}.` : 'Your shipment has left the vault.',
      dedupeKey: `wd_shipped:${params.redemptionId}`,
      payload: {
        ctaLabel: 'Track',
        href: '/portfolio/redeem?view=transit',
        redemptionId: params.redemptionId,
      },
    });
  }

  /**
   * RD_RECEIVED_REMINDER — ask holder to confirm receipt after delivery.
   * (Completion after confirm still uses notifyRedeemCompleted.)
   */
  async notifyRedeemReceivedReminder(params: {
    ownerWallet: string;
    paymentBatchId: string;
    chainId?: SupportedChainId;
  }): Promise<void> {
    const recipient = normalizeWallet(params.ownerWallet);
    if (!recipient) return;

    await this.emitInbox({
      recipientWallet: recipient,
      chainId: params.chainId ?? this.chainConfig.getDefaultChainId(),
      type: 'vault',
      eventKey: 'RD_RECEIVED_REMINDER',
      title: 'Confirm you received your cards',
      body: '',
      dedupeKey: `redeem_received_reminder:batch:${params.paymentBatchId}`,
      payload: {
        ctaLabel: "I've received my cards",
        href: '/portfolio/redeem?view=transit',
        paymentBatchId: params.paymentBatchId,
      },
    });
  }

  /** User confirmed physical receipt (post-confirm ack; not in v2 table). */
  async notifyRedeemCompleted(params: {
    ownerWallet: string;
    paymentBatchId: string;
    chainId?: SupportedChainId;
  }): Promise<void> {
    const recipient = normalizeWallet(params.ownerWallet);
    if (!recipient) return;

    await this.emitInbox({
      recipientWallet: recipient,
      chainId: params.chainId ?? this.chainConfig.getDefaultChainId(),
      type: 'vault',
      eventKey: 'REDEEM_COMPLETED',
      title: 'Redeem complete',
      body: 'You confirmed receipt. Your cards are now in your possession.',
      dedupeKey: `redeem_completed:batch:${params.paymentBatchId}`,
      payload: {
        ctaLabel: 'View',
        href: '/portfolio/redeem?view=done',
        paymentBatchId: params.paymentBatchId,
      },
    });
  }

  /** PARTNER_SHIPMENT_REQUEST — Self-vault partner must ship. */
  async notifySellerRedeemShipRequired(params: {
    partnerWallet: string;
    redemptionId: string;
    tokenId?: string | null;
    chainId?: SupportedChainId;
  }): Promise<void> {
    const recipient = normalizeWallet(params.partnerWallet);
    if (!recipient) return;
    const tid = params.tokenId?.trim();

    await this.emitInbox({
      recipientWallet: recipient,
      chainId: params.chainId ?? this.chainConfig.getDefaultChainId(),
      type: 'vault',
      eventKey: 'PARTNER_SHIPMENT_REQUEST',
      title: 'New shipment request',
      body: 'Ship within 5 days and add tracking.',
      dedupeKey: `seller_redeem_ship:${params.redemptionId}`,
      payload: {
        tokenId: tid || undefined,
        ctaLabel: 'Open shipments',
        href: '/partner/shipments',
        redemptionId: params.redemptionId,
      },
    });
  }

  /**
   * RD_AUTO_CANCELLED_REFUND — ship-from-vault cancelled and refunded
   * (manual admin refund today; auto-cancel when partner SLA lands).
   */
  async notifyRedeemRefunded(params: {
    ownerWallet: string;
    paymentBatchId: string;
    chainId?: SupportedChainId;
  }): Promise<void> {
    const recipient = normalizeWallet(params.ownerWallet);
    if (!recipient) return;

    await this.emitInbox({
      recipientWallet: recipient,
      chainId: params.chainId ?? this.chainConfig.getDefaultChainId(),
      type: 'vault',
      eventKey: 'RD_AUTO_CANCELLED_REFUND',
      title: 'Your ship-from-vault request was cancelled and refunded',
      body: "The seller didn't ship in time. You've been fully refunded and still own the card.",
      dedupeKey: `redeem_refunded:batch:${params.paymentBatchId}`,
      payload: {
        ctaLabel: 'View',
        href: '/portfolio?tab=assets',
        paymentBatchId: params.paymentBatchId,
      },
    });
  }

  /** SELLER_PAYOUT_DONE — self-vault USDC payout completed. */
  async notifySellerPayoutDone(params: {
    sellerWallet: string;
    tokenId: string;
    payoutUsdc: number;
    orderHash?: string | null;
    cardLabel?: string | null;
    chainId?: SupportedChainId;
  }): Promise<void> {
    const recipient = normalizeWallet(params.sellerWallet);
    if (!recipient) return;
    const tid = params.tokenId.trim();
    const card = params.cardLabel?.trim() || (tid ? `card #${tid}` : 'your card');
    const paid = formatUsdLabel(params.payoutUsdc);
    const dedupe =
      params.orderHash?.trim() ||
      `payout:${recipient}:${tid}:${Math.round(params.payoutUsdc * 1e6)}`;

    await this.emitInbox({
      recipientWallet: recipient,
      chainId: params.chainId ?? this.chainConfig.getDefaultChainId(),
      type: 'trade',
      eventKey: 'SELLER_PAYOUT_DONE',
      title: "You've been paid",
      body: `${paid} for ${card}.`,
      dedupeKey: `seller_payout_done:${dedupe}`,
      payload: {
        tokenId: tid || undefined,
        cardLabel: card,
        ctaLabel: 'View',
        href: '/portfolio?tab=history',
      },
    });
  }

  /**
   * FUNDS_WITHDRAW_* — bank cash-out (Withdraw funds). Call when that domain ships.
   */
  async notifyFundsWithdrawSubmitted(params: {
    userWallet: string;
    amountLabel: string;
    destinationLabel: string;
    etaLabel?: string | null;
    chainId?: SupportedChainId;
    withdrawId: string;
  }): Promise<void> {
    const recipient = normalizeWallet(params.userWallet);
    if (!recipient) return;
    const eta = params.etaLabel?.trim();
    await this.emitInbox({
      recipientWallet: recipient,
      chainId: params.chainId ?? this.chainConfig.getDefaultChainId(),
      type: 'vault',
      eventKey: 'FUNDS_WITHDRAW_SUBMITTED',
      title: 'Withdrawal submitted',
      body: eta
        ? `${params.amountLabel} to ${params.destinationLabel} — arriving ${eta}.`
        : `${params.amountLabel} to ${params.destinationLabel}.`,
      dedupeKey: `funds_withdraw_submitted:${params.withdrawId}`,
      payload: {
        ctaLabel: 'Track',
        href: '/portfolio?tab=assets',
      },
    });
  }

  async notifyFundsWithdrawSent(params: {
    userWallet: string;
    amountLabel: string;
    destinationLabel: string;
    chainId?: SupportedChainId;
    withdrawId: string;
  }): Promise<void> {
    const recipient = normalizeWallet(params.userWallet);
    if (!recipient) return;
    await this.emitInbox({
      recipientWallet: recipient,
      chainId: params.chainId ?? this.chainConfig.getDefaultChainId(),
      type: 'vault',
      eventKey: 'FUNDS_WITHDRAW_SENT',
      title: 'Withdrawal sent',
      body: `${params.amountLabel} to ${params.destinationLabel}.`,
      dedupeKey: `funds_withdraw_sent:${params.withdrawId}`,
      payload: {
        ctaLabel: 'View',
        href: '/portfolio?tab=assets',
      },
    });
  }

  async notifyFundsWithdrawFailed(params: {
    userWallet: string;
    chainId?: SupportedChainId;
    withdrawId: string;
  }): Promise<void> {
    const recipient = normalizeWallet(params.userWallet);
    if (!recipient) return;
    await this.emitInbox({
      recipientWallet: recipient,
      chainId: params.chainId ?? this.chainConfig.getDefaultChainId(),
      type: 'vault',
      eventKey: 'FUNDS_WITHDRAW_FAILED',
      title: "Withdrawal couldn't be completed",
      body: 'Refunded to your balance.',
      dedupeKey: `funds_withdraw_failed:${params.withdrawId}`,
      payload: {
        ctaLabel: 'Try again',
        href: '/portfolio?tab=assets',
      },
    });
  }

  private async isNewTopTokenBid(
    bid: Order,
    tidNorm: string,
    bidUsdc: number,
  ): Promise<boolean> {
    if (!(bidUsdc > 0)) return false;
    const variants = [
      ...new Set(
        [String(bid.tokenId ?? ''), tidNorm].filter((s) => s.length > 0),
      ),
    ];
    const others = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.token_id IN (:...variants)', { variants })
      .andWhere('o.status = :st', { st: OrderStatus.ACTIVE })
      .andWhere('o.side = :side', { side: OrderSide.BID })
      .andWhere('LOWER(o.token_contract) = :contract', {
        contract: bid.tokenContract.toLowerCase(),
      })
      .andWhere('o.order_hash != :hash', { hash: bid.orderHash })
      .getMany();

    let maxOther = 0;
    for (const o of others) {
      if (!isTokenBidOrder(o)) continue;
      maxOther = Math.max(maxOther, bidOfferUsdc(o));
    }
    return bidUsdc > maxOther;
  }

  private async resolveAskOwnerNotifyContext(bid: Order): Promise<{
    recipient: string;
    tidNorm: string;
    ask: Order;
    bidUsdc: number;
    priceLabel: string;
    cardLabel: string;
    imageUrl: string | null;
    chainId: SupportedChainId;
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

    const bidUsdc = bidOfferUsdc(bid);
    const priceLabel = formatUsdLabel(bidUsdc);
    const { cardLabel, imageUrl } = await this.resolveCardPresentation(
      bid.tokenContract,
      tidNorm,
      ask.collectionKey ?? bid.collectionKey,
    );

    return {
      recipient,
      tidNorm,
      ask,
      bidUsdc,
      priceLabel,
      cardLabel,
      imageUrl,
      chainId: this.chainIdForOrder(bid),
    };
  }

  private async resolveCardPresentation(
    tokenContract: string,
    tokenId: string,
    collectionKey: string | null | undefined,
  ): Promise<{ cardLabel: string; imageUrl: string | null }> {
    const contract = tokenContract.trim().toLowerCase();
    const rwa = await this.rwaTokens.findOne({
      where: { tokenContract: contract, tokenId },
    });

    let collection: MarketplaceCollection | null = null;
    const key = (collectionKey ?? rwa?.collectionKey ?? '').trim();
    if (key) {
      collection = await this.collections.findOne({
        where: { collectionKey: key },
      });
    }

    const cardLabel =
      rwa?.displayName?.trim() ||
      collection?.displayLabel?.trim() ||
      `card #${tokenId}`;

    const imageUrl =
      rwa?.displayImageUrl?.trim() ||
      collection?.coverImageUrl?.trim() ||
      null;

    return { cardLabel, imageUrl };
  }

  async listForWallets(
    wallets: string[],
    chainId: SupportedChainId,
    limit = 50,
  ): Promise<NotificationListItem[]> {
    const addrs = [
      ...new Set(wallets.map(normalizeWallet).filter((a) => a.length > 0)),
    ];
    if (addrs.length === 0) return [];

    const take = Math.min(Math.max(1, limit), 100);
    const rows = await this.notifications.find({
      where: { recipientWallet: In(addrs), chainId },
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

  async markAllRead(
    wallets: string[],
    chainId: SupportedChainId,
  ): Promise<{ updated: number }> {
    const addrs = [
      ...new Set(wallets.map(normalizeWallet).filter((a) => a.length > 0)),
    ];
    if (addrs.length === 0) return { updated: 0 };
    const result = await this.notifications
      .createQueryBuilder()
      .update(MarketplaceNotification)
      .set({ readAt: () => 'NOW()' })
      .where('recipient_wallet IN (:...addrs)', { addrs })
      .andWhere('chain_id = :chainId', { chainId })
      .andWhere('read_at IS NULL')
      .execute();
    return { updated: result.affected ?? 0 };
  }

  private toListItem(row: MarketplaceNotification): NotificationListItem {
    const payload = (row.payload ?? {}) as NotificationListItem['payload'];
    const tokenId =
      typeof payload.tokenId === 'string' ? payload.tokenId : '';
    const imageUrl =
      typeof payload.imageUrl === 'string' && payload.imageUrl.trim()
        ? payload.imageUrl.trim()
        : null;

    const payloadHref =
      typeof payload.href === 'string' && payload.href.trim()
        ? payload.href.trim()
        : null;
    const payloadCta =
      typeof payload.ctaLabel === 'string' && payload.ctaLabel.trim()
        ? payload.ctaLabel.trim()
        : null;

    const event =
      typeof payload.event === 'string' ? payload.event : '';
    const eventKey =
      typeof payload.eventKey === 'string' ? payload.eventKey : '';
    const noEditCta =
      event === 'cancelled' ||
      event === 'unfilled' ||
      event === 'dead_bidder';

    const { href, ctaLabel } = this.resolveNotificationAction({
      eventKey,
      event,
      tokenId,
      noEditCta,
      payloadHref,
      payloadCta,
      submissionPublicId:
        typeof payload.submissionPublicId === 'string'
          ? payload.submissionPublicId
          : '',
    });

    return {
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      chainId: row.chainId,
      payload,
      readAt: row.readAt ? row.readAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      href,
      ctaLabel,
      imageUrl,
    };
  }

  /**
   * Canonical inbox CTAs. Prefer eventKey so older rows with bare `/portfolio`
   * still land on the right tab / modal.
   */
  private resolveNotificationAction(params: {
    eventKey: string;
    event: string;
    tokenId: string;
    noEditCta: boolean;
    payloadHref: string | null;
    payloadCta: string | null;
    submissionPublicId: string;
  }): { href: string | null; ctaLabel: string | null } {
    const {
      eventKey,
      event,
      tokenId,
      noEditCta,
      payloadHref,
      payloadCta,
      submissionPublicId,
    } = params;
    const setPriceHref = tokenId
      ? `/portfolio?tab=assets&setprice=${encodeURIComponent(tokenId)}`
      : null;
    const marketplaceHref = tokenId
      ? `/marketplace/${encodeURIComponent(tokenId)}`
      : null;
    const submissionHref = submissionPublicId
      ? `/vault/submissions/${encodeURIComponent(submissionPublicId)}`
      : null;

    switch (eventKey) {
      case 'SELLER_TOP_BID_UPDATED':
        if (noEditCta || !setPriceHref) {
          return { href: null, ctaLabel: null };
        }
        return { href: setPriceHref, ctaLabel: 'Edit price' };
      case 'BUYER_BID_PLACED':
        return { href: '/portfolio?tab=bids', ctaLabel: 'View bids' };
      case 'BUYER_BID_EXPIRING':
        return { href: '/portfolio?tab=bids', ctaLabel: 'Re-bid' };
      case 'BUYER_BID_EXPIRED':
        return {
          href: marketplaceHref ?? '/portfolio?tab=bids',
          ctaLabel: 'Re-bid',
        };
      case 'BUYER_FILL_FAILED':
        return {
          href: '/portfolio?tab=assets&addfunds=1',
          ctaLabel: 'Add funds',
        };
      case 'SELLER_SOLD':
        return { href: '/portfolio?tab=history', ctaLabel: 'View sale' };
      case 'SELLER_PAYOUT_DONE':
        return { href: '/portfolio?tab=history', ctaLabel: 'View' };
      case 'BUYER_VAULT_PURCHASED':
        return { href: '/portfolio?tab=assets', ctaLabel: 'View in portfolio' };
      case 'BUYER_BID_FILLED':
        return {
          href: marketplaceHref ?? '/portfolio?tab=assets',
          ctaLabel: 'View purchase',
        };
      case 'SELLER_LISTING_LIVE':
        return {
          href: marketplaceHref ?? '/portfolio?tab=assets',
          ctaLabel: 'View listing',
        };
      case 'SELLER_VERIFY_DONE_SET_PRICE':
      case 'SELLER_PRICE_PENDING_REMINDER':
        return {
          href: setPriceHref ?? submissionHref ?? payloadHref,
          ctaLabel: 'Set price',
        };
      case 'SELLER_SUBMISSION_RECEIVED':
        return {
          href: submissionHref ?? payloadHref,
          ctaLabel: 'View',
        };
      // v2 ship-from-vault + legacy aliases
      case 'RD_PAID_PREPARING':
      case 'WD_REQUEST_RECEIVED':
      case 'REDEEM_PREPARING':
        return {
          href: payloadHref ?? '/portfolio/redeem?view=resume',
          ctaLabel: payloadCta ?? 'View',
        };
      case 'RD_SHIPPED':
      case 'WD_SHIPPED':
        return {
          href: '/portfolio/redeem?view=transit',
          ctaLabel: 'Track',
        };
      case 'RD_RECEIVED_REMINDER':
        return {
          href: '/portfolio/redeem?view=transit',
          ctaLabel: "I've received my cards",
        };
      case 'REDEEM_COMPLETED':
        return {
          href: '/portfolio/redeem?view=done',
          ctaLabel: 'View',
        };
      case 'PARTNER_SHIPMENT_REQUEST':
      case 'SELLER_REDEEM_SHIP':
        return { href: '/partner/shipments', ctaLabel: 'Open shipments' };
      case 'RD_AUTO_CANCELLED_REFUND':
      case 'REDEEM_REFUNDED':
        return { href: '/portfolio?tab=assets', ctaLabel: 'View' };
      case 'FUNDS_WITHDRAW_SUBMITTED':
        return { href: payloadHref ?? '/portfolio?tab=assets', ctaLabel: 'Track' };
      case 'FUNDS_WITHDRAW_SENT':
        return { href: payloadHref ?? '/portfolio?tab=assets', ctaLabel: 'View' };
      case 'FUNDS_WITHDRAW_FAILED':
        return {
          href: payloadHref ?? '/portfolio?tab=assets',
          ctaLabel: 'Try again',
        };
      default:
        break;
    }

    if (event === 'dead_bidder') {
      return {
        href: '/portfolio?tab=assets&addfunds=1',
        ctaLabel: payloadCta ?? 'Add funds',
      };
    }

    return { href: payloadHref, ctaLabel: payloadCta };
  }
}
