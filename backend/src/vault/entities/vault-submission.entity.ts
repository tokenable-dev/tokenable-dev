import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { VaultSubmissionItem } from './vault-submission-item.entity';

export type VaultSubmissionStatus =
  | 'draft'
  | 'awaiting_shipment'
  | 'in_transit'
  | 'psa_reviewing'
  | 'completed'
  | 'cancelled';

@Entity('vault_submissions')
@Unique('vault_submissions_public_id_unique', ['publicId'])
export class VaultSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'public_id', type: 'varchar', length: 32 })
  publicId: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status: VaultSubmissionStatus;

  @Column({ type: 'varchar', length: 32, nullable: true })
  carrier: string | null;

  @Column({ name: 'tracking_number', type: 'varchar', length: 128, nullable: true })
  trackingNumber: string | null;

  @Column({ name: 'ship_date', type: 'date', nullable: true })
  shipDate: string | null;

  @Column({ name: 'shipped_at', type: 'timestamptz', nullable: true })
  shippedAt: Date | null;

  @Column({ name: 'packing_slip_downloaded_at', type: 'timestamptz', nullable: true })
  packingSlipDownloadedAt: Date | null;

  @OneToMany(() => VaultSubmissionItem, (item) => item.submission, {
    cascade: true,
  })
  items: VaultSubmissionItem[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
