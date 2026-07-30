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
        href: `/portfolio?setprice=${encodeURIComponent(tidNorm)}`,
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
        href: '/portfolio',
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
      body: 'Your balance was insufficient. Re-bid once funded.',
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
        href: '/portfolio',
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
      body: 'Your listing is live on the marketplace.',
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
          href: '/portfolio',
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
        body: 'Your bid was filled.',
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
        href: '/portfolio',
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
      eventKey: 'BUYER_BID_EXPIRED',
      title: 'Your bid expired',
      body: `${priceLabel} on ${cardLabel}. Place a new bid anytime.`,
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
          : '/portfolio',
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
      body: `${priceLabel} on ${cardLabel}. Re-bid to keep it active.`,
      dedupeKey: `bid_expiring:${bid.orderHash}`,
      payload: {
        bidOrderHash: bid.orderHash,
        tokenId: tidNorm,
        bidUsdc,
        collectionKey: bid.collectionKey,
        cardLabel,
        imageUrl,
        ctaLabel: 'View bid',
        href: '/portfolio',
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
        ctaLabel: 'View submission',
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
      ? `/portfolio?setprice=${encodeURIComponent(tid)}`
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
      body: "Your card is safe at the vault — we're retrying.",
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
          ? `/portfolio?setprice=${encodeURIComponent(tid)}`
          : `/vault/submissions/${encodeURIComponent(params.submissionPublicId)}`,
      },
    });
  }

  /** WD_REQUEST_RECEIVED */
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
      eventKey: 'WD_REQUEST_RECEIVED',
      title: 'Withdrawal requested',
      body: "We're confirming the exact cost. We'll notify you to pay.",
      dedupeKey: `wd_requested:${params.redemptionId}`,
      payload: {
        tokenId: tid || undefined,
        ctaLabel: 'View',
        href: '/portfolio',
      },
    });
  }

  /** WD_SHIPPED — physical release confirmed (tracking optional). */
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
      eventKey: 'WD_SHIPPED',
      title: 'Your cards are on their way',
      body: tracking ? `Tracking: ${tracking}.` : 'Your shipment has left the vault.',
      dedupeKey: `wd_shipped:${params.redemptionId}`,
      payload: {
        ctaLabel: 'Track',
        href: '/portfolio',
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

    let href: string | null = payloadHref;
    let ctaLabel: string | null = payloadCta;
    const event = payload.event;
    const noEditCta =
      event === 'cancelled' ||
      event === 'unfilled' ||
      event === 'dead_bidder';

    if (
      !href &&
      row.type === 'bid' &&
      !noEditCta &&
      tokenId &&
      payload.eventKey === 'SELLER_TOP_BID_UPDATED'
    ) {
      href = `/portfolio?setprice=${encodeURIComponent(tokenId)}`;
      ctaLabel = ctaLabel ?? 'Edit price';
    }

    if (event === 'dead_bidder' && !href) {
      href = '/portfolio';
      ctaLabel = ctaLabel ?? 'Add funds';
    }

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
}
