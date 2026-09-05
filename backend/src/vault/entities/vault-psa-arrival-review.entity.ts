import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export type VaultPsaArrivalReviewStatus =
  | 'pending'
  | 'confirmed'
  | 'dismissed';

/**
 * PSA “Items Received” mail → Ship→PSA via Gmail poll (auto) or admin confirm.
 */
@Entity('vault_psa_arrival_reviews')
@Unique('vault_psa_arrival_reviews_gmail_message_unique', ['gmailMessageId'])
export class VaultPsaArrivalReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'gmail_message_id', type: 'varchar', length: 128 })
  gmailMessageId: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  subject: string | null;

  @Column({ name: 'from_address', type: 'varchar', length: 320, nullable: true })
  fromAddress: string | null;

  /** Cert numbers parsed from the mail body (UPPER). */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  certs: string[];

  /** Open package public ids matched at ingest time (may be empty). */
  @Column({ name: 'matched_public_ids', type: 'jsonb', default: () => "'[]'" })
  matchedPublicIds: string[];

  /** Certs in the mail with no open in_transit/awaiting package. */
  @Column({ name: 'unmatched_certs', type: 'jsonb', default: () => "'[]'" })
  unmatchedCerts: string[];

  /** Parse / ingest note for ops (e.g. no_certs). Null when matched normally. */
  @Column({ name: 'ingest_note', type: 'varchar', length: 128, nullable: true })
  ingestNote: string | null;

  @Index()
  @Column({ type: 'varchar', length: 24, default: 'pending' })
  status: VaultPsaArrivalReviewStatus;

  /** Set when status becomes confirmed — auto (Gmail poll) or admin. */
  @Column({ name: 'confirmed_via', type: 'varchar', length: 16, nullable: true })
  confirmedVia: 'auto' | 'admin' | null;

  /** Packages that failed mark-arrived at confirm (audit). */
  @Column({ name: 'skipped_public_ids', type: 'jsonb', default: () => "'[]'" })
  skippedPublicIds: string[];

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
