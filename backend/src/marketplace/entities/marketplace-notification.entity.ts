import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

export type MarketplaceNotificationType = 'bid';

@Entity('marketplace_notifications')
@Unique('marketplace_notifications_recipient_dedupe_unique', [
  'recipientWallet',
  'dedupeKey',
])
export class MarketplaceNotification {
  @PrimaryGeneratedColumn()
  id: number;

  /** Ask offerer wallet that should see this inbox item (lowercase). */
  @Index()
  @Column({ name: 'recipient_wallet', type: 'varchar', length: 42 })
  recipientWallet: string;

  @Column({ type: 'varchar', length: 16, default: 'bid' })
  type: MarketplaceNotificationType;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'varchar', length: 400 })
  body: string;

  /**
   * Stable idempotency key, e.g. `token_bid:<orderHash>`.
   */
  @Column({ name: 'dedupe_key', type: 'varchar', length: 128 })
  dedupeKey: string;

  /**
   * Deep-link + display payload.
   * `{ bidOrderHash, tokenId, askOrderHash?, bidUsdc?, collectionKey? }`
   */
  @Column({ type: 'jsonb', default: {} })
  payload: Record<string, unknown>;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
