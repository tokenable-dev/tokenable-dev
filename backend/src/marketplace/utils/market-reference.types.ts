export type MarketHistoryPeriod = '7d' | '30d' | '90d' | '1y';

export type PriceBand = {
  avg: number | null;
  low: number | null;
  high: number | null;
  lastUpdated: string | null;
  saleCount: number | null;
  approxSaleCount: boolean | null;
  avg1d: number | null;
  avg7d: number | null;
  avg30d: number | null;
  median3d: number | null;
  median7d: number | null;
  median30d: number | null;
};

export type MarketPriceHistoryResult = {
  enabled: boolean;
  searchQuery: string;
  matched: boolean;
  message?: string;
  matchConfidence?: 'verified' | 'approximate';
  days: number;
  tier?: string;
  period?: MarketHistoryPeriod;
  points: Array<{ t: number; v: number }>;
  source: string;
  upstreamRequests: number;
};

export type MarketCollectionPreview = {
  enabled: boolean;
  searchQuery: string;
  matched: boolean;
  message?: string;
  matchConfidence?: 'verified' | 'approximate';
  card: null | {
    id: string;
    name: string;
    cardNumber: string;
    setName: string;
    variant?: string | null;
    setType?: string | null;
    category?: string | null;
    categoryGroup?: string | null;
    setSlug: string | null;
    image: string | null;
    tcgplayerId: string | null;
    currency: string | null;
    market: string | null;
    lastUpdated: string | null;
    topPrice: number | null;
    totalSaleCount: number | null;
    hasGraded: boolean;
    gradedTiersAvailable: string[];
    pricesByGrade?: Record<string, number>;
    sales7d?: number | null;
    sales30d?: number | null;
    gainPct7d?: number | null;
    gainPct30d?: number | null;
    priceReliability?: 'high' | 'low';
    pricingSuppressedReason?: string | null;
    /**
     * How {@link topPrice} / PSA 10 band were chosen.
     * `comps` = Cardhedger `POST /v1/cards/comps` **`comp_price`** when `CARDHEDGER_PSA10_SPOT_BASIS=time_weighted` (smoothed / time-weighted PSA 10).
     * `latest_sale` = last chronological row in comps **`raw_prices`** when spot basis is `last_raw_comp` (default), or last `prices-by-card` point when comps unavailable.
     * `comps_median` = median of the last N chronological PSA 10 comp prints when the final raw
     * comp is a low outlier vs that median on a **liquid** card ({@link MIN_RELIABLE_SALES_30D}).
     * `sparse_sale_avg` = mean of 1–5 recent comps raw sales, or 1–5 `prices-by-card` points when comps raw is not sparse.
     * `catalog` = PSA 10 grade slot from `all-prices-by-card` when comps/history missing.
     */
    spotPriceBasis?:
      | 'comps'
      | 'latest_sale'
      | 'sparse_sale_avg'
      | 'catalog'
      | 'comps_median'
      | null;
    /** Unix seconds — newest `sale_date` in comps raw payload, or history point time when basis is `latest_sale`. */
    latestSaleAt?: number | null;
    ebayNearMint: PriceBand | null;
    tcgplayerNearMint: PriceBand | null;
    ebayPsa10?: PriceBand | null;
    ebayPsa9?: PriceBand | null;
    ebayPsaTiers?: Record<string, PriceBand | null>;
  };
};
