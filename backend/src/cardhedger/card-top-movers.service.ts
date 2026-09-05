import { Injectable, Logger } from '@nestjs/common';
import { CardhedgerService } from './cardhedger.service';

/** Align with Cardhedger upstream cache (1 hour). */
export const TOP_MOVERS_CACHE_TTL_MS = 60 * 60 * 1000;

const DEFAULT_COUNT = 20;
const MAX_COUNT = 100;

export type TopMoverCard = {
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
  gain: number;
  rookie: boolean;
  prices: Array<{ grade: string; price: string }>;
  seven_day_sales: number | null;
  thirty_day_sales: number | null;
};

export type TopMoversResponse = {
  category: string | null;
  count: number;
  cards: TopMoverCard[];
  total_count: number;
  filtered_count: number;
  gain_threshold: number;
  fetchedAt: string;
  fromCache: boolean;
  cacheExpiresAt: string;
};

type CacheEntry = {
  expiresAt: number;
  data: Omit<TopMoversResponse, 'fromCache'>;
};

function parseNum(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

@Injectable()
export class CardTopMoversService {
  private readonly logger = new Logger(CardTopMoversService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly cardhedger: CardhedgerService) {}

  private cacheKey(category: string | null, count: number): string {
    return `${category ?? 'all'}:${count}`;
  }

  private normalizeCategory(category?: string): string | null {
    const t = category?.trim();
    if (!t) return null;
    return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  }

  private clampCount(count?: number): number {
    const n = count ?? DEFAULT_COUNT;
    if (!Number.isFinite(n)) return DEFAULT_COUNT;
    return Math.min(MAX_COUNT, Math.max(1, Math.floor(n)));
  }

  async getTopMovers(options?: {
    category?: string;
    count?: number;
  }): Promise<TopMoversResponse> {
    const category = this.normalizeCategory(options?.category);
    const count = this.clampCount(options?.count);
    const key = this.cacheKey(category, count);
    const now = Date.now();
    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > now) {
      return { ...hit.data, fromCache: true };
    }

    const started = Date.now();
    const query: Record<string, string> = { count: String(count) };
    if (category) query.category = category;

    const raw = await this.cardhedger.forwardJson('GET', '/v1/cards/top-movers', {
      query,
    });
    const body =
      typeof raw === 'object' && raw != null
        ? (raw as Record<string, unknown>)
        : {};

    const cards = (Array.isArray(body.cards) ? body.cards : [])
      .map((row) => this.normalizeCard(row))
      .filter((c): c is TopMoverCard => c != null);

    const cacheExpiresAt = new Date(now + TOP_MOVERS_CACHE_TTL_MS).toISOString();
    const payload: Omit<TopMoversResponse, 'fromCache'> = {
      category,
      count,
      cards,
      total_count: Math.floor(parseNum(body.total_count) ?? cards.length),
      filtered_count: Math.floor(parseNum(body.filtered_count) ?? cards.length),
      gain_threshold: parseNum(body.gain_threshold) ?? 500,
      fetchedAt: new Date().toISOString(),
      cacheExpiresAt,
    };

    this.cache.set(key, {
      expiresAt: now + TOP_MOVERS_CACHE_TTL_MS,
      data: payload,
    });

    this.logger.log(
      `Top movers [${category ?? 'all'}] count=${count} — ${cards.length} cards in ${Date.now() - started}ms (upstream)`,
    );

    return { ...payload, fromCache: false };
  }

  /** Admin / tests — drop in-memory cache for a key or entire map. */
  clearCache(category?: string, count?: number): void {
    if (category == null && count == null) {
      this.cache.clear();
      return;
    }
    const cat = this.normalizeCategory(category);
    const c = this.clampCount(count);
    this.cache.delete(this.cacheKey(cat, c));
  }

  private normalizeCard(raw: unknown): TopMoverCard | null {
    if (typeof raw !== 'object' || raw == null) return null;
    const row = raw as Record<string, unknown>;
    const cardId = String(row.card_id ?? '').trim();
    if (!cardId) return null;
    const gain = parseNum(row.gain);
    if (gain == null) return null;

    const pricesRaw = Array.isArray(row.prices) ? row.prices : [];
    const prices = pricesRaw
      .filter(
        (p): p is Record<string, unknown> =>
          typeof p === 'object' && p != null,
      )
      .map((p) => ({
        grade: String(p.grade ?? '').trim() || 'Unknown',
        price: String(p.price ?? '').trim(),
      }))
      .filter((p) => p.price.length > 0);

    return {
      card_id: cardId,
      description: String(row.description ?? '').trim(),
      player: typeof row.player === 'string' ? row.player : null,
      set: typeof row.set === 'string' ? row.set : null,
      number: typeof row.number === 'string' ? row.number : null,
      variant: typeof row.variant === 'string' ? row.variant : null,
      image: typeof row.image === 'string' ? row.image : null,
      category: typeof row.category === 'string' ? row.category : null,
      category_group:
        typeof row.category_group === 'string' ? row.category_group : null,
      set_type: typeof row.set_type === 'string' ? row.set_type : null,
      gain,
      rookie: row.rookie === true,
      prices,
      seven_day_sales: parseNum(row['7 Day Sales']),
      thirty_day_sales: parseNum(row['30 Day Sales']),
    };
  }
}
