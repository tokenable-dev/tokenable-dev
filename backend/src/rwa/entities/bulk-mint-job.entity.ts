import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MarketplacePartner } from '../../marketplace/entities/marketplace-partner.entity';
import { BulkMintJobItem } from './bulk-mint-job-item.entity';

export type BulkMintJobStatus =
  | 'pending'
  | 'preparing'
  | 'ready_to_commit'
  | 'committing'
  | 'completed'
  | 'failed';

@Entity('bulk_mint_jobs')
export class BulkMintJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 32 })
  status!: BulkMintJobStatus;

  @Index()
  @Column({ name: 'partner_id', type: 'uuid' })
  partnerId!: string;

  @ManyToOne(() => MarketplacePartner, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'partner_id' })
  partner?: MarketplacePartner;

  @Column({ name: 'chain_id', type: 'int' })
  chainId!: number;

  @Column({ name: 'item_count', type: 'int', default: 0 })
  itemCount!: number;

  @Column({ name: 'prepared_count', type: 'int', default: 0 })
  preparedCount!: number;

  @Column({ name: 'minted_count', type: 'int', default: 0 })
  mintedCount!: number;

  @Column({ name: 'listed_count', type: 'int', default: 0 })
  listedCount!: number;

  @Column({ name: 'failed_count', type: 'int', default: 0 })
  failedCount!: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @OneToMany(() => BulkMintJobItem, (item) => item.job)
  items!: BulkMintJobItem[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
