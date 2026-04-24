/**
 * PokeTrace REST API v1 — operations exposed by upstream (OpenAPI 1.5.0).
 * Pro unlocks graded tiers + full history; Scale adds sold listings + higher limits.
 * Base: https://api.poketrace.com/v1
 */
export const POKETRACE_UPSTREAM_BASE = 'https://api.poketrace.com/v1';

/** Ordered reference for docs and parity checks (paths are relative to {@link POKETRACE_UPSTREAM_BASE}). */
export const POKETRACE_UPSTREAM_OPERATIONS = [
  {
    id: 'list_cards',
    method: 'GET',
    path: '/cards',
    summary: 'List cards (search, set, filters, pagination)',
    proNotes: 'Plan-filtered prices; graded tiers on Pro+',
  },
  {
    id: 'get_card',
    method: 'GET',
    path: '/cards/{id}',
    summary: 'Card detail + prices by source/tier',
    proNotes: 'Graded options + tier prices on Pro+',
  },
  {
    id: 'get_price_history',
    method: 'GET',
    path: '/cards/{id}/prices/{tier}/history',
    summary: 'Tier price history (period: 7d|30d|90d|1y|all)',
    proNotes: 'PSA_10, NEAR_MINT, etc.',
  },
  {
    id: 'list_sets',
    method: 'GET',
    path: '/sets',
    summary: 'List sets with pagination',
    proNotes: 'Same on Free/Pro; data scope unchanged',
  },
  {
    id: 'get_sold_listings',
    method: 'GET',
    path: '/cards/{id}/listings',
    summary: 'Sold eBay listings (per-card)',
    proNotes: 'OpenAPI: Scale plan required (403 otherwise)',
  },
] as const;

export type PoketraceUpstreamOperationId =
  (typeof POKETRACE_UPSTREAM_OPERATIONS)[number]['id'];
