import { backendFetch, getApiUrl } from "./client";

// ─── Shared card type ────────────────────────────────────────────────────────

export type PriceByGradeCard = {
  card_id: string;
  description: string;
  player: string | null;
  set: string | null;
  number: string | null;
  variant: string | null;
  image: string | null;
  category: string | null;
  category_group: string | null;
  set_type: string | null;
  "90_day_sales": number | null;
  grade: string | null;
  price: string | null;
};

// ─── Cached Top 100 endpoint (served from DB, daily cron refresh) ───────────

/** Seed fallback — matches the backend's FALLBACK_CATEGORIES. */
export const TOP100_CATEGORIES = ['Pokemon', 'Baseball', 'Basketball', 'Football'] as const;
export type Top100Category = string; // dynamic: backend discovers live categories

export type Top100ApiResponse = {
  category: string;
  grade: string;
  cards: PriceByGradeCard[];
  totalPages: number;
  snapshotDate?: string;
  fetchedAt: string | null;
  stale: boolean;
};

export type Top100HistorySnapshot = {
  category: string;
  grade: string;
  cards: PriceByGradeCard[];
  totalPages: number;
  snapshotDate: string;
  fetchedAt: string | null;
  stale: boolean;
};

export type Top100CategoriesResponse = {
  categories: string[];
  discoveredAt: string | null;
  source: 'live' | 'cache' | 'fallback';
};

export async function getTop100Categories(): Promise<Top100CategoriesResponse> {
  const res = await backendFetch(`${getApiUrl()}/cardhedger/top100/categories`);
  if (!res.ok) {
    throw new Error(`Top 100 categories fetch failed (${res.status})`);
  }
  return res.json() as Promise<Top100CategoriesResponse>;
}

export async function getTop100(category: string): Promise<Top100ApiResponse> {
  const res = await backendFetch(
    `${getApiUrl()}/cardhedger/top100/${encodeURIComponent(category.toLowerCase())}`,
  );
  if (!res.ok) {
    throw new Error(`Top 100 fetch failed [${category}] (${res.status})`);
  }
  return res.json() as Promise<Top100ApiResponse>;
}

export async function getTop100History(
  category: string,
  limit = 2,
): Promise<Top100HistorySnapshot[]> {
  const res = await backendFetch(
    `${getApiUrl()}/cardhedger/top100/${encodeURIComponent(category.toLowerCase())}/history?limit=${limit}`,
  );
  if (!res.ok) {
    throw new Error(`Top 100 history fetch failed [${category}] (${res.status})`);
  }
  return res.json() as Promise<Top100HistorySnapshot[]>;
}

// ─── Card detail & price history (live CardHedger proxy) ─────────────────────

export type CardHedgerPricePoint = {
  closing_date: string;
  Grade?: string;
  grade?: string;
  card_id: string;
  price: string;
};

export type CardHedgerGradePrice = {
  card_id: string;
  grade: string;
  grader?: string;
  price: string;
  display_order?: string;
};

export type CardHedgerCardDetail = {
  card_id: string;
  description: string;
  player: string | null;
  set: string | null;
  number: string | null;
  variant: string | null;
  image: string | null;
  category: string | null;
  category_group: string | null;
  set_type: string | null;
  rookie?: boolean;
  gain?: number;
  prices?: Array<{ grade: string; price: string }>;
  "7 Day Sales"?: number;
  "30 Day Sales"?: number;
};

export async function getCardDetails(
  cardId: string,
): Promise<{ cards: CardHedgerCardDetail[] }> {
  const res = await backendFetch(`${getApiUrl()}/cardhedger/v1/cards/card-details`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ card_id: cardId }),
  });
  if (!res.ok) {
    throw new Error(`Card details fetch failed (${res.status})`);
  }
  return res.json() as Promise<{ cards: CardHedgerCardDetail[] }>;
}

export async function getPricesByCard(req: {
  card_id: string;
  grade: string;
  days?: number;
}): Promise<{ prices: CardHedgerPricePoint[] }> {
  const res = await backendFetch(`${getApiUrl()}/cardhedger/v1/cards/prices-by-card`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    throw new Error(`Price history fetch failed (${res.status})`);
  }
  return res.json() as Promise<{ prices: CardHedgerPricePoint[] }>;
}

export async function getAllPricesByCard(
  cardId: string,
): Promise<{ prices: CardHedgerGradePrice[] }> {
  const res = await backendFetch(`${getApiUrl()}/cardhedger/v1/cards/all-prices-by-card`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ card_id: cardId }),
  });
  if (!res.ok) {
    throw new Error(`All prices fetch failed (${res.status})`);
  }
  return res.json() as Promise<{ prices: CardHedgerGradePrice[] }>;
}

// ─── Direct 90-day prices by grade (proxy, bypasses cache) ──────────────────

export type PriceByGradeResponse = {
  page: number;
  pages: number;
  cards: PriceByGradeCard[];
};

export type PriceByGradeRequest = {
  grade: string;
  page?: number;
  page_size?: number;
  search?: string;
  category?: string;
};

export async function getPriceByGrade(
  req: PriceByGradeRequest,
): Promise<PriceByGradeResponse> {
  const res = await backendFetch(
    `${getApiUrl()}/cardhedger/v1/cards/90day-prices-by-grade`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    },
  );
  if (!res.ok) {
    throw new Error(`CardHedger 90day-prices-by-grade 요청 실패 (${res.status})`);
  }
  return res.json() as Promise<PriceByGradeResponse>;
}
