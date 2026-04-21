import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BidStatus } from '../trading/enums';

@Entity('bids')
@Index('idx_bids_collection_price', ['collectionKey', 'priceMicros'])
@Index('idx_bids_token', ['tokenId'])
@Index('idx_bids_active', ['status', 'collectionKey'], {
  where: `"status" = 'active'`,
})
export class Bid {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'bidder_address', type: 'varchar', length: 128 })
  bidderAddress: string;

  @Index()
  @Column({ name: 'collection_key', type: 'varchar', length: 128 })
  collectionKey: string;

  /** Optional direct-token bid; otherwise rule-only applicability */
  @Column({ name: 'token_id', type: 'varchar', length: 128, nullable: true })
  tokenId: string | null;

  @Column({ name: 'price_micros', type: 'bigint' })
  priceMicros: string;

  @Column({ type: 'varchar', length: 16, default: 'USDC' })
  currency: string;

  @Column({ type: 'varchar', length: 32, default: BidStatus.ACTIVE })
  status: BidStatus;

  @Column({ type: 'jsonb' })
  rule: Record<string, unknown>;

  @Column({ name: 'snapshot_id', type: 'varchar', length: 128, nullable: true })
  snapshotId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;
}
