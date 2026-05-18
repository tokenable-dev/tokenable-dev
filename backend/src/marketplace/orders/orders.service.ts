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
import { CreateOrderDto } from './dto/create-order.dto';
import { Order, OrderSide, OrderStatus } from '../entities/order.entity';
import { orderToListItem, type OrderListItem } from '../utils/order-list.util';

const CRITERIA_TOKEN_SENTINEL = '0';

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
    private readonly config: ConfigService,
    private readonly collectionService: CollectionService,
  ) {}

  async createOrder(dto: CreateOrderDto): Promise<Order> {
    const side = dto.side === 'bid' ? OrderSide.BID : OrderSide.ASK;

    if (side === OrderSide.BID) {
      const cons = dto.parameters.consideration?.[0];
      if (!cons || Number(cons.itemType) !== 4) {
        throw new BadRequestException(
          'Only ERC721_WITH_CRITERIA collection bids are supported (itemType 4)',
        );
      }
      this.assertValidCriteriaBid(dto);
    }

    if (side === OrderSide.ASK) {
      this.assertValidAskListing(dto);

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
    return saved;
  }

  /**
   * Cancel an active ask and insert a new signed listing in one transaction so the
   * Merkle leaf set (active listing token IDs) never briefly drops the token.
   */
  async replaceSellerListing(
    oldOrderHash: string,
    callerAddress: string,
    dto: CreateOrderDto,
  ): Promise<Order> {
    if (dto.side === 'bid') {
      throw new BadRequestException(
        'replaceSellerListing only accepts ask listings',
      );
    }

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
      const materializedKeyNull = order.collectionKey == null;
      /** Re-attach bucket if IPFS/RPC flaked on replace but the prior row had a key (instant match needs it). */
      if (!order.collectionKey && old.collectionKey) {
        order.collectionKey = old.collectionKey;
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
      return saved;
    });
  }

  private async materializeOrderFromDto(dto: CreateOrderDto): Promise<Order> {
    const side = dto.side === 'bid' ? OrderSide.BID : OrderSide.ASK;
    const { parameters, signature } = dto;
    const params = parameters as unknown as Record<string, unknown>;

    let collectionKey: string | null = null;
    if (side === OrderSide.BID) {
      const key = dto.collectionKey?.trim().toLowerCase();
      if (!key) {
        throw new BadRequestException(
          'collectionKey is required for ERC721_WITH_CRITERIA bids',
        );
      }
      const col = await this.collectionService.findOne(key);
      if (!col) {
        throw new NotFoundException(`Collection not found: ${key}`);
      }
      collectionKey = col.collectionKey;
    } else {
      try {
        collectionKey = await this.collectionService.ensureCollectionForListing(
          dto.tokenId,
        );
      } catch (e) {
        this.logger.warn(
          `Collection not attached for token #${dto.tokenId}: ${String(e)}`,
        );
        const tidRaw = String(dto.tokenId);
        const tidNorm = normalizeDecimalTokenId(tidRaw);
        const tidVariants = [
          ...new Set([tidRaw, tidNorm].filter((s) => s.length > 0)),
        ];
        const prior = await this.orderRepo.findOne({
          where: {
            tokenContract: dto.tokenContract,
            side: OrderSide.ASK,
            tokenId: In(tidVariants),
            collectionKey: Not(IsNull()),
          },
          order: { updatedAt: 'DESC' },
        });
        if (prior?.collectionKey) {
          collectionKey = prior.collectionKey;
          this.logger.log(
            `Reused collection_key from a prior ask for token #${dto.tokenId} (metadata fetch failed).`,
          );
        }
      }
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
            note: 'Order will persist with collection_key NULL unless replace flow reuses prior listing key.',
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
      side === OrderSide.BID ? CRITERIA_TOKEN_SENTINEL : dto.tokenId;

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

  /** Collection bid: offer USDC, consideration ERC721_WITH_CRITERIA + Merkle root */
  private assertValidCriteriaBid(dto: CreateOrderDto): void {
    const p = dto.parameters;
    const offer = p.offer?.[0];
    const cons = p.consideration?.[0];
    if (!offer || !cons) {
      throw new BadRequestException(
        'Bid order must include offer and consideration items',
      );
    }
    if (offer.itemType !== 1) {
      throw new BadRequestException('Bid offer[0] must be ERC20 (itemType 1)');
    }
    if (cons.itemType !== 4) {
      throw new BadRequestException(
        'Criteria bid consideration[0] must be ERC721_WITH_CRITERIA (itemType 4)',
      );
    }
    const usdc = this.config.get<string>('USDC_CONTRACT_ADDRESS') ?? '';
    if (usdc && offer.token.toLowerCase() !== usdc.toLowerCase()) {
      throw new BadRequestException(
        'Bid offer token must match USDC_CONTRACT_ADDRESS',
      );
    }
    if (cons.token.toLowerCase() !== dto.tokenContract.toLowerCase()) {
      throw new BadRequestException(
        'Bid consideration token must match tokenContract',
      );
    }
    if (!cons.identifierOrCriteria || cons.identifierOrCriteria === '0') {
      throw new BadRequestException(
        'Criteria bid must set identifierOrCriteria to Merkle root',
      );
    }
    if (dto.tokenId !== CRITERIA_TOKEN_SENTINEL) {
      throw new BadRequestException('Criteria bids must use tokenId "0"');
    }
  }

  /**
   * Ask listing: consideration[0] = USDC to seller, optional consideration[1] = USDC platform fee.
   * Sum of consideration amounts must equal dto.considerationAmount (= total price).
   */
  private assertValidAskListing(dto: CreateOrderDto): void {
    const p = dto.parameters;
    const cons = p.consideration;
    if (!cons || cons.length === 0) {
      throw new BadRequestException(
        'Ask listing must include at least one consideration item',
      );
    }

    const usdc = this.config.get<string>('USDC_CONTRACT_ADDRESS') ?? '';
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
          `Ask consideration[${i}] token must match USDC_CONTRACT_ADDRESS`,
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
  }

  async findActiveOrders(): Promise<Order[]> {
    await this.expireOrders();
    return this.orderRepo.find({
      where: { status: OrderStatus.ACTIVE, side: OrderSide.ASK },
      order: { createdAt: 'DESC' },
    });
  }

  async findActiveOrderListItems(): Promise<OrderListItem[]> {
    const rows = await this.findActiveOrders();
    return rows.map((o) => orderToListItem(o));
  }

  /**
   * Active ask listing for an ERC-721 token (not criteria bid tokenId "0").
   */
  async findActiveAskByTokenId(tokenIdRaw: string): Promise<Order | null> {
    await this.expireOrders();
    const tid = String(tokenIdRaw ?? '').trim();
    const variants = [
      ...new Set(
        [tid, normalizeDecimalTokenId(tid)].filter((s) => s.length > 0),
      ),
    ];
    if (variants.length === 0) return null;
    return this.orderRepo.findOne({
      where: {
        tokenId: In(variants),
        status: OrderStatus.ACTIVE,
        side: OrderSide.ASK,
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Order history keyed by requested token id string (one batch query; no N+1).
   */
  async findOrdersBatchByTokenIds(
    tokenIds: number[],
  ): Promise<Record<string, OrderListItem[]>> {
    await this.expireOrders();
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

    const rows = await this.orderRepo.find({
      where: { tokenId: In([...variants]) },
      order: { updatedAt: 'DESC' },
    });

    for (const o of rows) {
      const item = orderToListItem(o);
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

  async findByTokenId(tokenId: string): Promise<Order[]> {
    await this.expireOrders();
    const tid = String(tokenId ?? '').trim();
    const variants = [
      ...new Set(
        [tid, normalizeDecimalTokenId(tid)].filter((s) => s.length > 0),
      ),
    ];
    return this.orderRepo.find({
      where: { tokenId: In(variants) },
      order: { updatedAt: 'DESC' },
    });
  }

  async findByHash(orderHash: string): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { orderHash } });
    if (!order) throw new NotFoundException(`Order not found: ${orderHash}`);
    return order;
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
    return this.orderRepo.save(order);
  }

  /**
   * Single-order fulfill (e.g. buyer fulfilling an ask listing only).
   * For criteria bid + ask matching, use fulfillMatchedPair after matchAdvancedOrders.
   */
  async fulfillOrder(orderHash: string): Promise<Order> {
    const order = await this.findByHash(orderHash);

    if (order.status !== OrderStatus.ACTIVE) {
      throw new BadRequestException(`Order is already ${order.status}`);
    }

    order.status = OrderStatus.FULFILLED;
    /** Tape UI: direct listing fill = buyer took offer (vs matchAdvanced pair = sell into bid). */
    if (order.side === OrderSide.ASK) {
      order.parameters = {
        ...(order.parameters ?? {}),
        _tapeFillSide: 'buy',
      };
    }
    const saved = await this.orderRepo.save(order);

    const cons0 = (
      saved.parameters as { consideration?: { itemType?: number }[] }
    )?.consideration?.[0];
    const isCriteriaBid =
      saved.side === OrderSide.BID && cons0 && Number(cons0.itemType) === 4;

    if (
      !isCriteriaBid &&
      saved.tokenId &&
      saved.tokenId !== CRITERIA_TOKEN_SENTINEL
    ) {
      const cleared = await this.orderRepo.update(
        {
          tokenContract: saved.tokenContract,
          tokenId: saved.tokenId,
          status: OrderStatus.ACTIVE,
          id: Not(saved.id),
        },
        { status: OrderStatus.CANCELLED },
      );
      const n = cleared.affected ?? 0;
      if (n > 0) {
        this.logger.log(
          `fulfillOrder ${orderHash.slice(0, 10)}…: cancelled ${n} other active order(s) for token #${saved.tokenId}`,
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
    if (!consBid || Number(consBid.itemType) !== 4) {
      throw new BadRequestException(
        'bid must be an ERC721_WITH_CRITERIA collection bid',
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
    ask.parameters = {
      ...(ask.parameters ?? {}),
      _tapeFillSide: 'sell',
    };
    await this.orderRepo.save([ask, bid]);

    const cleared = await this.orderRepo.update(
      {
        tokenContract: ask.tokenContract,
        tokenId: ask.tokenId,
        status: OrderStatus.ACTIVE,
        id: Not(ask.id),
      },
      { status: OrderStatus.CANCELLED },
    );
    const n = cleared.affected ?? 0;
    if (n > 0) {
      this.logger.log(
        `fulfillMatchedPair: cancelled ${n} other active order(s) for token #${ask.tokenId}`,
      );
    }

    return { ask, bid };
  }

  private async expireOrders(): Promise<void> {
    await this.orderRepo.update(
      { status: OrderStatus.ACTIVE, endTime: LessThan(new Date()) },
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
