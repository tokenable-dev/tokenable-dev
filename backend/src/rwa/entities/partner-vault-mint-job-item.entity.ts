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
import { PartnerVaultMintJob } from './partner-vault-mint-job.entity';

export type PartnerVaultMintJobItemStatus =
  | 'pending'
  | 'minting'
  | 'succeeded'
  | 'failed';

@Entity('partner_vault_mint_job_items')
export class PartnerVaultMintJobItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'job_id', type: 'uuid' })
  jobId!: string;

  @ManyToOne(() => PartnerVaultMintJob, (job) => job.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'job_id' })
  job!: PartnerVaultMintJob;

  @Column({ name: 'sort_index', type: 'int', default: 0 })
  sortIndex!: number;

  @Column({ name: 'cert_number', type: 'varchar', length: 32 })
  certNumber!: string;

  @Column({ type: 'varchar', length: 32 })
  status!: PartnerVaultMintJobItemStatus;

  @Column({ name: 'display_name', type: 'varchar', length: 512, nullable: true })
  displayName!: string | null;

  @Column({ name: 'token_id', type: 'varchar', length: 32, nullable: true })
  tokenId!: string | null;

  @Column({ name: 'tx_hash', type: 'varchar', length: 66, nullable: true })
  txHash!: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
