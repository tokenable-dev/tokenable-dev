import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AskStatus } from '../trading/enums';

@Entity('asks')
@Index('idx_asks_token', ['tokenId'])
@Index('idx_asks_collection_floor', ['collectionKey', 'priceMicros'], {
  where: `"status" = 'active'`,
})
@Index('idx_asks_active', ['status'])
export class Ask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'seller_address', type: 'varchar', length: 128 })
  sellerAddress: string;

  @Index()
  @Column({ name: 'token_id', type: 'varchar', length: 128 })
  tokenId: string;

  @Index()
  @Column({ name: 'collection_key', type: 'varchar', length: 128 })
  collectionKey: string;

  @Column({ name: 'price_micros', type: 'bigint' })
  priceMicros: string;

  /** Native PG enum + TypeORM synchronize → enum alter bugs; store as text */
  @Column({ type: 'varchar', length: 32, default: AskStatus.ACTIVE })
  status: AskStatus;

  @Column({ name: 'snapshot_id', type: 'varchar', length: 128, nullable: true })
  snapshotId: string | null;

  /** Denormalized rule-engine inputs (filled when listing is created/updated) */
  @Column({ type: 'double precision', nullable: true })
  grade: number | null;

  @Column({ type: 'jsonb', nullable: true })
  traits: string[] | null;

  @Column({ name: 'external_ref', type: 'jsonb', nullable: true })
  externalRef: Record<string, string> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
