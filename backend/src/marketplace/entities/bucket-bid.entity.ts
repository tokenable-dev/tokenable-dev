import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum BucketBidStatus {
  ACTIVE = 'active',
  FULFILLED = 'fulfilled',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

@Entity('bucket_bids')
export class BucketBid {
  @PrimaryGeneratedColumn()
  id: number;

  /** sha256 hex — logical pool id */
  @Index()
  @Column({ name: 'bucket_key' })
  bucketKey: string;

  @Column({ name: 'token_contract' })
  tokenContract: string;

  /** 매수자 지갑 */
  @Index()
  @Column({ name: 'buyer_offerer' })
  buyerOfferer: string;

  /** USDC 최소단위 문자열 */
  @Column({ name: 'consideration_amount' })
  considerationAmount: string;

  /** UI·감사용 — MarketBucketComponents JSON */
  @Column({ type: 'jsonb' })
  components: Record<string, unknown>;

  /** EIP-712 CollectionBid 서명 (오프체인 약속) */
  @Column({ type: 'text', nullable: true })
  signature: string | null;

  /** 재사용 방지 — buyer별 유일 */
  @Column({ name: 'nonce', type: 'varchar', length: 80, nullable: true })
  nonce: string | null;

  @Column({
    type: 'enum',
    enum: BucketBidStatus,
    enumName: 'bucket_bid_status_enum',
    default: BucketBidStatus.ACTIVE,
  })
  status: BucketBidStatus;

  @Column({ name: 'start_time' })
  startTime: Date;

  @Column({ name: 'end_time' })
  endTime: Date;

  /** string | null 은 reflect-metadata 가 Object 로 잡혀 TypeORM 오류 → type 명시 */
  @Column({
    name: 'fulfilled_token_id',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  fulfilledTokenId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
