import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Privy-linked account. `google_id` / `password_hash` remain for legacy rows;
 * user login is Privy-only. Marketplace admin passwords live on `marketplace_admins`.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 320, unique: true })
  email: string;

  /** Google subject when Privy linked Google, or leftover from pre-Privy rows */
  @Column({
    name: 'google_id',
    type: 'varchar',
    length: 64,
    unique: true,
    nullable: true,
  })
  googleId: string | null;

  /** Legacy user password hash — unused for login; admin hashes are not stored here */
  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
  passwordHash: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  name: string | null;

  @Column({ name: 'picture_url', type: 'text', nullable: true })
  pictureUrl: string | null;

  @Column({ name: 'email_verified', default: false })
  emailVerified: boolean;

  /** Primary linked wallet (denormalized). Not globally unique — shared wallets allowed. */
  @Column({
    name: 'wallet_address',
    type: 'varchar',
    length: 42,
    nullable: true,
  })
  walletAddress: string | null;

  @Column({ name: 'wallet_linked_at', type: 'timestamptz', nullable: true })
  walletLinkedAt: Date | null;

  /** Privy DID — primary identity when using Privy auth */
  @Column({ name: 'privy_id', type: 'varchar', length: 128, unique: true, nullable: true })
  privyId: string | null;

  /** Identity verification status (Privy KYC in Phase 5) */
  @Column({ name: 'kyc_status', type: 'varchar', length: 16, default: 'none' })
  kycStatus: 'none' | 'pending' | 'approved' | 'rejected';

  @Column({ name: 'kyc_verified_at', type: 'timestamptz', nullable: true })
  kycVerifiedAt: Date | null;

  @Column({ name: 'kyc_provider', type: 'varchar', length: 32, nullable: true })
  kycProvider: string | null;

  @Column({ name: 'kyc_external_id', type: 'varchar', length: 128, nullable: true })
  kycExternalId: string | null;

  @Column({ name: 'kyc_rejection_reason', type: 'text', nullable: true })
  kycRejectionReason: string | null;

  @Column({ name: 'last_privy_sync_at', type: 'timestamptz', nullable: true })
  lastPrivySyncAt: Date | null;

  /** Opt-in for product news / drops (stored preference; delivery TBD). */
  @Column({ name: 'marketing_emails_opt_in', type: 'boolean', default: false })
  marketingEmailsOptIn: boolean;

  /** Master switch for category email notification prefs. */
  @Column({ name: 'email_notifications_enabled', type: 'boolean', default: true })
  emailNotificationsEnabled: boolean;

  /**
   * Per-category email prefs: trades | bids | price | vault.
   * Stored for Settings; senders should honor when email delivery exists.
   */
  @Column({
    name: 'email_notif_prefs',
    type: 'jsonb',
    default: () => `'{"trades":true,"bids":true,"price":true,"vault":true}'`,
  })
  emailNotifPrefs: {
    trades: boolean;
    bids: boolean;
    price: boolean;
    vault: boolean;
  };

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
