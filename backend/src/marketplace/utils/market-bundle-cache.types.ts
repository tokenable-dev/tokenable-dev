import type { GradePriceStrip, UsdPoint } from './collection-market.util';
import type { MarketCollectionPreview } from './market-reference.types';

/** Matches {@link CollectionMarketService} `PriceHistoryDuration`. */
export type MarketBundleCacheWindow =
  | '7d'
  | '30d'
  | '90d'
  | '180d'
  | '365d';

/**
 * Server-side cache for `GET …/market-series` Cardhedger-heavy work.
 * `platformUsd` is always recomputed (listing trades) — not stored here.
 */
export interface MarketBundleCacheV1 {
  v: 1;
  window: MarketBundleCacheWindow;
  /** From {@link marketHistoryTierFromComponents} — invalidates if bucket grading policy changes. */
  historyTier: string;
  /** `components.cardhedgerCardId` trim, or null */
  cardhedgerCardIdHint: string | null;
  /** `preview.card.id` when matched */
  resolvedCardId: string | null;
  preview: MarketCollectionPreview;
  externalUsd: UsdPoint[];
  gradePrices: GradePriceStrip;
  categoryLabel: string | null;
}
