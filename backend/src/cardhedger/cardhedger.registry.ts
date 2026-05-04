/**
 * Card Hedge public API surface (OpenAPI v1).
 * Source: https://api.cardhedger.com/openapi.json — update when upstream adds routes.
 */
export const CARDHEDGER_UPSTREAM_DEFAULT = 'https://api.cardhedger.com';

/** Priority: pricing & search first for marketplace / vault flows; rest for analytics & ops. */
export const CARDHEDGER_ENDPOINT_PRIORITY_NOTES = [
  'P0 — POST /v1/cards/prices-by-cert, prices-by-card, price-estimate, batch-price-estimate, comps (listings & valuations)',
  'P1 — POST /v1/cards/card-search, search-cards-wsort, set-search, card-details, card-match',
  'P2 — GET /v1/cards/top-movers, POST price-updates, subscribe-price-updates (market movers & deltas)',
  'P3 — Image/OCR: image-search, details-by-cert-ocr, prices-by-cert-ocr',
  'P4 — Issues API + daily export & player stats',
] as const;

export type CardhedgerOperation = {
  method: string;
  path: string;
  tag: string;
  summary: string;
};

export const CARDHEDGER_OPERATIONS: CardhedgerOperation[] = [
  {
    method: 'GET',
    path: '/v1/cards/top-movers',
    tag: 'Market Data',
    summary: 'Get Top Movers',
  },
  {
    method: 'POST',
    path: '/v1/cards/90day-prices-by-grade',
    tag: 'Market Data',
    summary: 'Get 90-Day Prices By Grade',
  },
  {
    method: 'POST',
    path: '/v1/cards/90day-prices-by-grade-search',
    tag: 'Market Data',
    summary: 'Search Cards with 90-Day Prices By Grade',
  },
  {
    method: 'POST',
    path: '/v1/cards/additions-summary',
    tag: 'Market Data',
    summary: 'Get Additions Summary',
  },
  {
    method: 'POST',
    path: '/v1/cards/price-updates',
    tag: 'Market Data',
    summary: 'Get Price Updates (Delta Poll)',
  },
  {
    method: 'POST',
    path: '/v1/cards/subscribe-price-updates',
    tag: 'Market Data',
    summary: 'Subscribe to Price Updates',
  },
  {
    method: 'POST',
    path: '/v1/cards/sales-stats-by-player',
    tag: 'Market Data',
    summary:
      'Get Bucketed Sales Stats by Player (count, total, average)',
  },
  {
    method: 'POST',
    path: '/v1/cards/total-sales-by-player',
    tag: 'Market Data',
    summary: 'Get Total Sales Count by Player',
  },
  {
    method: 'POST',
    path: '/v1/cards/card-search',
    tag: 'Card Search',
    summary: 'Search Cards',
  },
  {
    method: 'POST',
    path: '/v1/cards/search-cards-wsort',
    tag: 'Card Search',
    summary: 'Search Cards with Sorting',
  },
  {
    method: 'POST',
    path: '/v1/cards/set-search',
    tag: 'Card Search',
    summary: 'Search Card Sets',
  },
  {
    method: 'POST',
    path: '/v1/cards/card-match',
    tag: 'Card Search',
    summary: 'AI-powered card matching',
  },
  {
    method: 'POST',
    path: '/v1/cards/card-details',
    tag: 'Card Details',
    summary: 'Get Card Details by ID',
  },
  {
    method: 'POST',
    path: '/v1/cards/card-request',
    tag: 'Card Details',
    summary: 'Create Card Request (requires commercial agreement)',
  },
  {
    method: 'POST',
    path: '/v1/cards/price-estimate',
    tag: 'Pricing & Valuations',
    summary: 'Get Price Estimate for a Card',
  },
  {
    method: 'POST',
    path: '/v1/cards/batch-price-estimate',
    tag: 'Pricing & Valuations',
    summary: 'Get Batch Price Estimates for Multiple Cards',
  },
  {
    method: 'POST',
    path: '/v1/cards/prices-by-card',
    tag: 'Pricing & Valuations',
    summary: 'Get Card Prices by Card ID',
  },
  {
    method: 'POST',
    path: '/v1/cards/prices-by-cert',
    tag: 'Pricing & Valuations',
    summary: 'Get Card Prices by Certificate Number',
  },
  {
    method: 'POST',
    path: '/v1/cards/batch-prices-by-cert',
    tag: 'Pricing & Valuations',
    summary:
      'Get Best Price Estimates by Certificate Numbers (Batch)',
  },
  {
    method: 'POST',
    path: '/v1/cards/details-by-certs',
    tag: 'Pricing & Valuations',
    summary: 'Get Card Details by Certificate Numbers (Batch)',
  },
  {
    method: 'POST',
    path: '/v1/cards/all-prices-by-card',
    tag: 'Pricing & Valuations',
    summary: 'Get All Latest Prices By Card',
  },
  {
    method: 'POST',
    path: '/v1/cards/comps',
    tag: 'Pricing & Valuations',
    summary: 'Get Comparable Prices (COMPS)',
  },
  {
    method: 'POST',
    path: '/v1/cards/image-search',
    tag: 'Image Search',
    summary: 'Search cards by image',
  },
  {
    method: 'POST',
    path: '/v1/cards/details-by-cert-ocr',
    tag: 'Image Search',
    summary: 'Get Card Details by Graded Card Image',
  },
  {
    method: 'POST',
    path: '/v1/cards/prices-by-cert-ocr',
    tag: 'Image Search',
    summary: 'Get Card Prices by Graded Card Image',
  },
  {
    method: 'GET',
    path: '/v1/cards/issues',
    tag: 'Card Issues',
    summary: 'List your card issues',
  },
  {
    method: 'POST',
    path: '/v1/cards/issues',
    tag: 'Card Issues',
    summary: 'Submit a card data issue',
  },
  {
    method: 'GET',
    path: '/v1/cards/issues/{issue_id}',
    tag: 'Card Issues',
    summary: 'Get issue by ID',
  },
  {
    method: 'GET',
    path: '/v1/download/daily-price-export/{file_date}',
    tag: 'Downloads & Exports',
    summary: 'Download Daily Price Export',
  },
];
