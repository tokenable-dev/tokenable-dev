/** Shared Cardhedger market-data types (extracted from the main service for smaller modules). */

export type AiInsightPsa10PriceConfidence = 'high' | 'medium' | 'low';

export interface CollectionAiInsightPricingStats {
  psa10SpotUsd: number | null;
  rawSpotUsd: number | null;
  premiumVsRawPct: number | null;
  sales7d: number | null;
  sales30d: number | null;
  change7dPct: number | null;
  change30dPct: number | null;
  change90dPct: number | null;
  change365dPct: number | null;
  points90d: number;
  points365d: number;
  psa10PriceConfidence: AiInsightPsa10PriceConfidence | null;
  psa10PricingNote: string | null;
  psa10SpotLowUsd: number | null;
  psa10SpotHighUsd: number | null;
  psa10CatalogUsd: number | null;
  /** PSA line population from collection components when persisted (premium context). */
  psaTotalPopulation: number | null;
}

export type CardhedgerCardRow = Record<string, unknown>;

export type CardhedgerCompsHeadline = {
  usd: number;
  latestSaleAtSec: number | null;
  countUsed: number;
};

/** Cached `POST /v1/cards/comps` payload slice — headline + optional raw sale points for charts. */
export type CardhedgerCompsCached = {
  headline: CardhedgerCompsHeadline | null;
  rawPoints: Array<{ t: number; v: number }>;
  /** Upstream 404: catalog match but no indexed sales for requested grade. */
  noSalesForGrade?: boolean;
};

export type CardhedgerPsa10SpotBasis = 'last_raw_comp' | 'time_weighted';
