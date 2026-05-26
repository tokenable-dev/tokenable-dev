import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { GradePriceStrip, UsdPoint } from '../utils/collection-market.util';
import type { MarketCollectionPreview } from '../utils/market-reference.types';

/** Snapshot freshness lifecycle — separate from marketplace collection metadata. */
export type CollectionMarketSnapshotState =
  | 'fresh'
  | 'stale'
  | 'error'
  | 'empty';

/**
 * Materialized Cardhedger market state per collection bucket key.
 * Request paths read this table first; background workers upsert rows.
 */
@Entity('collection_market_snapshots')
export class CollectionMarketSnapshot {
  @PrimaryColumn({ name: 'collection_key', type: 'varchar', length: 64 })
  collectionKey: string;

  @Column({
    name: 'cardhedger_card_id',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  cardhedgerCardId: string | null;

  @Column({ name: 'psa10_usd', type: 'double precision', nullable: true })
  psa10Usd: number | null;

  @Column({ name: 'psa9_usd', type: 'double precision', nullable: true })
  psa9Usd: number | null;

  @Column({ name: 'raw_usd', type: 'double precision', nullable: true })
  rawUsd: number | null;

  @Column({ name: 'headline_usd', type: 'double precision', nullable: true })
  headlineUsd: number | null;

  /** comps | latest_sale | catalog | sparse_sale_avg — mirrors preview `spotPriceBasis`. */
  @Column({
    name: 'spot_price_basis',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  spotPriceBasis: string | null;

  @Column({ name: 'change_7d_pct', type: 'double precision', nullable: true })
  change7dPct: number | null;

  @Column({ name: 'change_30d_pct', type: 'double precision', nullable: true })
  change30dPct: number | null;

  /** Downsampled ~90d external reference series for list sparklines. */
  @Column({ name: 'sparkline_90d_json', type: 'jsonb', nullable: true })
  sparkline90dJson: UsdPoint[] | null;

  /** Full Cardhedger preview payload — serves GET …/cardhedger without upstream. */
  @Column({ name: 'preview_json', type: 'jsonb', nullable: true })
  previewJson: MarketCollectionPreview | null;

  /** Full external USD series (up to 365d) — serves GET …/market-series without upstream. */
  @Column({ name: 'external_usd_json', type: 'jsonb', nullable: true })
  externalUsdJson: UsdPoint[] | null;

  @Column({ name: 'grade_prices_json', type: 'jsonb', nullable: true })
  gradePricesJson: GradePriceStrip | null;

  @Column({ name: 'category_label', type: 'varchar', length: 512, nullable: true })
  categoryLabel: string | null;

  @Column({ name: 'history_tier', type: 'varchar', length: 32, nullable: true })
  historyTier: string | null;

  /** 0–100 heuristic from liquidity + match confidence. */
  @Column({ name: 'reliability_score', type: 'smallint', nullable: true })
  reliabilityScore: number | null;

  @Column({ name: 'market_state', type: 'varchar', length: 16, default: 'empty' })
  marketState: CollectionMarketSnapshotState;

  @Column({ name: 'synced_at', type: 'timestamptz', nullable: true })
  syncedAt: Date | null;

  /** After this instant the row is considered stale (SWR still serves it). */
  @Column({ name: 'stale_after', type: 'timestamptz', nullable: true })
  staleAfter: Date | null;

  /** Bump when snapshot payload schema changes. */
  @Column({ name: 'source_version', type: 'smallint', default: 1 })
  sourceVersion: number;

  /** Last API read — used to prioritize background refresh. */
  @Column({ name: 'last_viewed_at', type: 'timestamptz', nullable: true })
  lastViewedAt: Date | null;

  @Column({ name: 'last_refresh_error', type: 'text', nullable: true })
  lastRefreshError: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
