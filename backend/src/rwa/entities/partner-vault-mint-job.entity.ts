import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PartnerVaultMintJobItem } from './partner-vault-mint-job-item.entity';

export type PartnerVaultMintJobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

@Entity('partner_vault_mint_jobs')
export class PartnerVaultMintJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'chain_id', type: 'int' })
  chainId!: number;

  @Column({ name: 'recipient_address', type: 'varchar', length: 42 })
  recipientAddress!: string;

  @Column({ name: 'partner_id', type: 'uuid', nullable: true })
  partnerId!: string | null;

  @Column({ type: 'varchar', length: 32 })
  status!: PartnerVaultMintJobStatus;

  @Column({ name: 'item_count', type: 'int', default: 0 })
  itemCount!: number;

  @Column({ name: 'processed_count', type: 'int', default: 0 })
  processedCount!: number;

  @Column({ name: 'succeeded_count', type: 'int', default: 0 })
  succeededCount!: number;

  @Column({ name: 'failed_count', type: 'int', default: 0 })
  failedCount!: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @OneToMany(() => PartnerVaultMintJobItem, (item) => item.job)
  items!: PartnerVaultMintJobItem[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
