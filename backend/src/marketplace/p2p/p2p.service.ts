import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { In, IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { PaymentEscrowWriterService } from '../../blockchain/payment-escrow-writer.service';
import { RwaChainWriterService } from '../../blockchain/rwa-chain-writer.service';
import {
  ChainConfigService,
  type SupportedChainId,
} from '../../blockchain/chain-config.service';
import { assertKycApprovedForCustody } from '../../kyc/utils/kyc-gate.util';
import { User } from '../../user/entities/user.entity';
import { UserService } from '../../user/user.service';
import { VaultService } from '../../vault/vault.service';
import { P2pListing } from '../entities/p2p-listing.entity';
import { P2pOrder } from '../entities/p2p-order.entity';
import { CreateP2pListingDto } from './dto/create-p2p-listing.dto';
import { RecordP2pDepositDto } from './dto/record-p2p-deposit.dto';
import { RecordP2pSettlementDto } from './dto/record-p2p-settlement.dto';
import { SetP2pTrackingDto } from './dto/set-p2p-tracking.dto';
import { addBusinessDays } from './p2p-business-days.util';

const ESCROW_FUNDED = 1;
const ESCROW_RELEASED = 2;
const ESCROW_REFUNDED = 3;
const AUTO_RELEASE_SECS_DEFAULT = 7 * 24 * 60 * 60;

function normalizeCert(cert: string): string {
  return cert.trim().toUpperCase();
}

function asChainId(n: number): SupportedChainId {
  return n as SupportedChainId;
}

@Injectable()
export class P2pService {
  private readonly logger = new Logger(P2pService.name);

  constructor(
    @InjectRepository(P2pListing)
    private readonly listings: Repository<P2pListing>,
    @InjectRepository(P2pOrder)
    private readonly orders: Repository<P2pOrder>,
    private readonly users: UserService,
    private readonly vault: VaultService,
    private readonly chainWriter: RwaChainWriterService,
    private readonly escrowWriter: PaymentEscrowWriterService,
    private readonly chainConfig: ChainConfigService,
    private readonly config: ConfigService,
  ) {}

  private autoReleaseSeconds(): number {
    const raw = this.config.get<string>('P2P_AUTO_RELEASE_SECONDS')?.trim();
    const n = Number(raw);
    return Number.isFinite(n) && n > 60 ? n : AUTO_RELEASE_SECS_DEFAULT;
  }

  async listActiveListings(): Promise<P2pListing[]> {
    return this.listings.find({
      where: { status: 'P2P_LISTED' },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  async getListing(id: string): Promise<P2pListing> {
    const row = await this.listings.findOne({ where: { id } });
    if (!row) throw new NotFoundException('P2P listing not found');
    return row;
  }

  async getOrder(id: string): Promise<P2pOrder> {
    const row = await this.orders.findOne({ where: { id } });
    if (!row) throw new NotFoundException('P2P order not found');
    return row;
  }

  /** Order detail for buyer/seller only (shipping address is PII). */
  async getOrderForUser(user: User, id: string): Promise<P2pOrder> {
    const row = await this.getOrder(id);
    if (row.buyerUserId !== user.id && row.sellerUserId !== user.id) {
      throw new ForbiddenException('Not a party to this order');
    }
    return row;
  }

  /** Seller view: pending payout = price − 5% fee for open listings/sold. */
  async listSellerListingsWithPayout(userId: string): Promise<
    Array<P2pListing & { pendingPayoutUsdc: string | null }>
  > {
    const rows = await this.listSellerListings(userId);
    return rows.map((row) => {
      const open =
        row.status === 'P2P_LISTED' ||
        row.status === 'P2P_MINTED_TK' ||
        row.status === 'SOLD';
      if (!open) {
        return { ...row, pendingPayoutUsdc: null };
      }
      const gross = BigInt(row.priceUsdc);
      const fee = (gross * 500n) / 10_000n;
      return { ...row, pendingPayoutUsdc: (gross - fee).toString() };
    });
  }

  async listSellerListings(userId: string): Promise<P2pListing[]> {
    return this.listings.find({
      where: { sellerUserId: userId },
      order: { createdAt: 'DESC' },
    });
  }

  async listBuyerOrders(userId: string): Promise<P2pOrder[]> {
    return this.orders.find({
      where: { buyerUserId: userId },
      order: { createdAt: 'DESC' },
    });
  }

  async listSellerOrders(userId: string): Promise<P2pOrder[]> {
    return this.orders.find({
      where: { sellerUserId: userId },
      order: { createdAt: 'DESC' },
    });
  }

  async isActiveP2pToken(
    tokenContract: string,
    tokenId: string,
  ): Promise<boolean> {
    const n = await this.listings.count({
      where: {
        tokenContract: tokenContract.toLowerCase(),
        tokenId: String(tokenId),
        status: In(['P2P_MINTED_TK', 'P2P_LISTED', 'SOLD']),
      },
    });
    return n > 0;
  }

  async createListing(
    user: User,
    dto: CreateP2pListingDto,
  ): Promise<{
    listing: P2pListing;
    escrowAddress: string;
    chainId: number;
  }> {
    assertKycApprovedForCustody(user);

    const sellerWallet = dto.sellerWallet.trim().toLowerCase();
    const wallets = await this.users.listWalletsForUser(user.id);
    const linked = wallets.some(
      (w) => w.walletAddress.trim().toLowerCase() === sellerWallet,
    );
    if (!linked) {
      throw new ForbiddenException(
        'Seller wallet must be linked to your Tokenable account',
      );
    }

    const certNumber = dto.certNumber.trim();
    const existing = await this.listings.findOne({
      where: {
        certNumber: normalizeCert(certNumber),
        status: In(['P2P_MINTED_TK', 'P2P_LISTED', 'SOLD']),
      },
    });
    if (existing) {
      throw new ConflictException(
        'This cert already has an active P2P listing',
      );
    }

    const vaultRef = VaultService.computeVaultRef(certNumber);
    const { cycle } = await this.vault.reserveCycleForDeposit({
      certNumber,
      depositedByUserId: user.id,
    });

    const chainId = this.chainConfig.getDefaultChainId();
    const custody = await this.chainWriter.getCustodyWalletAddress(chainId);
    let tokenId: number;
    let txHash: string;
    try {
      ({ tokenId, txHash } = await this.chainWriter.mintTo(
        custody,
        dto.tokenURI.trim(),
        vaultRef,
        chainId,
      ));
    } catch (err) {
      await this.vault.cancelCycle(
        cycle.id,
        `p2p mint failed: ${String(err)}`,
      );
      throw err;
    }

    const tokenContract = this.chainConfig.getRwaAddress(chainId);
    await this.vault.recordMintResult({
      cycleId: cycle.id,
      tokenContract,
      tokenId: String(tokenId),
      tokenURI: dto.tokenURI.trim(),
      txHash,
      certNumber,
      displayName: dto.displayName?.trim() || null,
    });

    const listing = await this.listings.save(
      this.listings.create({
        sellerUserId: user.id,
        certNumber: normalizeCert(certNumber),
        vaultRef,
        tokenContract,
        tokenId: String(tokenId),
        tokenUri: dto.tokenURI.trim(),
        mintTxHash: txHash,
        chainId,
        priceUsdc: dto.priceUsdc,
        sellerWallet,
        authenticityAcceptedAt: new Date(),
        status: 'P2P_LISTED',
        displayName: dto.displayName?.trim() || null,
        imageUrl: dto.imageUrl?.trim() || null,
      }),
    );

    const escrowAddress = await this.escrowWriter.getEscrowAddress(chainId);
    return { listing, escrowAddress, chainId };
  }

  async cancelListing(user: User, listingId: string): Promise<P2pListing> {
    const listing = await this.getListing(listingId);
    if (listing.sellerUserId !== user.id) {
      throw new ForbiddenException('Not your listing');
    }
    if (listing.status !== 'P2P_LISTED' && listing.status !== 'P2P_MINTED_TK') {
      throw new BadRequestException(
        `Cannot cancel listing in status ${listing.status}`,
      );
    }

    const chainId = asChainId(listing.chainId);
    const escrowOrderId =
      PaymentEscrowWriterService.escrowOrderIdForListing(listing.id);

    // If a buyer already funded but never recorded the order, refund them first.
    try {
      const onChain = await this.escrowWriter.getEscrowState(
        escrowOrderId,
        chainId,
      );
      if (onChain.state === ESCROW_FUNDED) {
        await this.escrowWriter.refund(escrowOrderId, chainId);
      }
    } catch (err) {
      this.logger.warn(
        `P2P cancel: escrow check/refund skipped for ${listing.id}: ${String(err)}`,
      );
    }

    listing.status = 'P2P_CANCELLED';
    await this.listings.save(listing);

    const custody = await this.chainWriter.getCustodyWalletAddress(chainId);
    const { txHash } = await this.chainWriter.adminBurn(
      Number(listing.tokenId),
      chainId,
      custody,
    );
    listing.burnTxHash = txHash;
    listing.status = 'BURNED';
    await this.listings.save(listing);

    await this.vault.completeRedemptionBurn({
      tokenContract: listing.tokenContract,
      tokenId: listing.tokenId,
      burnTxHash: txHash,
    });

    return listing;
  }

  async prepareBuy(listingId: string): Promise<{
    listing: P2pListing;
    escrowAddress: string;
    escrowOrderId: string;
    autoReleaseAt: number;
    usdcAddress: string;
    chainId: number;
    priceUsdc: string;
    sellerWallet: string;
    alreadyFunded: boolean;
    fundedBy: string | null;
  }> {
    const listing = await this.getListing(listingId);
    if (listing.status !== 'P2P_LISTED') {
      throw new BadRequestException('Listing is not available for purchase');
    }

    const chainId = asChainId(listing.chainId);
    const escrowOrderId =
      PaymentEscrowWriterService.escrowOrderIdForListing(listing.id);
    let alreadyFunded = false;
    let fundedBy: string | null = null;
    let autoReleaseAt =
      Math.floor(Date.now() / 1000) + this.autoReleaseSeconds();

    const onChain = await this.escrowWriter.getEscrowState(
      escrowOrderId,
      chainId,
    );
    if (onChain.state === ESCROW_FUNDED) {
      alreadyFunded = true;
      fundedBy = onChain.buyer;
      autoReleaseAt = onChain.autoReleaseAt;
    } else if (
      onChain.state === ESCROW_RELEASED ||
      onChain.state === ESCROW_REFUNDED
    ) {
      throw new BadRequestException(
        'This listing escrow is already closed on-chain',
      );
    }

    return {
      listing,
      escrowAddress: await this.escrowWriter.getEscrowAddress(chainId),
      escrowOrderId,
      autoReleaseAt,
      usdcAddress: this.chainConfig.getUsdcAddress(chainId),
      chainId,
      priceUsdc: listing.priceUsdc,
      sellerWallet: listing.sellerWallet,
      alreadyFunded,
      fundedBy,
    };
  }

  async recordDeposit(
    user: User,
    listingId: string,
    dto: RecordP2pDepositDto,
  ): Promise<P2pOrder> {
    const buyerWallet = dto.buyerWallet.trim().toLowerCase();
    const wallets = await this.users.listWalletsForUser(user.id);
    const linked = wallets.some(
      (w) => w.walletAddress.trim().toLowerCase() === buyerWallet,
    );
    if (!linked) {
      throw new ForbiddenException('Buyer wallet must be linked to your account');
    }

    return this.listings.manager.transaction(async (em) => {
      const listing = await em.findOne(P2pListing, {
        where: { id: listingId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!listing) throw new NotFoundException('P2P listing not found');

      const existingOrder = await em.findOne(P2pOrder, {
        where: { listingId },
      });
      if (existingOrder) {
        if (existingOrder.buyerUserId === user.id) return existingOrder;
        throw new ConflictException('Listing already sold');
      }

      if (listing.status !== 'P2P_LISTED') {
        throw new BadRequestException('Listing is not available');
      }
      if (listing.sellerUserId === user.id) {
        throw new BadRequestException('Cannot buy your own listing');
      }

      const chainId = asChainId(listing.chainId);
      const escrowOrderId =
        PaymentEscrowWriterService.escrowOrderIdForListing(listing.id);
      const onChain = await this.escrowWriter.getEscrowState(
        escrowOrderId,
        chainId,
      );
      if (onChain.state !== ESCROW_FUNDED) {
        throw new BadRequestException(
          `Escrow is not funded (state=${onChain.state})`,
        );
      }
      if (onChain.buyer !== buyerWallet) {
        throw new BadRequestException(
          'Escrow was funded by a different wallet — only that buyer can complete purchase',
        );
      }
      if (onChain.seller !== listing.sellerWallet) {
        throw new BadRequestException('Escrow seller wallet mismatch');
      }
      if (onChain.amount !== listing.priceUsdc) {
        throw new BadRequestException('Escrow amount mismatch');
      }

      const now = new Date();
      const order = em.create(P2pOrder, {
        id: randomUUID(),
        listingId: listing.id,
        buyerUserId: user.id,
        buyerWallet,
        sellerUserId: listing.sellerUserId,
        sellerWallet: listing.sellerWallet,
        tokenContract: listing.tokenContract,
        tokenId: listing.tokenId,
        priceUsdc: listing.priceUsdc,
        chainId: listing.chainId,
        escrowOrderId,
        escrowAddress: await this.escrowWriter.getEscrowAddress(chainId),
        depositTxHash: dto.depositTxHash?.trim() || null,
        autoReleaseAt: new Date(onChain.autoReleaseAt * 1000),
        shipByAt: addBusinessDays(now, 5),
        shipToName: dto.shipToName?.trim() || null,
        shipToLine1: dto.shipToLine1.trim(),
        shipToLine2: dto.shipToLine2?.trim() || null,
        shipToCity: dto.shipToCity.trim(),
        shipToRegion: dto.shipToRegion?.trim() || null,
        shipToPostal: dto.shipToPostal.trim(),
        shipToCountry: dto.shipToCountry.trim().toUpperCase(),
        status: 'SOLD',
      });
      await em.save(order);

      listing.status = 'SOLD';
      await em.save(listing);
      return order;
    });
  }

  async setTracking(
    user: User,
    orderId: string,
    dto: SetP2pTrackingDto,
  ): Promise<P2pOrder> {
    const order = await this.getOrder(orderId);
    if (order.sellerUserId !== user.id) {
      throw new ForbiddenException('Not your order');
    }
    if (order.status !== 'SOLD') {
      throw new BadRequestException('Order is not awaiting shipment');
    }
    order.carrier = dto.carrier;
    order.trackingNumber = dto.trackingNumber.trim();
    return this.orders.save(order);
  }

  async recordSettlement(
    user: User,
    orderId: string,
    dto: RecordP2pSettlementDto,
  ): Promise<P2pOrder> {
    const order = await this.getOrder(orderId);
    const isParty =
      order.buyerUserId === user.id || order.sellerUserId === user.id;
    if (!isParty && dto.source !== 'timeout') {
      throw new ForbiddenException('Not a party to this order');
    }
    return this.finalizeReleasedOrder(order, dto.releaseTxHash);
  }

  private async finalizeReleasedOrder(
    order: P2pOrder,
    releaseTxHash: string,
  ): Promise<P2pOrder> {
    if (order.status !== 'SOLD') {
      throw new BadRequestException(`Order status is ${order.status}`);
    }

    const onChain = await this.escrowWriter.getEscrowState(
      order.escrowOrderId,
      asChainId(order.chainId),
    );
    if (onChain.state !== ESCROW_RELEASED) {
      throw new BadRequestException(
        `Escrow not released yet (state=${onChain.state})`,
      );
    }

    order.releaseTxHash = releaseTxHash;
    order.status = 'SETTLED';
    await this.orders.save(order);

    await this.burnListingNft(order);
    order.status = 'CLOSED';
    await this.orders.save(order);

    const listing = await this.getListing(order.listingId);
    listing.status = 'BURNED';
    listing.burnTxHash = order.burnTxHash;
    await this.listings.save(listing);

    return order;
  }

  private async burnListingNft(order: P2pOrder): Promise<void> {
    const chainId = asChainId(order.chainId);
    const custody = await this.chainWriter.getCustodyWalletAddress(chainId);
    const { txHash } = await this.chainWriter.adminBurn(
      Number(order.tokenId),
      chainId,
      custody,
    );
    order.burnTxHash = txHash;
    await this.vault.completeRedemptionBurn({
      tokenContract: order.tokenContract,
      tokenId: order.tokenId,
      burnTxHash: txHash,
    });
  }

  async adminRefund(orderId: string): Promise<P2pOrder> {
    const order = await this.getOrder(orderId);
    if (order.status !== 'SOLD') {
      throw new BadRequestException(`Order status is ${order.status}`);
    }

    const chainId = asChainId(order.chainId);
    const onChain = await this.escrowWriter.getEscrowState(
      order.escrowOrderId,
      chainId,
    );
    if (onChain.state === ESCROW_FUNDED) {
      const { txHash } = await this.escrowWriter.refund(
        order.escrowOrderId,
        chainId,
      );
      order.refundTxHash = txHash;
    } else if (onChain.state !== ESCROW_REFUNDED) {
      throw new BadRequestException(
        `Escrow not in refundable state (state=${onChain.state})`,
      );
    }

    order.status = 'REFUNDED';
    await this.orders.save(order);

    await this.burnListingNft(order);
    order.status = 'BURNED';
    await this.orders.save(order);

    const listing = await this.getListing(order.listingId);
    listing.status = 'BURNED';
    listing.burnTxHash = order.burnTxHash;
    await this.listings.save(listing);

    return order;
  }

  async adminListOrders(status?: string): Promise<P2pOrder[]> {
    if (status) {
      return this.orders.find({
        where: { status: status as P2pOrder['status'] },
        order: { createdAt: 'DESC' },
        take: 200,
      });
    }
    return this.orders.find({ order: { createdAt: 'DESC' }, take: 200 });
  }

  @Cron('0 */30 * * * *')
  async noShipRefundCron(): Promise<void> {
    if (this.config.get<string>('P2P_NO_SHIP_CRON') === '0') return;

    const stale = await this.orders.find({
      where: {
        status: 'SOLD',
        shipByAt: LessThanOrEqual(new Date()),
        trackingNumber: IsNull(),
      },
      take: 20,
    });

    for (const order of stale) {
      try {
        this.logger.warn(`P2P no-ship refund for order ${order.id}`);
        await this.adminRefund(order.id);
      } catch (err) {
        this.logger.error(
          `P2P no-ship refund failed ${order.id}: ${String(err)}`,
        );
      }
    }
  }

  @Cron('0 */15 * * * *')
  async autoReleaseCron(): Promise<void> {
    if (this.config.get<string>('P2P_AUTO_RELEASE_CRON') === '0') return;

    const due = await this.orders.find({
      where: {
        status: 'SOLD',
        autoReleaseAt: LessThanOrEqual(new Date()),
      },
      take: 20,
    });

    for (const order of due) {
      try {
        const chainId = asChainId(order.chainId);
        const state = await this.escrowWriter.getEscrowState(
          order.escrowOrderId,
          chainId,
        );
        if (state.state === ESCROW_FUNDED) {
          const { txHash } = await this.escrowWriter.settleAfterTimeout(
            order.escrowOrderId,
            chainId,
          );
          await this.finalizeReleasedOrder(order, txHash);
        } else if (state.state === ESCROW_RELEASED) {
          await this.finalizeReleasedOrder(
            order,
            order.releaseTxHash || order.depositTxHash || `timeout:${order.id}`,
          );
        }
      } catch (err) {
        this.logger.error(
          `P2P auto-release failed ${order.id}: ${String(err)}`,
        );
      }
    }
  }
}
