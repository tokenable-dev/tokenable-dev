import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BulkMintJob } from './bulk-mint-job.entity';

export type BulkMintJobItemStatus =
  | 'pending'
  | 'preparing'
  | 'ready'
  | 'minting'
  | 'minted'
  | 'listed'
  | 'prepare_failed'
  | 'mint_failed'
  | 'list_failed'
  | 'skipped';

@Entity('bulk_mint_job_items')
export class BulkMintJobItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'job_id', type: 'uuid' })
  jobId!: string;

  @ManyToOne(() => BulkMintJob, (job) => job.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  job!: BulkMintJob;

  @Column({ name: 'cert_number', type: 'varchar', length: 32 })
  certNumber!: string;

  /** Human USDC amount string (e.g. "1250.00") — signed into Seaport at list time. */
  @Column({ name: 'list_price_usdc', type: 'varchar', length: 32 })
  listPriceUsdc!: string;

  @Column({ type: 'varchar', length: 32 })
  status!: BulkMintJobItemStatus;

  @Column({ name: 'token_uri', type: 'text', nullable: true })
  tokenUri!: string | null;

  @Column({ name: 'vault_ref', type: 'varchar', length: 66, nullable: true })
  vaultRef!: string | null;

  @Column({ name: 'token_id', type: 'varchar', length: 32, nullable: true })
  tokenId!: string | null;

  @Column({ name: 'tx_hash', type: 'varchar', length: 66, nullable: true })
  txHash!: string | null;

  @Index()
  @Column({ name: 'order_hash', type: 'varchar', length: 66, nullable: true })
  orderHash!: string | null;

  @Column({ name: 'vault_cycle_id', type: 'uuid', nullable: true })
  vaultCycleId!: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ name: 'sort_index', type: 'int', default: 0 })
  sortIndex!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
