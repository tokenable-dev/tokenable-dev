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
import { LessThan, QueryFailedError, Repository } from 'typeorm';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order, OrderSide, OrderStatus } from './entities/order.entity';

@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly config: ConfigService,
  ) {}

  // ── 주문 생성 ─────────────────────────────────────────────────────
  async createOrder(dto: CreateOrderDto): Promise<Order> {
    const side = dto.side === 'bid' ? OrderSide.BID : OrderSide.ASK;
    const { parameters, signature } = dto;
    const params = parameters as unknown as Record<string, unknown>;

    if (side === OrderSide.BID) {
      this.assertValidBid(dto);
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

    const order = this.orderRepo.create({
      orderHash: this.deriveOrderHash(params, side),
      offerer: parameters.offerer,
      tokenContract: dto.tokenContract,
      tokenId: dto.tokenId,
      considerationToken: dto.considerationToken,
      considerationAmount: dto.considerationAmount,
      parameters: params,
      signature,
      status: OrderStatus.ACTIVE,
      side,
      startTime: new Date(Number(parameters.startTime) * 1000),
      endTime: new Date(Number(parameters.endTime) * 1000),
    });

    try {
      return (await this.orderRepo.save(order)) as Order;
    } catch (e: unknown) {
      if (e instanceof QueryFailedError) {
        const pgCode = (e as QueryFailedError & { driverError?: { code?: string } })
          .driverError?.code;
        this.logger.error(`createOrder failed [${pgCode ?? '?'}]: ${e.message}`);
        if (pgCode === '42P01') {
          throw new ServiceUnavailableException(
            'Database is missing the orders table. Apply backend/sql/migrations/003_create_orders_table.sql on PostgreSQL.',
          );
        }
        if (pgCode === '42703') {
          throw new ServiceUnavailableException(
            'Database is missing the orders.side column. Apply backend/sql/migrations/004_orders_side_enum.sql on PostgreSQL.',
          );
        }
        if (pgCode === '23505') {
          throw new ConflictException(
            'An order with this hash already exists. Try again with a new listing.',
          );
        }
      }
      throw e;
    }
  }

  /** bid: offer=USDC, consideration=NFT to offerer(구매자) */
  private assertValidBid(dto: CreateOrderDto): void {
    const p = dto.parameters;
    const offer = p.offer?.[0];
    const cons = p.consideration?.[0];
    if (!offer || !cons) {
      throw new BadRequestException('Bid order must include offer and consideration items');
    }
    if (offer.itemType !== 1) {
      throw new BadRequestException('Bid offer[0] must be ERC20 (itemType 1)');
    }
    if (cons.itemType !== 2) {
      throw new BadRequestException('Bid consideration[0] must be ERC721 (itemType 2)');
    }
    const usdc = this.config.get<string>('USDC_CONTRACT_ADDRESS') ?? '';
    if (
      usdc &&
      offer.token.toLowerCase() !== usdc.toLowerCase()
    ) {
      throw new BadRequestException('Bid offer token must match USDC_CONTRACT_ADDRESS');
    }
    if (cons.token.toLowerCase() !== dto.tokenContract.toLowerCase()) {
      throw new BadRequestException('Bid consideration token must match tokenContract');
    }
    if (String(cons.identifierOrCriteria) !== dto.tokenId) {
      throw new BadRequestException('Bid NFT token id must match tokenId');
    }
  }

  // ── 활성 매도 주문만 (마켓 그리드) ────────────────────────────────
  async findActiveOrders(): Promise<Order[]> {
    await this.expireOrders();
    return this.orderRepo.find({
      where: { status: OrderStatus.ACTIVE, side: OrderSide.ASK },
      order: { createdAt: 'DESC' },
    });
  }

  /** 활성 매수 입찰 — 가격(USDC 최소단위) 내림차순 */
  async findActiveBidsByTokenId(tokenId: string): Promise<Order[]> {
    await this.expireOrders();
    return this.orderRepo
      .createQueryBuilder('o')
      .where('o.token_id = :tokenId', { tokenId })
      .andWhere('o.status = :st', { st: OrderStatus.ACTIVE })
      .andWhere('o.side = :side', { side: OrderSide.BID })
      .orderBy('CAST(o.consideration_amount AS DECIMAL)', 'DESC')
      .addOrderBy('o.created_at', 'ASC')
      .getMany();
  }

  // ── tokenId로 전체 주문 이력 조회 ────────────────────────────────
  async findByTokenId(tokenId: string): Promise<Order[]> {
    await this.expireOrders();
    return this.orderRepo.find({
      where: { tokenId },
      order: { updatedAt: 'DESC' },
    });
  }

  // ── 단일 주문 조회 ────────────────────────────────────────────────
  async findByHash(orderHash: string): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { orderHash } });
    if (!order) throw new NotFoundException(`Order not found: ${orderHash}`);
    return order;
  }

  // ── 주문 취소 (ask: 판매자 / bid: 입찰자) ─────────────────────────
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

  // ── 구매 완료 처리 (리스팅 이행 또는 입찰 이행 후) ────────────────
  async fulfillOrder(orderHash: string): Promise<Order> {
    const order = await this.findByHash(orderHash);

    if (order.status !== OrderStatus.ACTIVE) {
      throw new BadRequestException(`Order is already ${order.status}`);
    }

    order.status = OrderStatus.FULFILLED;
    const saved = await this.orderRepo.save(order);

    /** 같은 토큰에 대해 다른 활성 ask/bid가 남으면 UI·그리드가 어긋남 → 전부 정리 */
    const cleared = await this.orderRepo.update(
      {
        tokenContract: order.tokenContract,
        tokenId: order.tokenId,
        status: OrderStatus.ACTIVE,
      },
      { status: OrderStatus.CANCELLED },
    );
    const n = cleared.affected ?? 0;
    if (n > 0) {
      this.logger.log(
        `fulfillOrder ${orderHash.slice(0, 10)}…: cancelled ${n} other active order(s) for token #${order.tokenId}`,
      );
    }

    return saved;
  }

  // ── 잘못된 상태 복구 (on-chain revert 후 DB 정정) ─────────────────
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

  // ── 만료된 주문 자동 처리 ─────────────────────────────────────────
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
