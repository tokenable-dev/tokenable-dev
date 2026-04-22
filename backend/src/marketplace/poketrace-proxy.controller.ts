import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  POKETRACE_UPSTREAM_BASE,
  POKETRACE_UPSTREAM_OPERATIONS,
} from '../poketrace/poketrace-api.registry';
import { PoketraceService } from '../poketrace/poketrace.service';
import {
  isPoketraceHistoryPeriod,
  type PoketraceHistoryPeriod,
} from '../poketrace/poketrace-period.util';
import type {
  PoketraceListCardsQuery,
  PoketraceListingsQuery,
  PoketraceListSetsQuery,
  PoketracePriceHistoryQuery,
} from '../poketrace/poketrace-upstream.urls';

const TIER_RE = /^[A-Za-z0-9_]+$/;

@ApiTags('marketplace')
@Controller('marketplace/poketrace')
export class PoketraceProxyController {
  constructor(private readonly poketrace: PoketraceService) {}

  @ApiOperation({
    summary:
      'PokeTrace upstream catalog (OpenAPI v1.5): operation list + base URL for Pro integration.',
  })
  @Get('catalog')
  catalog() {
    return {
      upstreamBase: POKETRACE_UPSTREAM_BASE,
      operations: POKETRACE_UPSTREAM_OPERATIONS,
    };
  }

  @ApiOperation({ summary: 'Proxy: GET /v1/cards' })
  @Get('cards')
  async listCards(
    @Query('search') search?: string,
    @Query('set') set?: string,
    @Query('card_number') card_number?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limitRaw?: string,
    @Query('variant') variant?: string,
    @Query('rarity') rarity?: string,
    @Query('game') game?: 'pokemon' | 'pokemon-japanese',
    @Query('market') market?: 'US' | 'EU',
    @Query('tcgplayer_ids') tcgplayer_ids?: string,
    @Query('cardmarket_ids') cardmarket_ids?: string,
    @Query('has_graded') has_graded_raw?: string,
  ) {
    this.assertConfigured();
    const lim =
      limitRaw != null && String(limitRaw).trim() !== ''
        ? parseInt(String(limitRaw), 10)
        : 20;
    const limit = Number.isFinite(lim) ? lim : 20;
    let has_graded: boolean | undefined;
    if (
      has_graded_raw === '1' ||
      has_graded_raw === 'true' ||
      has_graded_raw === 'yes'
    ) {
      has_graded = true;
    } else if (
      has_graded_raw === '0' ||
      has_graded_raw === 'false' ||
      has_graded_raw === 'no'
    ) {
      has_graded = false;
    }
    const q: PoketraceListCardsQuery = {
      search,
      set,
      card_number,
      cursor,
      limit,
      variant,
      rarity,
      game,
      market,
      tcgplayer_ids,
      cardmarket_ids,
      has_graded,
    };
    return this.poketrace.upstreamListCards(q);
  }

  @ApiOperation({ summary: 'Proxy: GET /v1/cards/{id}' })
  @ApiParam({ name: 'cardId', description: 'PokeTrace catalog UUID' })
  @Get('cards/:cardId')
  async getCard(@Param('cardId') cardId: string) {
    this.assertConfigured();
    const id = decodeURIComponent(cardId).trim();
    if (!id) throw new BadRequestException('cardId required');
    return this.poketrace.getCardById(id);
  }

  @ApiOperation({ summary: 'Proxy: GET /v1/cards/{id}/prices/{tier}/history' })
  @ApiParam({ name: 'cardId' })
  @ApiParam({ name: 'tier', example: 'NEAR_MINT' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d', '1y', 'all'] })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'cursor', required: false })
  @Get('cards/:cardId/prices/:tier/history')
  async priceHistory(
    @Param('cardId') cardId: string,
    @Param('tier') tierRaw: string,
    @Query('period') periodRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    this.assertConfigured();
    const id = decodeURIComponent(cardId).trim();
    const tier = decodeURIComponent(tierRaw).trim();
    if (!id || !tier) throw new BadRequestException('cardId and tier required');
    if (!TIER_RE.test(tier)) throw new BadRequestException('Invalid tier');
    const period: PoketraceHistoryPeriod = isPoketraceHistoryPeriod(
      String(periodRaw ?? '30d'),
    )
      ? (periodRaw as PoketraceHistoryPeriod)
      : '30d';
    const lim =
      limitRaw != null && String(limitRaw).trim() !== ''
        ? parseInt(String(limitRaw), 10)
        : undefined;
    const q: PoketracePriceHistoryQuery = {
      period,
      limit: Number.isFinite(lim!) ? lim : undefined,
      cursor: cursor?.trim() || undefined,
    };
    return this.poketrace.upstreamPriceHistory(id, tier, q);
  }

  @ApiOperation({
    summary: 'Proxy: GET /v1/cards/{id}/listings (Scale plan upstream — 403 on lower tiers)',
  })
  @ApiParam({ name: 'cardId' })
  @Get('cards/:cardId/listings')
  async listings(
    @Param('cardId') cardId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limitRaw?: string,
    @Query('grader') grader?: 'PSA' | 'BGS' | 'CGC' | 'SGC',
    @Query('grade') grade?: string,
    @Query('min_price') min_price_raw?: string,
    @Query('max_price') max_price_raw?: string,
    @Query('sort') sort?: PoketraceListingsQuery['sort'],
  ) {
    this.assertConfigured();
    const id = decodeURIComponent(cardId).trim();
    if (!id) throw new BadRequestException('cardId required');
    const lim =
      limitRaw != null && String(limitRaw).trim() !== ''
        ? parseInt(String(limitRaw), 10)
        : undefined;
    const min_price =
      min_price_raw != null && String(min_price_raw).trim() !== ''
        ? parseFloat(String(min_price_raw))
        : undefined;
    const max_price =
      max_price_raw != null && String(max_price_raw).trim() !== ''
        ? parseFloat(String(max_price_raw))
        : undefined;
    const q: PoketraceListingsQuery = {
      cursor,
      limit: Number.isFinite(lim!) ? lim : undefined,
      grader,
      grade,
      min_price: Number.isFinite(min_price!) ? min_price : undefined,
      max_price: Number.isFinite(max_price!) ? max_price : undefined,
      sort,
    };
    return this.poketrace.upstreamSoldListings(id, q);
  }

  @ApiOperation({ summary: 'Proxy: GET /v1/sets' })
  @Get('sets')
  async listSets(
    @Query('search') search?: string,
    @Query('game') game?: 'pokemon' | 'pokemon-japanese',
    @Query('cursor') cursor?: string,
    @Query('limit') limitRaw?: string,
  ) {
    this.assertConfigured();
    const lim =
      limitRaw != null && String(limitRaw).trim() !== ''
        ? parseInt(String(limitRaw), 10)
        : undefined;
    const q: PoketraceListSetsQuery = {
      search,
      game,
      cursor,
      limit: Number.isFinite(lim!) ? lim : undefined,
    };
    return this.poketrace.upstreamListSets(q);
  }

  private assertConfigured(): void {
    if (!this.poketrace.isConfigured()) {
      throw new ServiceUnavailableException(
        'PokeTrace is not configured (POKETRACE_PUBLIC_API_TOKEN)',
      );
    }
  }
}
