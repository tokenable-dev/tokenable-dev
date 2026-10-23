import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, Unique } from 'typeorm';

/** Seller ask for one PriceCharting catalog product. Not a Seaport order. */
@Entity('pricecharting_listings')
@Unique('uq_pricecharting_listings_seller_request', ['sellerUserId', 'clientRequestId'])
export class PricechartingListing {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Index()
  @Column({ name: 'seller_user_id', type: 'uuid' })
  sellerUserId: string;

  @Column({ name: 'pricecharting_product_id', type: 'varchar', length: 32 })
  pricechartingProductId: string;

  @Column({ name: 'client_request_id', type: 'varchar', length: 64 })
  clientRequestId: string;

  @Column({ name: 'ask_price_cents', type: 'integer', nullable: true })
  askPriceCents: number | null;

  @Column({ type: 'integer', nullable: true })
  quantity: number | null;

  @Column({ name: 'sealed_status', type: 'varchar', length: 80, nullable: true })
  sealedStatus: string | null;

  @Column({ name: 'condition_note', type: 'varchar', length: 500, nullable: true })
  conditionNote: string | null;

  @Index()
  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status: string;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
