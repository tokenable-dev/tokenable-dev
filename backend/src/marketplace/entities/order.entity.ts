import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum OrderStatus {
  ACTIVE = 'active',
  FULFILLED = 'fulfilled',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  /** Seaport order hash (keccak256 of order parameters) */
  @Index({ unique: true })
  @Column({ name: 'order_hash' })
  orderHash: string;

  /** 판매자 지갑 주소 */
  @Index()
  @Column()
  offerer: string;

  /** Tokenable_RWA (ERC-721) 컨트랙트 주소 */
  @Column({ name: 'token_contract' })
  tokenContract: string;

  /** NFT Token ID */
  @Index()
  @Column({ name: 'token_id' })
  tokenId: string;

  /** 결제 토큰 주소 (Sepolia USDC: 0x1c7D4B...) */
  @Column({ name: 'consideration_token' })
  considerationToken: string;

  /** 결제 금액 (wei 단위 문자열) */
  @Column({ name: 'consideration_amount' })
  considerationAmount: string;

  /** Seaport order parameters 전체 JSON (DB에 저장해서 fulfillOrder에 재사용) */
  @Column({ type: 'jsonb' })
  parameters: Record<string, unknown>;

  /** EIP-712 서명 */
  @Column()
  signature: string;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    enumName: 'orders_status_enum',
    default: OrderStatus.ACTIVE,
  })
  status: OrderStatus;

  /** 주문 시작 시간 (Unix timestamp → Date) */
  @Column({ name: 'start_time' })
  startTime: Date;

  /** 주문 만료 시간 */
  @Index()
  @Column({ name: 'end_time' })
  endTime: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /** 마지막 상태 변경 시각 (판매 완료·취소 등) — 이력 최신순 정렬에 사용 */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
