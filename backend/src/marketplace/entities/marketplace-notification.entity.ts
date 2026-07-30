import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/** Inbox filter tabs: Trade / Bid / Vault / Price Alert. */
export type MarketplaceNotificationType = 'bid' | 'trade' | 'vault' | 'price';

@Entity('marketplace_notifications')
@Unique('marketplace_notifications_recipient_dedupe_unique', [
  'recipientWallet',
  'dedupeKey',
])
export class MarketplaceNotification {
  @PrimaryGeneratedColumn()
  id: number;

  /** Wallet that should see this inbox item (lowercase). */
  @Index()
  @Column({ name: 'recipient_wallet', type: 'varchar', length: 42 })
  recipientWallet: string;

  /**
   * Chain of the related RWA / order.
   * List / mark-all-read are filtered by `x-tokenable-chain-id`.
   */
  @Index()
  @Column({ name: 'chain_id', type: 'integer', default: 11155111 })
  chainId: number;

  @Column({ type: 'varchar', length: 16, default: 'bid' })
  type: MarketplaceNotificationType;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'varchar', length: 400 })
  body: string;

  /**
   * Stable idempotency key, e.g. `top_bid:<orderHash>` or
   * `seller_sold:<askHash>`.
   */
  @Column({ name: 'dedupe_key', type: 'varchar', length: 128 })
  dedupeKey: string;

  /**
   * Deep-link + display payload.
   * Spec event keys live in `eventKey`; optional `href` / `ctaLabel` override
   * default deep-links in NotificationsService.toListItem.
   */
  @Column({ type: 'jsonb', default: {} })
  payload: Record<string, unknown>;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
