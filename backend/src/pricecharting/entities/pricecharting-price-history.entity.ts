import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Price set observed on a Seoul calendar day.
 * Written on every import for that Seoul date, even when the cents match the previous day.
 */
@Entity('pricecharting_price_history')
@Index('idx_pricecharting_price_history_observed_on', ['observedOn'])
export class PricechartingPriceHistory {
  @PrimaryColumn({ name: 'product_id', type: 'varchar', length: 32 })
  productId: string;

  @PrimaryColumn({ name: 'observed_on', type: 'date' })
  observedOn: string;

  /** Cent columns, same keys as pricecharting_products. */
  @Column({ type: 'jsonb' })
  prices: Record<string, number | null>;
}
