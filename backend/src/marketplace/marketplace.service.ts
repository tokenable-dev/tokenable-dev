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
import { EntityManager, LessThan, Not, QueryFailedError, Repository } from 'typeorm';
import { CollectionService } from './collection.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order, OrderSide, OrderStatus } from './entities/order.entity';

const CRITERIA_TOKEN_SENTINEL = '0';

@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);

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
    return this.persistOrder(order, this.orderRepo.manager);
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
      throw new BadRequestException('replaceSellerListing only accepts ask listings');
    }

    return this.orderRepo.manager.transaction(async (em) => {
      const old = await em.findOne(Order, { where: { orderHash: oldOrderHash } });
      if (!old) {
        throw new NotFoundException(`Order not found: ${oldOrderHash}`);
      }
      if (old.side !== OrderSide.ASK) {
        throw new BadRequestException('Only ask listings can be replaced');
      }
      if (old.status !== OrderStatus.ACTIVE) {
        throw new BadRequestException(`Order is already ${old.status}`);
      }
      if (old.offerer.toLowerCase() !== callerAddress.toLowerCase()) {
        throw new BadRequestException('Only the offerer can replace this listing');
      }
      if (String(old.tokenId) !== dto.tokenId) {
        throw new BadRequestException('New order tokenId must match the listing being replaced');
      }
      if (old.tokenContract.toLowerCase() !== dto.tokenContract.toLowerCase()) {
        throw new BadRequestException('tokenContract must match');
      }

      old.status = OrderStatus.CANCELLED;
      await em.save(old);

      const order = await this.materializeOrderFromDto(dto);
      return this.persistOrder(order, em);
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
        throw new BadRequestException('collectionKey is required for ERC721_WITH_CRITERIA bids');
      }
      const col = await this.collectionService.findOne(key);
      if (!col) {
        throw new NotFoundException(`Collection not found: ${key}`);
      }
      collectionKey = col.collectionKey;
    } else {
      try {
        collectionKey = await this.collectionService.ensureCollectionForListing(dto.tokenId);
      } catch (e) {
        this.logger.warn(
          `Collection not attached for token #${dto.tokenId}: ${String(e)}`,
        );
      }
    }

    const tokenIdForRow =
      side === OrderSide.BID ? CRITERIA_TOKEN_SENTINEL : dto.tokenId;

    return this.orderRepo.create({
      orderHash: this.deriveOrderHash(params, side),
      offerer: parameters.offerer as string,
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
      return (await em.save(order)) as Order;
    } catch (e: unknown) {
      if (e instanceof QueryFailedError) {
        const pgCode = (e as QueryFailedError & { driverError?: { code?: string } })
          .driverError?.code;
        this.logger.error(`persistOrder failed [${pgCode ?? '?'}]: ${e.message}`);
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
      throw new BadRequestException('Bid order must include offer and consideration items');
    }
    if (offer.itemType !== 1) {
      throw new BadRequestException('Bid offer[0] must be ERC20 (itemType 1)');
    }
    if (cons.itemType !== 4) {
      throw new BadRequestException('Criteria bid consideration[0] must be ERC721_WITH_CRITERIA (itemType 4)');
    }
    const usdc = this.config.get<string>('USDC_CONTRACT_ADDRESS') ?? '';
    if (usdc && offer.token.toLowerCase() !== usdc.toLowerCase()) {
      throw new BadRequestException('Bid offer token must match USDC_CONTRACT_ADDRESS');
    }
    if (cons.token.toLowerCase() !== dto.tokenContract.toLowerCase()) {
      throw new BadRequestException('Bid consideration token must match tokenContract');
    }
    if (!cons.identifierOrCriteria || cons.identifierOrCriteria === '0') {
      throw new BadRequestException('Criteria bid must set identifierOrCriteria to Merkle root');
    }
    if (dto.tokenId !== CRITERIA_TOKEN_SENTINEL) {
      throw new BadRequestException('Criteria bids must use tokenId "0"');
    }
  }

  async findActiveOrders(): Promise<Order[]> {
    await this.expireOrders();
    return this.orderRepo.find({
      where: { status: OrderStatus.ACTIVE, side: OrderSide.ASK },
      order: { createdAt: 'DESC' },
    });
  }

  async findByTokenId(tokenId: string): Promise<Order[]> {
    await this.expireOrders();
    return this.orderRepo.find({
      where: { tokenId },
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
    const saved = await this.orderRepo.save(order);

    const cons0 = (saved.parameters as { consideration?: { itemType?: number }[] })?.consideration?.[0];
    const isCriteriaBid =
      saved.side === OrderSide.BID && cons0 && Number(cons0.itemType) === 4;

    if (!isCriteriaBid && saved.tokenId && saved.tokenId !== CRITERIA_TOKEN_SENTINEL) {
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
  async fulfillMatchedPair(askHash: string, bidHash: string): Promise<{ ask: Order; bid: Order }> {
    const ask = await this.findByHash(askHash);
    const bid = await this.findByHash(bidHash);

    if (ask.side !== OrderSide.ASK || bid.side !== OrderSide.BID) {
      throw new BadRequestException('askHash must be a listing and bidHash a buy order');
    }
    if (ask.status !== OrderStatus.ACTIVE || bid.status !== OrderStatus.ACTIVE) {
      throw new BadRequestException('Both orders must be active');
    }

    const consBid = bid.parameters.consideration?.[0];
    if (!consBid || Number(consBid.itemType) !== 4) {
      throw new BadRequestException('bid must be an ERC721_WITH_CRITERIA collection bid');
    }

    if (
      ask.collectionKey &&
      bid.collectionKey &&
      ask.collectionKey.toLowerCase() !== bid.collectionKey.toLowerCase()
    ) {
      throw new BadRequestException('Listing and bid must belong to the same collection');
    }

    try {
      const askPrice = BigInt(ask.considerationAmount);
      const bidPrice = BigInt(bid.considerationAmount);
      if (bidPrice < askPrice) {
        throw new BadRequestException('Bid USDC amount must be at least the listing price');
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException('Invalid consideration amounts');
    }

    ask.status = OrderStatus.FULFILLED;
    bid.status = OrderStatus.FULFILLED;
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

  async reactivateOrder(orderHash: string, callerAddress: string): Promise<Order> {
    const order = await this.findByHash(orderHash);

    if (order.offerer.toLowerCase() !== callerAddress.toLowerCase()) {
      throw new BadRequestException('Only the offerer can reactivate this order');
    }
    if (order.status === OrderStatus.ACTIVE) {
      throw new BadRequestException('Order is already active');
    }
    if (order.status === OrderStatus.EXPIRED) {
      throw new BadRequestException('Cannot reactivate an expired order');
    }

    order.status = OrderStatus.ACTIVE;
    return this.orderRepo.save(order);
  }

  private async expireOrders(): Promise<void> {
    await this.orderRepo.update(
      { status: OrderStatus.ACTIVE, endTime: LessThan(new Date()) },
      { status: OrderStatus.EXPIRED },
    );
  }

  private deriveOrderHash(parameters: Record<string, unknown>, side: OrderSide): string {
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
