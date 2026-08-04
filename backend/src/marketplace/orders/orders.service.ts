import { Contract } from 'ethers';
import { createHash } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  In,
  IsNull,
  LessThan,
  Not,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { CollectionService } from '../collections/collection.service';
import {
  ChainConfigService,
  type SupportedChainId,
} from '../../blockchain/chain-config.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { FulfillOrderQueryDto } from './dto/fulfill-order-query.dto';
import { Order, OrderSide, OrderStatus } from '../entities/order.entity';
import { P2pListing } from '../entities/p2p-listing.entity';
import { orderToListItem, type OrderListItem } from '../utils/order-list.util';
import { microsToUsdc } from '../admin/platform-analytics.util';
import { MarketplacePartnersService } from '../partners/marketplace-partners.service';
import { PortfolioHoldingService } from '../portfolio/portfolio-holding.service';
import { NotificationsService } from '../notifications/notifications.service';
import { VaultService } from '../../vault/vault.service';
import { SelfVaultSettlementService } from '../settlement/self-vault-settlement.service';
import { isSelfVaultHoldPolicy } from '../settlement/rwa-settlement-policy';
import {
  backfillAskTokenIdFromParameters,
  isCriteriaCollectionBidOrder,
  isDeadTokenBidFunding,
  isTokenBidOrder,
  isValidDecimalTokenId,
  resolveFulfilledAskTokenId,
} from '../utils/platform-tape.util';

/** Seaport v1.5 — same canonical address used by the frontend. */
const SEAPORT_ADDRESS = '0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC';

const ERC20_BALANCE_ALLOWANCE_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
] as const;

