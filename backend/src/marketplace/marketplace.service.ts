import { createHash } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, QueryFailedError, Repository } from 'typeorm';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order, OrderStatus } from './entities/order.entity';

@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  // ── 주문 생성 ─────────────────────────────────────────────────────
  async createOrder(dto: CreateOrderDto): Promise<Order> {
    const { parameters, signature } = dto;
    const params = parameters as unknown as Record<string, unknown>;

    // 동일 NFT의 활성 주문이 이미 있으면 거부
    const existing = await this.orderRepo.findOne({
      where: {
        tokenContract: dto.tokenContract,
        tokenId: dto.tokenId,
        status: OrderStatus.ACTIVE,
      },
    });
    if (existing) {
      throw new BadRequestException(
        `Token #${dto.tokenId} already has an active listing (orderHash: ${existing.orderHash})`,
      );
    }

    const order = this.orderRepo.create({
      orderHash: this.deriveOrderHash(params),
      offerer: parameters.offerer,
      tokenContract: dto.tokenContract,
      tokenId: dto.tokenId,
      considerationToken: dto.considerationToken,
      considerationAmount: dto.considerationAmount,
      parameters: params,
      signature,
      status: OrderStatus.ACTIVE,
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
        if (pgCode === '23505') {
          throw new ConflictException(
            'An order with this hash already exists. Try again with a new listing.',
          );
        }
      }
      throw e;
    }
  }

  // ── 활성 주문 목록 ────────────────────────────────────────────────
  async findActiveOrders(): Promise<Order[]> {
    await this.expireOrders();
    return this.orderRepo.find({
      where: { status: OrderStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });
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

  // ── 주문 취소 ─────────────────────────────────────────────────────
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

  // ── 구매 완료 처리 ────────────────────────────────────────────────
  async fulfillOrder(orderHash: string): Promise<Order> {
    const order = await this.findByHash(orderHash);

    if (order.status !== OrderStatus.ACTIVE) {
      throw new BadRequestException(`Order is already ${order.status}`);
    }

    order.status = OrderStatus.FULFILLED;
    return this.orderRepo.save(order);
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

  // ── Order hash 계산 (SHA-256 기반 unique key) ─────────────────────
  // 실제 프로덕션에서는 seaport-js의 getOrderHash()를 사용할 것
  private deriveOrderHash(parameters: Record<string, unknown>): string {
    const raw = JSON.stringify({
      offerer: parameters['offerer'],
      salt: parameters['salt'],
      counter: parameters['counter'],
      startTime: parameters['startTime'],
      endTime: parameters['endTime'],
    });
    return '0x' + createHash('sha256').update(raw).digest('hex');
  }
}
