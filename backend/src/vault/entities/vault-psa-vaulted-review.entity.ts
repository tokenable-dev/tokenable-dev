import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export type VaultPsaVaultedReviewStatus =
  | 'pending'
  | 'minted'
  | 'failed'
  | 'dismissed';

/**
 * PSA “Items Vaulted / now secured” mail → mint & deliver (PSA → Live).
 */
@Entity('vault_psa_vaulted_reviews')
@Unique('vault_psa_vaulted_reviews_gmail_message_unique', ['gmailMessageId'])
export class VaultPsaVaultedReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'gmail_message_id', type: 'varchar', length: 128 })
  gmailMessageId: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  subject: string | null;

  @Column({ name: 'from_address', type: 'varchar', length: 320, nullable: true })
  fromAddress: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  certs: string[];

  /** Item UUIDs matched at ingest / mint time. */
  @Column({ name: 'matched_item_ids', type: 'jsonb', default: () => "'[]'" })
  matchedItemIds: string[];

  /** Package public ids for matched items. */
  @Column({ name: 'matched_public_ids', type: 'jsonb', default: () => "'[]'" })
  matchedPublicIds: string[];

  @Column({ name: 'unmatched_certs', type: 'jsonb', default: () => "'[]'" })
  unmatchedCerts: string[];

  @Column({ name: 'ingest_note', type: 'varchar', length: 128, nullable: true })
  ingestNote: string | null;

  @Index()
  @Column({ type: 'varchar', length: 24, default: 'pending' })
  status: VaultPsaVaultedReviewStatus;

  /** auto (Gmail poll) | admin (manual mint from queue / confirm). */
  @Column({ name: 'minted_via', type: 'varchar', length: 16, nullable: true })
  mintedVia: 'auto' | 'admin' | null;

  /** Per-cert mint results for audit. */
  @Column({ name: 'mint_results', type: 'jsonb', default: () => "'[]'" })
  mintResults: Array<{
    cert: string;
    itemId?: string;
    publicId?: string;
    ok: boolean;
    tokenId?: number;
    error?: string;
  }>;

  @Column({ name: 'error_summary', type: 'text', nullable: true })
  errorSummary: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
