import type { MarketplaceCollection } from '../marketplace/entities/marketplace-collection.entity';
import type {
  PoketraceCollectionPreview,
  PoketraceNmHistoryResult,
  PriceBand,
} from './poketrace.service';

type UnknownRecord = Record<string, unknown>;

function band(baseUsd: number): PriceBand {
  const b = Math.round(baseUsd * 100) / 100;
  const iso = new Date().toISOString();
  return {
    avg: b,
    low: Math.round(b * 0.92 * 100) / 100,
    high: Math.round(b * 1.08 * 100) / 100,
    lastUpdated: iso,
    saleCount: 48,
    approxSaleCount: false,
    avg1d: Math.round(b * 1.01 * 100) / 100,
    avg7d: Math.round(b * 0.99 * 100) / 100,
    avg30d: Math.round(b * 0.97 * 100) / 100,
    median3d: b,
    median7d: Math.round(b * 0.98 * 100) / 100,
    median30d: Math.round(b * 0.96 * 100) / 100,
  };
}

function componentsLabel(col: MarketplaceCollection | null): {
  cardName: string;
  cardNumber: string;
  setName: string;
  searchQuery: string;
} {
  if (!col) {
    return {
      cardName: 'Sample Trading Card',
      cardNumber: '001',
      setName: 'Mock Expansion',
      searchQuery: 'mock-preview',
    };
  }
  const c = col.components as UnknownRecord;
  const cardName =
    typeof c.cardName === 'string' && c.cardName.trim()
      ? c.cardName.trim()
      : 'Sample Trading Card';
  const cardNumber =
    typeof c.cardNumber === 'string' && c.cardNumber.trim()
      ? c.cardNumber.trim()
      : '001';
  const setName =
    typeof c.cardSet === 'string' && c.cardSet.trim()
      ? c.cardSet.trim()
      : 'Mock Expansion';
  const qu = col.queryUsed?.trim();
  const searchQuery =
    qu && qu.length > 0 ? qu : col.displayLabel?.trim() || 'mock-preview';
  return { cardName, cardNumber, setName, searchQuery };
}

/**
 * Deterministic fake NM eBay history for charts when PokeTrace is unavailable.
 */
export function buildMockPoketraceNmHistory(params: {
  searchQuery: string;
  days: number;
}): PoketraceNmHistoryResult {
  const days = Math.min(365, Math.max(1, Math.floor(params.days)));
  const now = Math.floor(Date.now() / 1000);
  const daySec = 86400;
  const points: Array<{ t: number; v: number }> = [];
  let v = 112.4;
  for (let i = days; i >= 0; i--) {
    const t = now - i * daySec;
    v = v * (1 + Math.sin(i * 0.12) * 0.018 + (i % 7) * 0.0008);
    points.push({ t, v: Math.round(v * 100) / 100 });
  }
  return {
    enabled: true,
    searchQuery: params.searchQuery,
    matched: true,
    message:
      'Mock PokeTrace NM history (set POKETRACE_MOCK_ON_FAILURE=1 or POKETRACE_FORCE_MOCK_DATA=1)',
    isMockData: true,
    days,
    points,
    source: 'ebay NEAR_MINT (mock)',
    upstreamRequests: 0,
  };
}

/**
 * Rich preview row so collection / portfolio / exchange charts can render without upstream.
 */
export function buildMockPoketracePreview(
  col: MarketplaceCollection | null,
): PoketraceCollectionPreview {
  const { cardName, cardNumber, setName, searchQuery } = componentsLabel(col);
  const baseUsd = 125.5;

  return {
    enabled: true,
    searchQuery,
    matched: true,
    matchConfidence: 'verified',
    message:
      'Mock PokeTrace preview (set POKETRACE_MOCK_ON_FAILURE=1 or POKETRACE_FORCE_MOCK_DATA=1)',
    isMockData: true,
    card: {
      id: 'mock-poketrace-card',
      name: cardName,
      cardNumber,
      setName,
      setSlug: 'mock-expansion',
      image: null,
      tcgplayerId: null,
      currency: 'USD',
      market: 'US',
      lastUpdated: new Date().toISOString(),
      topPrice: Math.round(baseUsd * 1.12 * 100) / 100,
      totalSaleCount: 120,
      hasGraded: true,
      gradedTiersAvailable: ['PSA_10', 'PSA_9', 'PSA_8'],
      ebayNearMint: band(baseUsd),
      tcgplayerNearMint: band(baseUsd * 0.99),
    },
  };
}
