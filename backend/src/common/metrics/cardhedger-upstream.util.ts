/**
 * Normalizes Cardhedger upstream paths for per-endpoint metrics labels.
 * Dynamic segments (issue id, export date) collapse to registry-style templates.
 */

/** Logical operation tags — optional second dimension on upstream metrics. */
export type CardhedgerUpstreamOperation =
  | 'mint_previews'
  | 'portfolio_snapshot'
  | 'resolve'
  | 'pricing_preview'
  | 'top100_cron'
  | 'psa_analyze'
  | 'ai_insight'
  | 'collection_market'
  | 'proxy'
  | 'unknown';

/** Stable metric key for a Cardhedger upstream route (no leading slash). */
export function normalizeCardhedgerUpstreamPath(upstreamPath: string): string {
  let p = String(upstreamPath ?? '').trim().replace(/^\//, '');
  if (!p.length) return 'unknown';

  if (/^v1\/cards\/issues\/[^/]+$/i.test(p)) {
    return 'v1/cards/issues/{issue_id}';
  }
  if (/^v1\/download\/daily-price-export\/[^/]+$/i.test(p)) {
    return 'v1/download/daily-price-export/{file_date}';
  }
  return p;
}

/** Short slug for logs/Prometheus (last path segment or template tail). */
export function cardhedgerUpstreamEndpointSlug(normalizedPath: string): string {
  const p = normalizeCardhedgerUpstreamPath(normalizedPath);
  if (p.startsWith('v1/cards/')) {
    return p.slice('v1/cards/'.length);
  }
  if (p.startsWith('v1/download/')) {
    return p.slice('v1/download/'.length);
  }
  return p;
}

export const CARDHEDGER_TRACKED_UPSTREAM_ENDPOINTS = [
  'top-movers',
  'card-search',
  'card-match',
  'set-search',
  'search-cards-wsort',
  'card-details',
  'prices-by-cert',
  'batch-prices-by-cert',
  'prices-by-cert-ocr',
  'details-by-cert-ocr',
  'details-by-certs',
  'prices-by-card',
  'comps',
  'all-prices-by-card',
  '90day-prices-by-grade',
  'card-request',
  'price-updates',
  'price-estimate',
  'batch-price-estimate',
  'card-fmv',
  'card-fmv-batch',
  'fmv-by-cert',
  'subscribe-price-updates',
  '90day-prices-by-grade-search',
  'additions-summary',
  'total-sales-by-player',
  'sales-stats-by-player',
  'image-search',
  'image-match',
  'issues',
  'issues/{issue_id}',
  'daily-price-export/{file_date}',
] as const;

export type CardhedgerTrackedUpstreamEndpoint =
  (typeof CARDHEDGER_TRACKED_UPSTREAM_ENDPOINTS)[number];
