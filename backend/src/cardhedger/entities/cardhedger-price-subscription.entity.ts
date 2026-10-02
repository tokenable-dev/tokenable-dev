import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('cardhedger_price_subscriptions')
@Unique('cardhedger_price_subscriptions_external_id_uq', ['externalId'])
@Unique('cardhedger_price_subscriptions_collection_card_grade_uq', [
  'collectionKey',
  'cardId',
  'grade',
])
export class CardhedgerPriceSubscription {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'collection_key', type: 'varchar', length: 128 })
  collectionKey: string;

  @Index()
  @Column({ name: 'card_id', type: 'varchar', length: 128 })
  cardId: string;

  @Column({ type: 'varchar', length: 32 })
  grade: string;

  @Column({ name: 'external_id', type: 'varchar', length: 192 })
  externalId: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ name: 'upstream_success', type: 'boolean', nullable: true })
  upstreamSuccess: boolean | null;

  @Column({ name: 'upstream_error', type: 'text', nullable: true })
  upstreamError: string | null;

  @CreateDateColumn({ name: 'subscribed_at' })
  subscribedAt: Date;

  @Column({ name: 'last_webhook_at', type: 'timestamptz', nullable: true })
  lastWebhookAt: Date | null;

  @Column({ name: 'deactivated_at', type: 'timestamptz', nullable: true })
  deactivatedAt: Date | null;
}
