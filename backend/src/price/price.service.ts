import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetSetsDto } from './dto/get-sets.dto';
import { GetCardsDto } from './dto/get-cards.dto';
import { BatchCardsItemDto } from './dto/batch-cards.dto';

const JUSTTCG_BASE_URL = 'https://api.justtcg.com/v1';

@Injectable()
export class PriceService {
  private readonly logger = new Logger(PriceService.name);
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.getOrThrow<string>('TCG_API_KEY');
  }

  private get defaultHeaders(): Record<string, string> {
    return {
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    this.logger.debug(`JustTCG → ${options.method ?? 'GET'} ${url}`);

    const response = await fetch(url, {
      ...options,
      headers: { ...this.defaultHeaders, ...(options.headers ?? {}) },
    });

    const data = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      const message =
        typeof data.error === 'string'
          ? data.error
          : `JustTCG API error (${response.status})`;
      this.logger.warn(`JustTCG error [${response.status}]: ${message}`);
      throw new HttpException(
        { error: message, code: data.code ?? null },
        response.status,
      );
    }

    return data as T;
  }

  // ── Games ─────────────────────────────────────────────────────
  async getGames(): Promise<unknown> {
    return this.request(`${JUSTTCG_BASE_URL}/games`);
  }

  // ── Sets ──────────────────────────────────────────────────────
  async getSets(dto: GetSetsDto): Promise<unknown> {
    const url = new URL(`${JUSTTCG_BASE_URL}/sets`);
    url.searchParams.set('game', dto.game);
    if (dto.q) url.searchParams.set('q', dto.q);
    if (dto.orderBy) url.searchParams.set('orderBy', dto.orderBy);
    if (dto.order) url.searchParams.set('order', dto.order);
    return this.request(url.toString());
  }

  // ── Cards (single / search) ────────────────────────────────────
  async getCards(dto: GetCardsDto): Promise<unknown> {
    const url = new URL(`${JUSTTCG_BASE_URL}/cards`);

    const stringParams: (keyof GetCardsDto)[] = [
      'tcgplayerId',
      'mtgjsonId',
      'scryfallId',
      'tcgplayerSkuId',
      'cardId',
      'variantId',
      'q',
      'game',
      'set',
      'printing',
      'condition',
      'priceHistoryDuration',
      'include_statistics',
      'updated_after',
    ];

    for (const key of stringParams) {
      const value = dto[key];
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }

    if (dto.include_price_history !== undefined) {
      url.searchParams.set(
        'include_price_history',
        dto.include_price_history.toString(),
      );
    }
    if (dto.include_null_prices !== undefined) {
      url.searchParams.set(
        'include_null_prices',
        dto.include_null_prices.toString(),
      );
    }
    if (dto.limit !== undefined) {
      url.searchParams.set('limit', dto.limit.toString());
    }
    if (dto.offset !== undefined) {
      url.searchParams.set('offset', dto.offset.toString());
    }

    return this.request(url.toString());
  }

  // ── Cards (batch) ──────────────────────────────────────────────
  async batchCards(items: BatchCardsItemDto[]): Promise<unknown> {
    return this.request(`${JUSTTCG_BASE_URL}/cards`, {
      method: 'POST',
      body: JSON.stringify(items),
    });
  }
}
