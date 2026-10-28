import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Latest ECB reference rate per display currency.
 * `quote_per_usd` is foreign units per 1 USD (Frankfurter `rate` with base USD).
 * One row per currency. History is not retained.
 */
@Entity('fx_rates')
export class FxRate {
  @PrimaryColumn({ type: 'varchar', length: 8 })
  currency: string;

  @Column({
    name: 'quote_per_usd',
    type: 'numeric',
    precision: 20,
    scale: 8,
  })
  quotePerUsd: string;

  @Column({ name: 'observation_date', type: 'date' })
  observationDate: string;

  @Column({ type: 'varchar', length: 32 })
  source: string;

  @Column({ name: 'fetched_at', type: 'timestamptz' })
  fetchedAt: Date;
}
