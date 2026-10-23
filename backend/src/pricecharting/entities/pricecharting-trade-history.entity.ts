import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Admin-uploaded external sold listing for a PriceCharting product.
 * Powers sealed-box collection trades tape (not live PriceCharting API).
 */
@Entity('pricecharting_trade_history')
@Index('idx_pricecharting_trade_history_product_traded', [
  'productId',
  'tradedOn',
])
export class PricechartingTradeHistory {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'product_id', type: 'varchar', length: 32 })
  productId!: string;

  @Column({ name: 'traded_on', type: 'date' })
  tradedOn!: string;

  @Column({ name: 'price_cents', type: 'integer' })
  priceCents!: number;

  @Column({ type: 'varchar', length: 64, default: 'eBay' })
  marketplace!: string;

  @Column({ name: 'sale_type', type: 'varchar', length: 64, default: 'Buy It Now' })
  saleType!: string;

  @Column({ name: 'sale_url', type: 'text', nullable: true })
  saleUrl!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