/** DB/API tokenId 표기(앞자리 0 등) 차이로 replace-listing이 실패하지 않도록 비교용 정규화 */
function normalizeDecimalTokenId(raw: string): string {
  const s = String(raw ?? '').trim();
  if (!/^\d+$/.test(s)) return s;
  let i = 0;
  while (i < s.length - 1 && s[i] === '0') i++;
  return s.slice(i);
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(P2pListing)
    private readonly p2pListings: Repository<P2pListing>,
    private readonly config: ConfigService,
    private readonly collectionService: CollectionService,
    private readonly chainConfig: ChainConfigService,
    private readonly portfolioHoldings: PortfolioHoldingService,
    private readonly partners: MarketplacePartnersService,
    private readonly notifications: NotificationsService,
    private readonly vault: VaultService,
    private readonly selfVaultSettlements: SelfVaultSettlementService,
  ) {}

  private async withSellerDisplayNames(
    items: OrderListItem[],
  ): Promise<OrderListItem[]> {
    if (!items.length) return items;
    const names = await this.partners.resolveDisplayNamesByWallets(
      items.map((i) => i.offerer),
    );
    return items.map((i) => ({
      ...i,
      sellerDisplayName: names.get(i.offerer.toLowerCase()) ?? null,
    }));
  }

  private async attachSellerDisplayName<T extends { offerer: string }>(
    order: T,
  ): Promise<T & { sellerDisplayName: string | null }> {
    const names = await this.partners.resolveDisplayNamesByWallets([
      order.offerer,
    ]);
    return Object.assign(order, {
      sellerDisplayName:
        names.get(String(order.offerer).toLowerCase()) ?? null,
    });
  }

  async createOrder(
    dto: CreateOrderDto,
    chainId: SupportedChainId = this.chainConfig.getDefaultChainId(),
  ): Promise<Order> {
    const side = dto.side === 'bid' ? OrderSide.BID : OrderSide.ASK;

    const expectedRwa = this.chainConfig.getRwaAddress(chainId);
    if (dto.tokenContract.toLowerCase() !== expectedRwa) {
      throw new BadRequestException(
        `tokenContract must match RWA for chain ${chainId}`,
      );
    }

    if (side === OrderSide.BID) {
      const cons = dto.parameters.consideration?.[0];
      const itemType = Number(cons?.itemType);
      if (itemType === 2) {
        this.assertValidTokenBid(dto, chainId);
        const bidCollectionKey = dto.collectionKey?.trim().toLowerCase();
        if (!bidCollectionKey) {
          throw new BadRequestException(
            'collectionKey is required for token bids',
          );
        }
        await this.assertActiveTokenBidLimit(
          dto.parameters.offerer,
          bidCollectionKey,
          chainId,
        );
      } else if (itemType === 4) {
        throw new BadRequestException(
          'Collection criteria bids are no longer supported. Place a bid on a specific card instead.',
        );
      } else {
        throw new BadRequestException(
          'Token bids require consideration itemType 2 (ERC721)',
        );
      }
    }

    if (side === OrderSide.ASK) {
      this.assertValidAskListing(dto, chainId);
      await this.assertAskSettlementPolicy(dto, chainId);

      await this.vault.assertTokenRedeemableForListing(
        dto.tokenContract,
        String(dto.tokenId),
      );

      const p2pActive = await this.p2pListings.count({
        where: {
          tokenContract: dto.tokenContract.toLowerCase(),
          tokenId: String(dto.tokenId),
          status: In(['P2P_MINTED_TK', 'P2P_LISTED', 'SOLD']),
        },
      });
      if (p2pActive > 0) {
        throw new BadRequestException(
          `Token #${dto.tokenId} is a P2P listing — Seaport asks are not allowed`,
        );
      }

      const existing = await this.orderRepo.findOne({
        where: {
          tokenContract: dto.tokenContract,
          tokenId: dto.tokenId,
          status: OrderStatus.ACTIVE,
          side: OrderSide.ASK,
        },
      });
      if (existing) {
        throw new BadRequestException(
          `Token #${dto.tokenId} already has an active listing (orderHash: ${existing.orderHash})`,
        );
      }
    }

    const order = await this.materializeOrderFromDto(dto);
    if (side === OrderSide.ASK && !order.collectionKey?.trim()) {
      throw new BadRequestException(
        'Could not create a marketplace collection for this token. Check that graded metadata is on IPFS and try again.',
      );
    }
    const saved = await this.persistOrder(order, this.orderRepo.manager);
    const diagOn =
      this.config.get<string>('MARKETPLACE_PIPELINE_DIAG') === '1' ||
      this.config.get<string>('MARKETPLACE_PIPELINE_DIAG') === 'true';
    if (side === OrderSide.ASK && diagOn) {
      this.logger.log(
        JSON.stringify({
          msg: 'collection_key_pipeline',
          step: 'createOrder_persisted',
          tokenId: String(saved.tokenId),
          orderHash: saved.orderHash,
          collectionKeyPersisted: saved.collectionKey,
          collectionKeyIsNull: saved.collectionKey == null,
        }),
      );
    }
    if (side === OrderSide.BID && isTokenBidOrder(saved)) {
      void this.notifications.notifyAskOwnerOfTokenBid(saved).catch((e) => {
        this.logger.warn(
          `notifyAskOwnerOfTokenBid failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      });
      void this.notifications.notifyBidderOfBidPlaced(saved).catch((e) => {
        this.logger.warn(
          `notifyBidderOfBidPlaced failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      });
    }
    if (side === OrderSide.ASK) {
      void this.notifications.notifySellerListingLive(saved).catch((e) => {
        this.logger.warn(
          `notifySellerListingLive failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      });
    }
    if (side === OrderSide.ASK && saved.collectionKey?.trim()) {
      const reviewStatus = await this.collectionService.getReviewStatus(
        saved.collectionKey,
      );
      return this.attachSellerDisplayName(
        Object.assign(saved, {
          reviewStatus: reviewStatus ?? 'active',
        }),
      );
    }
    return this.attachSellerDisplayName(saved);
  }

  /**
   * First ask listing: create marketplace_collections from token metadata, or reuse
   * a prior ask's key when metadata fetch fails transiently.
   */
  private async resolveAskCollectionKey(
    dto: CreateOrderDto,
    chainId: SupportedChainId,
  ): Promise<string | null> {
    const tidRaw = String(dto.tokenId);
    try {
      const key = await this.collectionService.ensureCollectionForListing(
        tidRaw,
        chainId,
      );
      if (key?.trim()) return key.trim().toLowerCase();
    } catch (e) {
      this.logger.warn(
        `ensureCollectionForListing failed for token #${tidRaw}: ${String(e)}`,
      );
    }

    const tidNorm = normalizeDecimalTokenId(tidRaw);
    const tidVariants = [...new Set([tidRaw, tidNorm].filter((s) => s.length > 0))];
    const prior = await this.orderRepo.findOne({
      where: {
        tokenContract: dto.tokenContract,
        side: OrderSide.ASK,
        tokenId: In(tidVariants),
        collectionKey: Not(IsNull()),
      },
      order: { updatedAt: 'DESC' },
    });
    if (prior?.collectionKey?.trim()) {
      const reused = prior.collectionKey.trim().toLowerCase();
      this.logger.log(
        `Reused collection_key from a prior ask for token #${tidRaw} (ensure failed or returned null).`,
      );
      return reused;
    }

    return null;
  }

  /**
   * Cancel an active ask and insert a new signed listing in one transaction so the
   * Merkle leaf set (active listing token IDs) never briefly drops the token.
   */
  async replaceSellerListing(
    oldOrderHash: string,
    callerAddress: string,
    dto: CreateOrderDto,
    chainId: SupportedChainId = this.chainConfig.getDefaultChainId(),
  ): Promise<Order> {
    if (dto.side === 'bid') {
      throw new BadRequestException(
        'replaceSellerListing only accepts ask listings',
      );
    }
    const expectedRwa = this.chainConfig.getRwaAddress(chainId);
    if (dto.tokenContract.toLowerCase() !== expectedRwa) {
      throw new BadRequestException(
        `tokenContract must match RWA for chain ${chainId}`,
      );
    }
    this.assertValidAskListing(dto, chainId);
    await this.assertAskSettlementPolicy(dto, chainId);

    return this.orderRepo.manager.transaction(async (em) => {
      const old = await em.findOne(Order, {
        where: { orderHash: oldOrderHash },
      });
      if (!old) {
        throw new NotFoundException(`Order not found: ${oldOrderHash}`);
      }
      const effectiveSide = old.side ?? OrderSide.ASK;
      if (effectiveSide !== OrderSide.ASK) {
        throw new BadRequestException('Only ask listings can be replaced');
      }
      if (old.status !== OrderStatus.ACTIVE) {
        throw new BadRequestException(`Order is already ${old.status}`);
      }
      if (old.offerer.toLowerCase() !== callerAddress.toLowerCase()) {
        throw new BadRequestException(
          'Only the offerer can replace this listing',
        );
      }
      if (
        normalizeDecimalTokenId(String(old.tokenId)) !==
        normalizeDecimalTokenId(String(dto.tokenId))
      ) {
        throw new BadRequestException(
          'New order tokenId must match the listing being replaced',
        );
      }
      if (old.tokenContract.toLowerCase() !== dto.tokenContract.toLowerCase()) {
        throw new BadRequestException('tokenContract must match');
      }

      old.status = OrderStatus.CANCELLED;
      await em.save(old);

      const order = await this.materializeOrderFromDto(dto);
      const materializedKeyNull = !order.collectionKey?.trim();
      if (materializedKeyNull && old.collectionKey?.trim()) {
        order.collectionKey = old.collectionKey.trim().toLowerCase();
      }
      if (!order.collectionKey?.trim()) {
        throw new BadRequestException(
          'Could not resolve marketplace collection for this listing replacement.',
        );
      }
      const saved = await this.persistOrder(order, em);
      const diagOn =
        this.config.get<string>('MARKETPLACE_PIPELINE_DIAG') === '1' ||
        this.config.get<string>('MARKETPLACE_PIPELINE_DIAG') === 'true';
      if (diagOn) {
        this.logger.log(
          JSON.stringify({
            msg: 'collection_key_pipeline',
            step: 'replaceSellerListing_persisted',
            tokenId: String(saved.tokenId),
            orderHash: saved.orderHash,
            collectionKeyPersisted: saved.collectionKey,
            reattachedCollectionKeyFromPriorListing:
              materializedKeyNull && saved.collectionKey != null,
          }),
        );
      }
      const reviewStatus = await this.collectionService.getReviewStatus(
        saved.collectionKey!,
      );
      return Object.assign(saved, {
        reviewStatus: reviewStatus ?? 'active',
      });
    });
  }

  /**
   * Cancel an active collection bid and insert a new signed bid in one transaction.
   */
  async replaceBuyerBid(
    oldOrderHash: string,
    callerAddress: string,
    dto: CreateOrderDto,
    chainId: SupportedChainId = this.chainConfig.getDefaultChainId(),
  ): Promise<Order> {
    if (dto.side !== 'bid') {
      throw new BadRequestException('replaceBuyerBid only accepts bids');
    }

    const expectedRwa = this.chainConfig.getRwaAddress(chainId);
    if (dto.tokenContract.toLowerCase() !== expectedRwa) {
      throw new BadRequestException(
        `tokenContract must match RWA for chain ${chainId}`,
      );
    }

    const cons = dto.parameters.consideration?.[0];
    if (!cons || Number(cons.itemType) !== 2) {
      throw new BadRequestException(
        'Only token bids (itemType 2) can be replaced',
      );
    }
    this.assertValidTokenBid(dto, chainId);

    const newCollectionKey = dto.collectionKey?.trim().toLowerCase();
    if (!newCollectionKey) {
      throw new BadRequestException('collectionKey is required for token bids');
    }

    return this.orderRepo.manager.transaction(async (em) => {
      const old = await em.findOne(Order, {
        where: { orderHash: oldOrderHash },
      });
      if (!old) {
        throw new NotFoundException(`Order not found: ${oldOrderHash}`);
      }
      if (!isTokenBidOrder(old)) {
        throw new BadRequestException('Only token bids can be replaced');
      }
      if (old.status !== OrderStatus.ACTIVE) {
        throw new BadRequestException(`Order is already ${old.status}`);
      }
      if (old.offerer.toLowerCase() !== callerAddress.toLowerCase()) {
        throw new BadRequestException('Only the offerer can replace this bid');
      }
      if (
        normalizeDecimalTokenId(String(old.tokenId)) !==
        normalizeDecimalTokenId(String(dto.tokenId))
      ) {
        throw new BadRequestException(
          'New bid tokenId must match the bid being replaced',
        );
      }
      const oldKey = old.collectionKey?.trim().toLowerCase();
      if (!oldKey || oldKey !== newCollectionKey) {
        throw new BadRequestException(
          'New bid collectionKey must match the bid being replaced',
        );
      }

      old.status = OrderStatus.CANCELLED;
      await em.save(old);

      const order = await this.materializeOrderFromDto(dto);
      const saved = await this.persistOrder(order, em);
      void this.notifications.notifyAskOwnerOfTokenBid(saved).catch((e) => {
        this.logger.warn(
          `notifyAskOwnerOfTokenBid (replace) failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      });
      void this.notifications.notifyBidderOfBidPlaced(saved).catch((e) => {
        this.logger.warn(
          `notifyBidderOfBidPlaced (replace) failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      });
      return saved;
    });
  }

  private async materializeOrderFromDto(dto: CreateOrderDto): Promise<Order> {
    const side = dto.side === 'bid' ? OrderSide.BID : OrderSide.ASK;
    const { parameters, signature } = dto;
    const params = parameters as unknown as Record<string, unknown>;
    const chainId =
      this.chainConfig.resolveChainIdFromRwaAddress(dto.tokenContract) ??
      this.chainConfig.getDefaultChainId();

    let collectionKey: string | null = null;
    if (side === OrderSide.BID) {
      const key = dto.collectionKey?.trim().toLowerCase();
      if (!key) {
        throw new BadRequestException('collectionKey is required for token bids');
      }
      const col = await this.collectionService.findOne(key);
      if (!col) {
        throw new NotFoundException(`Collection not found: ${key}`);
      }
      collectionKey = col.collectionKey;
    } else {
      collectionKey = await this.resolveAskCollectionKey(dto, chainId);
      const tid = String(dto.tokenId);
      const diagOn =
        this.config.get<string>('MARKETPLACE_PIPELINE_DIAG') === '1' ||
        this.config.get<string>('MARKETPLACE_PIPELINE_DIAG') === 'true';
      if (!collectionKey) {
        this.logger.warn(
          JSON.stringify({
            msg: 'collection_key_pipeline',
            step: 'materializeOrderFromDto',
            outcome: 'collection_key_null_before_insert',
            side: 'ask',
            tokenId: tid,
            tokenContract: dto.tokenContract,
          }),
        );
      } else if (diagOn) {
        const ck = collectionKey;
        this.logger.log(
          JSON.stringify({
            msg: 'collection_key_pipeline',
            step: 'materializeOrderFromDto',
            outcome: 'collection_key_resolved',
            side: 'ask',
            tokenId: tid,
            collectionKey: ck,
            collectionKeyLength: ck.length,
            matchesSha256HexPattern: /^[0-9a-f]{64}$/i.test(ck),
            isAllLowercase: ck === ck.toLowerCase(),
            statsQueryWillUse: ck.toLowerCase(),
          }),
        );
      }
    }

    const tokenIdForRow =
      side === OrderSide.BID
        ? normalizeDecimalTokenId(String(dto.tokenId))
        : dto.tokenId;

    return this.orderRepo.create({
      orderHash: this.deriveOrderHash(params, side),
      offerer: parameters.offerer,
      tokenContract: dto.tokenContract,
      tokenId: tokenIdForRow,
      considerationToken: dto.considerationToken,
      considerationAmount: dto.considerationAmount,
      parameters: params,
      signature,
      status: OrderStatus.ACTIVE,
      side,
      startTime: new Date(Number(parameters.startTime) * 1000),
      endTime: new Date(Number(parameters.endTime) * 1000),
      collectionKey,
    });
  }

  private async persistOrder(order: Order, em: EntityManager): Promise<Order> {
    try {
      return await em.save(order);
    } catch (e: unknown) {
      if (e instanceof QueryFailedError) {
        const pgCode = (
          e as QueryFailedError & { driverError?: { code?: string } }
        ).driverError?.code;
        this.logger.error(
          `persistOrder failed [${pgCode ?? '?'}]: ${e.message}`,
        );
        if (pgCode === '42P01') {
          throw new ServiceUnavailableException(
            'Database is missing the orders table. Apply migrations on PostgreSQL.',
          );
        }
        if (pgCode === '23505') {
          throw new ConflictException(
            'An order with this hash already exists. Try again with a new salt.',
          );
        }
      }
      throw e;
    }
  }

  private maxActiveCollectionBidsPerOfferer(): number {
    return (
      this.config.get<number>('marketplace.maxActiveCollectionBidsPerOfferer') ??
      1
    );
  }

  /**
   * Per-wallet cap on simultaneous active token bids in one collection
   * (`collection_key` + chain RWA). Default: 1.
   */
  private async assertActiveTokenBidLimit(
    offererAddress: string,
    collectionKey: string,
    chainId: SupportedChainId,
  ): Promise<void> {
    const max = this.maxActiveCollectionBidsPerOfferer();
    const addr = String(offererAddress ?? '').trim().toLowerCase();
    const key = String(collectionKey ?? '').trim().toLowerCase();
    if (!addr || !key) return;

    const rwa = this.chainConfig.getRwaAddress(chainId).toLowerCase();
    const activeCount = await this.orderRepo
      .createQueryBuilder('o')
      .where('LOWER(o.offerer) = :addr', { addr })
      .andWhere('LOWER(o.collection_key) = :key', { key })
      .andWhere('LOWER(o.token_contract) = :rwa', { rwa })
      .andWhere('o.side = :side', { side: OrderSide.BID })
      .andWhere('o.status = :status', { status: OrderStatus.ACTIVE })
      .getCount();

    if (activeCount >= max) {
      throw new BadRequestException(
        max === 1
          ? 'You already have an active bid on this collection. Cancel or edit it to place a new one.'
          : `Maximum ${max} bids per collection. Cancel an existing bid to place a new one.`,
      );
    }
  }

  /** Token offer: offer USDC, consideration ERC721 for a specific tokenId. */
  private assertValidTokenBid(dto: CreateOrderDto, chainId: SupportedChainId): void {
    const p = dto.parameters;
    const offer = p.offer?.[0];
    const cons = p.consideration?.[0];
    if (!offer || !cons) {
      throw new BadRequestException(
        'Bid order must include offer and consideration items',
      );
    }
    if (Number(offer.itemType) !== 1) {
      throw new BadRequestException('Bid offer[0] must be ERC20 (itemType 1)');
    }
    if (Number(cons.itemType) !== 2) {
      throw new BadRequestException(
        'Token bid consideration[0] must be ERC721 (itemType 2)',
      );
    }
    const usdc = this.chainConfig.getUsdcAddress(chainId);
    if (usdc && offer.token.toLowerCase() !== usdc.toLowerCase()) {
      throw new BadRequestException(
        `Bid offer token must match USDC for chain ${chainId}`,
      );
    }
    if (cons.token.toLowerCase() !== dto.tokenContract.toLowerCase()) {
      throw new BadRequestException(
        'Bid consideration token must match tokenContract',
      );
    }
    const tid = String(dto.tokenId ?? '').trim();
    if (!isValidDecimalTokenId(tid)) {
      throw new BadRequestException('Token bids require a valid tokenId');
    }
    const consId = String(cons.identifierOrCriteria ?? '').trim();
    if (
      !isValidDecimalTokenId(consId) ||
      normalizeDecimalTokenId(consId) !== normalizeDecimalTokenId(tid)
    ) {
      throw new BadRequestException(
        'Bid consideration identifierOrCriteria must match tokenId',
      );
    }
  }

  /**
   * Self-vault hold asks: exactly one USDC consideration to PLATFORM_FEE_RECIPIENT
   * (full amount). Standard asks keep the seller (+ optional fee) shape.
   */
  private async assertAskSettlementPolicy(
    dto: CreateOrderDto,
    chainId: SupportedChainId,
  ): Promise<void> {
    const policy = await this.vault.getSettlementPolicy(
      dto.tokenContract,
      String(dto.tokenId),
    );
    if (!isSelfVaultHoldPolicy(policy)) return;

    const feeRecipient = (
      this.config.get<string>('PLATFORM_FEE_RECIPIENT') ?? ''
    )
      .trim()
      .toLowerCase();
    if (!feeRecipient) {
      throw new BadRequestException(
        'PLATFORM_FEE_RECIPIENT is required for self-vault hold listings',
      );
    }

    const cons = dto.parameters.consideration ?? [];
    if (cons.length !== 1) {
      throw new BadRequestException(
        'Self-vault hold asks must have exactly one USDC consideration (100% platform take)',
      );
    }
    const only = cons[0];
    if (Number(only.itemType) !== 1) {
      throw new BadRequestException(
        'Self-vault hold consideration must be ERC20 USDC',
      );
    }
    if (only.recipient.toLowerCase() !== feeRecipient) {
      throw new BadRequestException(
        `Self-vault hold consideration recipient must be the platform fee wallet (${feeRecipient})`,
      );
    }
    if (
      only.recipient.toLowerCase() ===
      String(dto.parameters.offerer ?? '').toLowerCase()
    ) {
      throw new BadRequestException(
        'Self-vault hold asks cannot pay the seller on-chain',
      );
    }
    const amount = BigInt(only.startAmount);
    const declared = BigInt(dto.considerationAmount);
    if (amount !== declared) {
      throw new BadRequestException(
        'Self-vault hold consideration amount must equal considerationAmount',
      );
    }
    void chainId;
  }

  /**
   * Ask listing: consideration[0] = USDC to seller, optional consideration[1] = USDC platform fee.
   * Sum of consideration amounts must equal dto.considerationAmount (= total price).
   * Self-vault hold uses a single fee-recipient consideration (validated separately).
   */
  private assertValidAskListing(dto: CreateOrderDto, chainId: SupportedChainId): void {
    const p = dto.parameters;
    const cons = p.consideration;
    if (!cons || cons.length === 0) {
      throw new BadRequestException(
        'Ask listing must include at least one consideration item',
      );
    }

    const usdc = this.chainConfig.getUsdcAddress(chainId);
    const feeRecipient = (
      this.config.get<string>('PLATFORM_FEE_RECIPIENT') ?? ''
    ).toLowerCase();

    let sum = BigInt(0);
    for (let i = 0; i < cons.length; i++) {
      const c = cons[i];
      if (Number(c.itemType) !== 1) {
        throw new BadRequestException(
          `Ask consideration[${i}] must be ERC20 (itemType 1)`,
        );
      }
      if (usdc && c.token.toLowerCase() !== usdc.toLowerCase()) {
        throw new BadRequestException(
          `Ask consideration[${i}] token must match USDC for chain ${chainId} (${usdc})`,
        );
      }
      sum += BigInt(c.startAmount);
    }

    if (cons.length > 1 && feeRecipient) {
      const feeItem = cons[1];
      if (feeItem.recipient.toLowerCase() !== feeRecipient) {
        this.logger.warn(
          `Ask fee recipient mismatch: expected ${feeRecipient}, got ${feeItem.recipient}`,
        );
      }
    }

    const declared = BigInt(dto.considerationAmount);
    if (sum !== declared) {
      throw new BadRequestException(
        `Sum of consideration amounts (${sum}) does not equal considerationAmount (${declared})`,
      );
    }

    const tid = String(dto.tokenId ?? '').trim();
    if (!isValidDecimalTokenId(tid)) {
      throw new BadRequestException(
        'Ask listings must include a valid ERC-721 tokenId (non-negative integer, including 0)',
      );
    }
    const offerId = String(
      p.offer?.[0]?.identifierOrCriteria ?? '',
    ).trim();
    if (
      isValidDecimalTokenId(offerId) &&
      normalizeDecimalTokenId(offerId) !== normalizeDecimalTokenId(tid)
    ) {
      throw new BadRequestException(
        'Ask offer identifierOrCriteria must match tokenId',
      );
    }
  }

  private activeOrdersCap(requested?: number): number {
    const serverMax = this.config.get<number>('marketplace.activeOrdersMax') ?? 20_000;
    if (requested == null || !Number.isFinite(requested)) {
      return serverMax;
    }
    return Math.min(Math.max(1, Math.floor(requested)), serverMax);
  }

  async findActiveOrders(
    limit?: number,
    chainId?: SupportedChainId,
  ): Promise<Order[]> {
    const id = chainId ?? this.chainConfig.getDefaultChainId();
    const rwaContract = this.chainConfig.getRwaAddress(id).toLowerCase();
    return this.orderRepo
      .createQueryBuilder('o')
      .where('o.status = :st', { st: OrderStatus.ACTIVE })
      .andWhere('o.side = :side', { side: OrderSide.ASK })
      .andWhere('LOWER(o.token_contract) = :rwaContract', { rwaContract })
      .orderBy('o.created_at', 'DESC')
      .take(this.activeOrdersCap(limit))
      .getMany();
  }

  async findActiveOrderListItems(
    limit?: number,
    chainId?: SupportedChainId,
  ): Promise<OrderListItem[]> {
    const rows = await this.findActiveOrders(limit, chainId);
    return this.withSellerDisplayNames(rows.map((o) => orderToListItem(o)));
  }

  /** Active ask listing for an ERC-721 token (including mint id `0`). */
  async findActiveAskByTokenId(
    tokenIdRaw: string,
    chainId?: SupportedChainId,
  ): Promise<(Order & { sellerDisplayName: string | null }) | null> {
    const tid = String(tokenIdRaw ?? '').trim();
    const variants = [
      ...new Set(
        [tid, normalizeDecimalTokenId(tid)].filter((s) => s.length > 0),
      ),
    ];
    if (variants.length === 0) return null;
    const id = chainId ?? this.chainConfig.getDefaultChainId();
    const rwaContract = this.chainConfig.getRwaAddress(id).toLowerCase();
    const order = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.token_id IN (:...variants)', { variants })
      .andWhere('o.status = :st', { st: OrderStatus.ACTIVE })
      .andWhere('o.side = :side', { side: OrderSide.ASK })
      .andWhere('LOWER(o.token_contract) = :rwaContract', { rwaContract })
      .orderBy('o.created_at', 'DESC')
      .getOne();
    if (!order) return null;
    return this.attachSellerDisplayName(order);
  }

  /**
   * Order history keyed by requested token id string (one batch query; no N+1).
   */
  /** Collection criteria bids placed by a wallet (active + historical). */
  async findCollectionBidsByOfferer(
    offererAddress: string,
    limit?: number,
    chainId?: SupportedChainId,
  ): Promise<OrderListItem[]> {
    const addr = offererAddress.trim().toLowerCase();
    if (!addr) return [];
    const cap = Math.min(Math.max(1, limit ?? 100), 500);
    const id = chainId ?? this.chainConfig.getDefaultChainId();
    const rwaContract = this.chainConfig.getRwaAddress(id).toLowerCase();
    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .where('LOWER(o.offerer) = :addr', { addr })
      .andWhere('o.side = :side', { side: OrderSide.BID })
      .andWhere('o.collection_key IS NOT NULL')
      .andWhere('LOWER(o.token_contract) = :rwaContract', { rwaContract })
      .orderBy('o.updated_at', 'DESC')
      .take(cap)
      .getMany();
    return this.withSellerDisplayNames(rows.map((o) => orderToListItem(o)));
  }

  /**
   * Portfolio transaction history for a wallet:
   * - fulfilled asks they listed (SELL)
   * - fulfilled bids they placed (BUY via sell-into-bid)
   * - fulfilled asks they bought (`parameters._filledByBuyer`)
   */
  async findPortfolioActivityOrders(
    walletAddress: string,
    limit?: number,
    chainId?: SupportedChainId,
  ): Promise<OrderListItem[]> {
    const addr = walletAddress.trim().toLowerCase();
    if (!addr) return [];
    const cap = Math.min(Math.max(1, limit ?? 200), 500);
    const id = chainId ?? this.chainConfig.getDefaultChainId();
    const rwaContract = this.chainConfig.getRwaAddress(id).toLowerCase();

    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.status = :st', { st: OrderStatus.FULFILLED })
      .andWhere('LOWER(o.token_contract) = :rwaContract', { rwaContract })
      .andWhere(
        `(LOWER(o.offerer) = :addr OR (o.side = :ask AND LOWER(COALESCE(o.parameters->>'_filledByBuyer', '')) = :addr))`,
        { addr, ask: OrderSide.ASK },
      )
      .orderBy('o.updated_at', 'DESC')
      .take(cap)
      .getMany();

    return this.withSellerDisplayNames(rows.map((o) => orderToListItem(o)));
  }

  async findOrdersBatchByTokenIds(
    tokenIds: number[],
    chainId?: SupportedChainId,
  ): Promise<Record<string, OrderListItem[]>> {
    const out: Record<string, OrderListItem[]> = {};
    const requested = [
      ...new Set(tokenIds.map((n) => Math.floor(Number(n)))),
    ].filter((n) => n >= 0);
    for (const n of requested) {
      out[String(n)] = [];
    }
    if (requested.length === 0) return out;

    const variants = new Set<string>();
    for (const n of requested) {
      const s = String(n);
      variants.add(s);
      variants.add(normalizeDecimalTokenId(s));
    }

    const id = chainId ?? this.chainConfig.getDefaultChainId();
    const rwaContract = this.chainConfig.getRwaAddress(id).toLowerCase();
    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.token_id IN (:...variants)', { variants: [...variants] })
      .andWhere('LOWER(o.token_contract) = :rwaContract', { rwaContract })
      .orderBy('o.updated_at', 'DESC')
      .getMany();

    const names = await this.partners.resolveDisplayNamesByWallets(
      rows.map((o) => o.offerer),
    );

    for (const o of rows) {
      const item = orderToListItem(
        o,
        names.get(o.offerer.toLowerCase()) ?? null,
      );
      const nk = normalizeDecimalTokenId(String(o.tokenId));
      for (const n of requested) {
        if (normalizeDecimalTokenId(String(n)) === nk) {
          out[String(n)].push(item);
          break;
        }
      }
    }

    return out;
  }

  async findByTokenId(
    tokenId: string,
    chainId?: SupportedChainId,
  ): Promise<Order[]> {
    const tid = String(tokenId ?? '').trim();
    const variants = [
      ...new Set(
        [tid, normalizeDecimalTokenId(tid)].filter((s) => s.length > 0),
      ),
    ];
    const id = chainId ?? this.chainConfig.getDefaultChainId();
    const rwaContract = this.chainConfig.getRwaAddress(id).toLowerCase();
    return this.orderRepo
      .createQueryBuilder('o')
      .where('o.token_id IN (:...variants)', { variants })
      .andWhere('LOWER(o.token_contract) = :rwaContract', { rwaContract })
      .orderBy('o.updated_at', 'DESC')
      .getMany();
  }

  async findByHash(
    orderHash: string,
  ): Promise<Order & { sellerDisplayName: string | null }> {
    const order = await this.orderRepo.findOne({ where: { orderHash } });
    if (!order) throw new NotFoundException(`Order not found: ${orderHash}`);
    return this.attachSellerDisplayName(order);
  }

  async cancelOrder(orderHash: string, callerAddress: string): Promise<Order> {
    const order = await this.findByHash(orderHash);

    if (order.status !== OrderStatus.ACTIVE) {
      throw new BadRequestException(`Order is already ${order.status}`);
    }
    if (order.offerer.toLowerCase() !== callerAddress.toLowerCase()) {
      throw new BadRequestException('Only the offerer can cancel this order');
    }

    order.status = OrderStatus.CANCELLED;
    const saved = await this.orderRepo.save(order);
    if (isTokenBidOrder(saved)) {
      void this.notifications
        .notifyAskOwnerOfTokenBidCancelled(saved)
        .catch((e) => {
          this.logger.warn(
            `notifyAskOwnerOfTokenBidCancelled failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        });
    }
    return saved;
  }

  /**
   * Mark an unfundable / expired token bid cancelled so sellers stop retrying it.
   * Idempotent by order_hash. Only cancels when on-chain USDC (or endTime) proves dead.
   */
  async invalidateDeadBid(
    orderHash: string,
    callerAddress: string,
    chainId: SupportedChainId = this.chainConfig.getDefaultChainId(),
  ): Promise<Order> {
    const order = await this.findByHash(orderHash);

    if (order.status !== OrderStatus.ACTIVE) {
      return order;
    }
    if (!isTokenBidOrder(order)) {
      throw new BadRequestException(
        'Only active token bids can be invalidated as dead offers',
      );
    }

    const offer0 = (
      order.parameters as {
        offer?: Array<{ itemType?: number; startAmount?: string }>;
        endTime?: string | number;
      }
    )?.offer?.[0];
    let needed = BigInt(0);
    try {
      needed = BigInt(String(offer0?.startAmount ?? '0').trim() || '0');
    } catch {
      needed = BigInt(0);
    }

    const usdc = this.chainConfig.getUsdcAddress(chainId);
    const provider = this.chainConfig.createJsonRpcProvider(chainId);
    const erc20 = new Contract(usdc, ERC20_BALANCE_ALLOWANCE_ABI, provider);
    const [balRaw, allowanceRaw, block] = await Promise.all([
      erc20.balanceOf(order.offerer) as Promise<bigint>,
      erc20.allowance(order.offerer, SEAPORT_ADDRESS) as Promise<bigint>,
      provider.getBlock('latest'),
    ]);
    const nowSec = Number(block?.timestamp ?? Math.floor(Date.now() / 1000));
    const endTimeSec = Number(
      (order.parameters as { endTime?: string | number })?.endTime ?? 0,
    );

    const verdict = isDeadTokenBidFunding({
      balance: BigInt(balRaw),
      allowance: BigInt(allowanceRaw),
      needed,
      nowSec,
      endTimeSec,
    });
    if (!verdict.dead) {
      throw new BadRequestException(
        'Bid still appears fundable on-chain; not invalidating',
      );
    }

    order.status = OrderStatus.CANCELLED;
    order.parameters = {
      ...(order.parameters ?? {}),
      _deadBid: true,
      _deadBidReason: verdict.reason,
      _deadBidBy: callerAddress.toLowerCase(),
      _deadBidAt: new Date().toISOString(),
    };
    this.logger.log(
      `invalidateDeadBid ${orderHash.slice(0, 10)}… reason=${verdict.reason} by ${callerAddress.slice(0, 10)}…`,
    );
    const saved = await this.orderRepo.save(order);
    void this.notifications.notifyAskOwnerOfUnfilledBid(saved).catch((e) => {
      this.logger.warn(
        `notifyAskOwnerOfUnfilledBid failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    });
    void this.notifications.notifyBidderOfDeadBid(saved).catch((e) => {
      this.logger.warn(
        `notifyBidderOfDeadBid failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    });
    return saved;
  }

  /**
   * Single-order fulfill (e.g. buyer fulfilling an ask listing only).
   * For criteria bid + ask matching, use fulfillMatchedPair after matchAdvancedOrders.
   */
  async fulfillOrder(
    orderHash: string,
    buyerAddress?: string,
    chainId?: SupportedChainId,
  ): Promise<Order> {
    const order = await this.findByHash(orderHash);

    if (order.status !== OrderStatus.ACTIVE) {
      throw new BadRequestException(`Order is already ${order.status}`);
    }

    // Self-vault hold: block fee-less bid-only fulfills (seller would get 100% USDC).
    if (
      order.side === OrderSide.BID &&
      Number(order.parameters?.consideration?.[0]?.itemType) === 2
    ) {
      const policy = await this.vault.getSettlementPolicy(
        order.tokenContract,
        String(order.tokenId),
      );
      if (isSelfVaultHoldPolicy(policy)) {
        throw new BadRequestException(
          'Self-vault hold tokens cannot settle via bid-only fulfill. Match against a full-platform-take ask instead.',
        );
      }
    }

    order.status = OrderStatus.FULFILLED;
    /** Tape UI: direct listing fill = buyer took offer (vs matchAdvanced pair = sell into bid). */
    if (order.side === OrderSide.ASK) {
      order.parameters = {
        ...(order.parameters ?? {}),
        _tapeFillSide: 'buy',
        ...(buyerAddress?.trim()
          ? {
              _filledByBuyer: buyerAddress.trim().toLowerCase(),
              _settlementAmount: String(order.considerationAmount ?? '0'),
            }
          : {}),
      };
      backfillAskTokenIdFromParameters(order);
    } else if (order.side === OrderSide.BID) {
      order.parameters = {
        ...(order.parameters ?? {}),
        _tapeFillSide: 'sell',
        _settlementAmount: String(
          order.parameters?.offer?.[0]?.startAmount ??
            order.considerationAmount ??
            '0',
        ),
      };
    }
    const saved = await this.orderRepo.save(order);

    if (!isCriteriaCollectionBidOrder(saved) && saved.side === OrderSide.ASK) {
      const tid = resolveFulfilledAskTokenId(saved);
      if (tid != null) {
        // NFT left this ask — clear sibling asks only. Other token bids stay
        // (new owner / book can still see open offers on this tokenId).
        const cleared = await this.orderRepo.update(
          {
            tokenContract: saved.tokenContract,
            tokenId: tid,
            status: OrderStatus.ACTIVE,
            side: OrderSide.ASK,
            id: Not(saved.id),
          },
          { status: OrderStatus.CANCELLED },
        );
        const n = cleared.affected ?? 0;
        if (n > 0) {
          this.logger.log(
            `fulfillOrder ${orderHash.slice(0, 10)}…: cancelled ${n} other active ask(s) for token #${tid}`,
          );
        }
      }

      if (buyerAddress?.trim()) {
        await this.seedMarketplaceBuyFromAskFill(
          buyerAddress,
          saved,
          saved.updatedAt ?? new Date(),
          chainId,
        );
        await this.maybeCreateSelfVaultSettlement(
          saved,
          buyerAddress,
          chainId,
        );
        void this.notifications
          .notifyTradeSettled({
            ask: saved,
            buyerWallet: buyerAddress,
          })
          .catch((e) => {
            this.logger.warn(
              `notifyTradeSettled (fulfillOrder) failed: ${e instanceof Error ? e.message : String(e)}`,
            );
          });
      }
    } else if (
      !isCriteriaCollectionBidOrder(saved) &&
      saved.side === OrderSide.BID &&
      Number(saved.parameters?.consideration?.[0]?.itemType) === 2
    ) {
      // Seller accepted a token offer — clear leftover asks on this token only.
      const tid = normalizeDecimalTokenId(String(saved.tokenId));
      if (tid) {
        const cleared = await this.orderRepo.update(
          {
            tokenContract: saved.tokenContract,
            tokenId: tid,
            status: OrderStatus.ACTIVE,
            side: OrderSide.ASK,
          },
          { status: OrderStatus.CANCELLED },
        );
        const n = cleared.affected ?? 0;
        if (n > 0) {
          this.logger.log(
            `fulfillOrder bid ${orderHash.slice(0, 10)}…: cancelled ${n} active ask(s) for token #${tid}`,
          );
        }
      }

      if (buyerAddress?.trim()) {
        const offerAmt = String(
          saved.parameters?.offer?.[0]?.startAmount ??
            saved.considerationAmount ??
            '0',
        );
        await this.seedMarketplaceBuyFromAskFill(
          buyerAddress,
          {
            ...saved,
            side: OrderSide.ASK,
            considerationAmount: offerAmt,
            parameters: {
              ...(saved.parameters ?? {}),
              _filledByBuyer: buyerAddress.trim().toLowerCase(),
              _settlementAmount: offerAmt,
            },
          } as Order,
          saved.updatedAt ?? new Date(),
          chainId,
        );
      }
    }

    return saved;
  }

  /**
   * After on-chain matchAdvancedOrders(ask + criteria bid), mark both fulfilled in DB.
   */
  async fulfillMatchedPair(
    askHash: string,
    bidHash: string,
    chainId?: SupportedChainId,
  ): Promise<{ ask: Order; bid: Order }> {
    const ask = await this.findByHash(askHash);
    const bid = await this.findByHash(bidHash);

    if (ask.side !== OrderSide.ASK || bid.side !== OrderSide.BID) {
      throw new BadRequestException(
        'askHash must be a listing and bidHash a buy order',
      );
    }
    if (
      ask.status !== OrderStatus.ACTIVE ||
      bid.status !== OrderStatus.ACTIVE
    ) {
      throw new BadRequestException('Both orders must be active');
    }

    const consBid = bid.parameters.consideration?.[0];
    const bidItemType = Number(consBid?.itemType);
    if (bidItemType === 2) {
      if (
        normalizeDecimalTokenId(String(ask.tokenId)) !==
        normalizeDecimalTokenId(String(bid.tokenId))
      ) {
        throw new BadRequestException(
          'Token bid must target the same tokenId as the listing',
        );
      }
    } else if (bidItemType === 4) {
      // Legacy criteria bids may still settle if already on-chain.
    } else {
      throw new BadRequestException(
        'bid must be a token bid (itemType 2) or legacy criteria bid (itemType 4)',
      );
    }

    if (
      ask.collectionKey &&
      bid.collectionKey &&
      ask.collectionKey.toLowerCase() !== bid.collectionKey.toLowerCase()
    ) {
      throw new BadRequestException(
        'Listing and bid must belong to the same collection',
      );
    }

    try {
      const askPrice = BigInt(ask.considerationAmount);
      const bidPrice = BigInt(bid.considerationAmount);
      if (bidPrice < askPrice) {
        throw new BadRequestException(
          'Bid USDC amount must be at least the listing price',
        );
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException('Invalid consideration amounts');
    }

    ask.status = OrderStatus.FULFILLED;
    bid.status = OrderStatus.FULFILLED;
    const settlementAmount = (() => {
      const offerAmt = String(
        bid.parameters?.offer?.[0]?.startAmount ?? '',
      ).trim();
      if (offerAmt) return offerAmt;
      return String(bid.considerationAmount ?? ask.considerationAmount ?? '0');
    })();
    const buyer = bid.offerer.trim().toLowerCase();
    ask.parameters = {
      ...(ask.parameters ?? {}),
      _tapeFillSide: 'sell',
      _filledByBuyer: buyer,
      _matchedBidOrderHash: bid.orderHash,
      _settlementAmount: settlementAmount,
    };
    bid.parameters = {
      ...(bid.parameters ?? {}),
      _tapeFillSide: 'sell',
      _matchedAskOrderHash: ask.orderHash,
      _settlementAmount: settlementAmount,
    };
    backfillAskTokenIdFromParameters(ask);
    await this.orderRepo.save([ask, bid]);

    // Clear sibling asks only. Other open bids on this tokenId remain on the book
    // (seller chose one offer; unmatched bids stay for the new owner / later fills).
    const cleared = await this.orderRepo.update(
      {
        tokenContract: ask.tokenContract,
        tokenId: ask.tokenId,
        status: OrderStatus.ACTIVE,
        side: OrderSide.ASK,
        id: Not(ask.id),
      },
      { status: OrderStatus.CANCELLED },
    );
    const n = cleared.affected ?? 0;
    if (n > 0) {
      this.logger.log(
        `fulfillMatchedPair: cancelled ${n} other active ask(s) for token #${ask.tokenId}`,
      );
    }

    await this.seedMarketplaceBuyFromAskFill(
      bid.offerer,
      {
        ...ask,
        considerationAmount: settlementAmount,
      } as Order,
      ask.updatedAt ?? new Date(),
      chainId,
    );

    await this.maybeCreateSelfVaultSettlement(ask, bid.offerer, chainId);

    void this.notifications
      .notifyTradeSettled({
        ask,
        bid,
        buyerWallet: bid.offerer,
        settlementMicros: settlementAmount,
      })
      .catch((e) => {
        this.logger.warn(
          `notifyTradeSettled (fulfillMatchedPair) failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      });

    return { ask, bid };
  }

  private async maybeCreateSelfVaultSettlement(
    ask: Order,
    buyerWallet: string,
    chainId?: SupportedChainId,
  ): Promise<void> {
    try {
      const policy = await this.vault.getSettlementPolicy(
        ask.tokenContract,
        String(ask.tokenId),
      );
      if (!isSelfVaultHoldPolicy(policy)) return;
      const resolved = chainId ?? this.chainConfig.getDefaultChainId();
      await this.selfVaultSettlements.createFromFulfilledAsk({
        ask,
        buyerWallet,
        chainId: resolved,
      });
    } catch (e) {
      this.logger.warn(
        `self_vault_settlement create failed: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  private async seedMarketplaceBuyFromAskFill(
    buyerWallet: string,
    askOrder: Order,
    acquiredAt: Date,
    chainId?: SupportedChainId,
  ): Promise<void> {
    const tidRaw = resolveFulfilledAskTokenId(askOrder);
    if (tidRaw == null) return;
    const tid = Math.floor(Number(tidRaw));
    if (!Number.isFinite(tid) || tid < 0) return;

    const costUsd = microsToUsdc(askOrder.considerationAmount);
    if (!(costUsd > 0)) return;

    try {
      await this.portfolioHoldings.seedMarketplaceBuyCostBasis(
        buyerWallet,
        tid,
        costUsd,
        acquiredAt,
        chainId,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(
        `marketplace buy cost basis seed failed for token #${tid}: ${msg}`,
      );
    }
  }

  /** Runs every 60 seconds to mark timed-out orders as expired. */
  @Cron('*/1 * * * *')
  async expireOrdersCron(): Promise<void> {
    await this.expireOrders();
  }

  private async expireOrders(): Promise<void> {
    const now = new Date();
    const due = await this.orderRepo.find({
      where: { status: OrderStatus.ACTIVE, endTime: LessThan(now) },
      take: 500,
    });
    if (due.length === 0) return;

    for (const order of due) {
      if (isTokenBidOrder(order)) {
        void this.notifications.notifyBidderOfBidExpired(order).catch((e) => {
          this.logger.warn(
            `notifyBidderOfBidExpired failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        });
      }
    }

    await this.orderRepo.update(
      { status: OrderStatus.ACTIVE, endTime: LessThan(now) },
      { status: OrderStatus.EXPIRED },
    );
  }

  private deriveOrderHash(
    parameters: Record<string, unknown>,
    side: OrderSide,
  ): string {
    const raw = JSON.stringify({
      side,
      offerer: parameters['offerer'],
      salt: parameters['salt'],
      counter: parameters['counter'],
      startTime: parameters['startTime'],
      endTime: parameters['endTime'],
    });
    return '0x' + createHash('sha256').update(raw).digest('hex');
  }
}
