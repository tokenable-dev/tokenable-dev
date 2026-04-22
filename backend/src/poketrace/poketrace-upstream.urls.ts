import { POKETRACE_UPSTREAM_BASE } from './poketrace-api.registry';
import type { PoketraceHistoryPeriod } from './poketrace-period.util';

export type PoketraceListCardsQuery = {
  search?: string;
  set?: string;
  card_number?: string;
  cursor?: string;
  limit?: number;
  variant?: string;
  rarity?: string;
  game?: 'pokemon' | 'pokemon-japanese';
  market?: 'US' | 'EU';
  tcgplayer_ids?: string;
  cardmarket_ids?: string;
  has_graded?: boolean;
};

export type PoketraceListSetsQuery = {
  search?: string;
  game?: 'pokemon' | 'pokemon-japanese';
  cursor?: string;
  limit?: number;
};

export type PoketracePriceHistoryQuery = {
  period: PoketraceHistoryPeriod;
  limit?: number;
  cursor?: string;
};

export type PoketraceListingsQuery = {
  cursor?: string;
  limit?: number;
  grader?: 'PSA' | 'BGS' | 'CGC' | 'SGC';
  grade?: string;
  min_price?: number;
  max_price?: number;
  sort?: 'sold_at_desc' | 'sold_at_asc' | 'price_desc' | 'price_asc';
};

function appendSearchParams(
  url: URL,
  entries: Record<string, string | number | boolean | undefined>,
): void {
  for (const [k, v] of Object.entries(entries)) {
    if (v === undefined || v === '') continue;
    url.searchParams.set(k, String(v));
  }
}

export function buildPoketraceListCardsUrl(q: PoketraceListCardsQuery): string {
  const url = new URL(`${POKETRACE_UPSTREAM_BASE}/cards`);
  appendSearchParams(url, {
    search: q.search,
    set: q.set,
    card_number: q.card_number,
    cursor: q.cursor,
    limit: q.limit != null ? Math.min(20, Math.max(1, q.limit)) : undefined,
    variant: q.variant,
    rarity: q.rarity,
    game: q.game,
    market: q.market,
    tcgplayer_ids: q.tcgplayer_ids,
    cardmarket_ids: q.cardmarket_ids,
    has_graded: q.has_graded,
  });
  return url.toString();
}

export function buildPoketraceGetCardUrl(cardId: string): string {
  return `${POKETRACE_UPSTREAM_BASE}/cards/${encodeURIComponent(cardId.trim())}`;
}

export function buildPoketracePriceHistoryUrl(
  cardId: string,
  tier: string,
  q: PoketracePriceHistoryQuery,
): string {
  const url = new URL(
    `${POKETRACE_UPSTREAM_BASE}/cards/${encodeURIComponent(cardId.trim())}/prices/${encodeURIComponent(tier.trim())}/history`,
  );
  appendSearchParams(url, {
    period: q.period,
    limit: q.limit,
    cursor: q.cursor,
  });
  return url.toString();
}

export function buildPoketraceListSetsUrl(q: PoketraceListSetsQuery): string {
  const url = new URL(`${POKETRACE_UPSTREAM_BASE}/sets`);
  const lim =
    q.limit != null ? Math.min(100, Math.max(1, Math.floor(q.limit))) : undefined;
  appendSearchParams(url, {
    search: q.search,
    game: q.game,
    cursor: q.cursor,
    limit: lim,
  });
  return url.toString();
}

export function buildPoketraceListingsUrl(
  cardId: string,
  q: PoketraceListingsQuery,
): string {
  const url = new URL(
    `${POKETRACE_UPSTREAM_BASE}/cards/${encodeURIComponent(cardId.trim())}/listings`,
  );
  appendSearchParams(url, {
    cursor: q.cursor,
    limit: q.limit != null ? Math.min(20, Math.max(1, Math.floor(q.limit))) : undefined,
    grader: q.grader,
    grade: q.grade,
    min_price: q.min_price,
    max_price: q.max_price,
    sort: q.sort,
  });
  return url.toString();
}
