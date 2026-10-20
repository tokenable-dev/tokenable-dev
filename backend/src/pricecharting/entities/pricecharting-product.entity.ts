import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * PriceCharting / SportsCardsPro catalog row.
 * Independent of collection_market_snapshots — bulk CSV upsert by product id.
 * Prices are integer cents (`$139.98` → 13998). PSA 10 is manual_only_price_cents.
 */
@Entity('pricecharting_products')
@Index('idx_pricecharting_products_genre', ['genre'])
@Index('idx_pricecharting_products_console', ['consoleName'])
export class PricechartingProduct {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id: string;

  @Column({ name: 'console_name', type: 'varchar', length: 256, default: '' })
  consoleName: string;

  @Column({ name: 'product_name', type: 'varchar', length: 512, default: '' })
  productName: string;

  @Column({ name: 'loose_price_cents', type: 'integer', nullable: true })
  loosePriceCents: number | null;

  @Column({ name: 'cib_price_cents', type: 'integer', nullable: true })
  cibPriceCents: number | null;

  @Column({ name: 'new_price_cents', type: 'integer', nullable: true })
  newPriceCents: number | null;

  @Column({ name: 'graded_price_cents', type: 'integer', nullable: true })
  gradedPriceCents: number | null;

  @Column({ name: 'box_only_price_cents', type: 'integer', nullable: true })
  boxOnlyPriceCents: number | null;

  @Column({ name: 'manual_only_price_cents', type: 'integer', nullable: true })
  manualOnlyPriceCents: number | null;

  @Column({ name: 'bgs_10_price_cents', type: 'integer', nullable: true })
  bgs10PriceCents: number | null;

  @Column({ name: 'condition_9_price_cents', type: 'integer', nullable: true })
  condition9PriceCents: number | null;

  @Column({ name: 'condition_10_price_cents', type: 'integer', nullable: true })
  condition10PriceCents: number | null;

  @Column({ name: 'condition_13_price_cents', type: 'integer', nullable: true })
  condition13PriceCents: number | null;

  @Column({ name: 'condition_14_price_cents', type: 'integer', nullable: true })
  condition14PriceCents: number | null;

  @Column({ name: 'condition_15_price_cents', type: 'integer', nullable: true })
  condition15PriceCents: number | null;

  @Column({ name: 'condition_16_price_cents', type: 'integer', nullable: true })
  condition16PriceCents: number | null;

  @Column({ name: 'condition_17_price_cents', type: 'integer', nullable: true })
  condition17PriceCents: number | null;

  @Column({ name: 'condition_18_price_cents', type: 'integer', nullable: true })
  condition18PriceCents: number | null;

  @Column({ name: 'condition_19_price_cents', type: 'integer', nullable: true })
  condition19PriceCents: number | null;

  @Column({ name: 'condition_20_price_cents', type: 'integer', nullable: true })
  condition20PriceCents: number | null;

  @Column({ name: 'condition_21_price_cents', type: 'integer', nullable: true })
  condition21PriceCents: number | null;

  @Column({ name: 'condition_22_price_cents', type: 'integer', nullable: true })
  condition22PriceCents: number | null;

  @Column({ name: 'gamestop_price_cents', type: 'integer', nullable: true })
  gamestopPriceCents: number | null;

  @Column({ name: 'gamestop_trade_price_cents', type: 'integer', nullable: true })
  gamestopTradePriceCents: number | null;

  @Column({ name: 'retail_loose_buy_cents', type: 'integer', nullable: true })
  retailLooseBuyCents: number | null;

  @Column({ name: 'retail_loose_sell_cents', type: 'integer', nullable: true })
  retailLooseSellCents: number | null;

  @Column({ name: 'retail_cib_buy_cents', type: 'integer', nullable: true })
  retailCibBuyCents: number | null;

  @Column({ name: 'retail_cib_sell_cents', type: 'integer', nullable: true })
  retailCibSellCents: number | null;

  @Column({ name: 'retail_new_buy_cents', type: 'integer', nullable: true })
  retailNewBuyCents: number | null;

  @Column({ name: 'retail_new_sell_cents', type: 'integer', nullable: true })
  retailNewSellCents: number | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  upc: string | null;

  @Column({ name: 'sales_volume', type: 'integer', nullable: true })
  salesVolume: number | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  genre: string | null;

  /** Upstream value is free text, not a short code. Yu-Gi-Oh rows exceed varchar(64). */
  @Column({ name: 'tcg_id', type: 'text', nullable: true })
  tcgId: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  asin: string | null;

  @Column({ type: 'text', nullable: true })
  epid: string | null;

  @Column({ name: 'release_date', type: 'date', nullable: true })
  releaseDate: string | null;

  @Column({ name: 'source_file', type: 'varchar', length: 256, default: '' })
  sourceFile: string;

  @Column({ name: 'imported_at', type: 'timestamptz' })
  importedAt: Date;
}
