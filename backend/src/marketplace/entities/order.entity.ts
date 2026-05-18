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

/** ask = 매도 리스팅(판매자 서명), bid = 매수 입찰(구매자 서명, USDC 오퍼) */
export enum OrderSide {
  ASK = 'ask',
  BID = 'bid',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  /** Seaport order hash (keccak256 of order parameters) */
  @Index({ unique: true })
  @Column({ name: 'order_hash' })
  orderHash: string;

  /**
   * ask: 판매자(리스팅) / bid: 구매자(입찰 서명자)
   */
  @Index()
  @Column()
  offerer: string;

  @Column({
    type: 'varchar',
    length: 16,
    default: OrderSide.ASK,
  })
  side: OrderSide;

  /** Tokenable_RWA (ERC-721) 컨트랙트 주소 */
  @Column({ name: 'token_contract' })
  tokenContract: string;

  /** RWA (ERC-721) token ID */
  @Index()
  @Column({ name: 'token_id' })
  tokenId: string;

  /**
   * 논리 컬렉션 키 (ask: 리스팅 메타; bid: ERC721_WITH_CRITERIA 컬렉션 입찰)
   */
  @Index()
  @Column({
    name: 'collection_key',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  collectionKey: string | null;

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
    type: 'varchar',
    length: 32,
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
