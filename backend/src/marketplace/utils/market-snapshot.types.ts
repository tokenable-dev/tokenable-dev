import type { CollectionMarketSnapshotState } from '../entities/collection-market-snapshot.entity';
import type { GradePriceStrip, UsdPoint } from './collection-market.util';
import type { MarketCollectionPreview } from './market-reference.types';

/** Current persisted snapshot schema version. */
export const MARKET_SNAPSHOT_SOURCE_VERSION = 8;

export type SnapshotRefreshReason =
  | 'cron'
  | 'stale_swr'
  | 'cold_start'
  | 'manual';

/** In-memory refresh job — BullMQ-compatible shape for future queue migration. */
export interface SnapshotRefreshJob {
  collectionKey: string;
  reason: SnapshotRefreshReason;
  priority: number;
  enqueuedAt: number;
  /** Lock-contention retry count (0 = first attempt). */
  attempt: number;
}

/** Normalized payload before DB upsert. */
export interface MaterializedMarketSnapshotPayload {
  collectionKey: string;
  cardhedgerCardId: string | null;
  psa10Usd: number | null;
  psa9Usd: number | null;
  rawUsd: number | null;
  headlineUsd: number | null;
  spotPriceBasis: string | null;
  change7dPct: number | null;
  change30dPct: number | null;
  sparkline90dJson: UsdPoint[];
  previewJson: MarketCollectionPreview;
  externalUsdJson: UsdPoint[];
  gradePricesJson: GradePriceStrip;
  categoryLabel: string | null;
  historyTier: string;
  reliabilityScore: number | null;
  marketState: CollectionMarketSnapshotState;
  sourceVersion: number;
}

/** Optional metadata returned alongside API bundles (additive, backward-compatible). */
export interface MarketSnapshotMeta {
  stale: boolean;
  syncedAt: string | null;
  reliabilityScore: number | null;
  marketState: CollectionMarketSnapshotState;
}
