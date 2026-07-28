import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { VaultCycle } from './vault-cycle.entity';
import { VaultSubmission } from './vault-submission.entity';

export type VaultSubmissionItemStatus =
  | 'draft'
  | 'confirmed'
  | 'in_transit'
  | 'reviewing'
  | 'approved'
  | 'rejected'
  | 'minting'
  | 'completed'
  | 'failed';

@Entity('vault_submission_items')
@Unique('vault_submission_items_submission_cert_unique', ['submissionId', 'certNumber'])
export class VaultSubmissionItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'submission_id', type: 'uuid' })
  submissionId: string;

  @ManyToOne(() => VaultSubmission, (s) => s.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'submission_id' })
  submission: VaultSubmission;

  @Index()
  @Column({ name: 'cert_number', type: 'varchar', length: 32 })
  certNumber: string;

  @Column({ name: 'display_name', type: 'varchar', length: 512, nullable: true })
  displayName: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  grade: string | null;

  @Column({ name: 'image_url', type: 'text', nullable: true })
  imageUrl: string | null;

  @Column({ type: 'varchar', length: 24, default: 'draft' })
  status: VaultSubmissionItemStatus;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ name: 'vault_cycle_id', type: 'uuid', nullable: true })
  vaultCycleId: string | null;

  @ManyToOne(() => VaultCycle, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'vault_cycle_id' })
  vaultCycle: VaultCycle | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
