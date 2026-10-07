import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/** One-time alert when a collection gets its first active ask on this RWA (BUYER_LISTING_ALERT). */
@Entity('user_buyer_listing_alert')
@Unique('user_buyer_listing_alert_user_collection_contract_unique', [
  'userId',
  'collectionKey',
  'tokenContract',
])
export class UserBuyerListingAlert {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Index()
  @Column({ name: 'collection_key', type: 'varchar', length: 128 })
  collectionKey: string;

  /** RWA address this subscription is scoped to. */
  @Index()
  @Column({ name: 'token_contract', type: 'varchar', length: 42 })
  tokenContract: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  /** Set when the alert fires — subscription auto-off until user re-subscribes. */
  @Column({ name: 'fired_at', type: 'timestamptz', nullable: true })
  firedAt: Date | null;
}
