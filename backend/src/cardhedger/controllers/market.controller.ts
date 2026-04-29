import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CardhedgerService } from '../cardhedger.service';

@ApiTags('Card Hedge · Market Data')
@Controller('cardhedger/v1/cards')
export class CardhedgerMarketController {
  constructor(private readonly cardhedger: CardhedgerService) {}

  @Get('top-movers')
  @ApiOperation({
    summary: 'Get Top Movers',
    description:
      'Upstream: `GET /v1/cards/top-movers`. Cards with strong recent price movement.',
  })
  @ApiQuery({
    name: 'count',
    required: false,
    type: Number,
    description: 'Number of cards (1–100)',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    type: String,
    description: "e.g. Baseball, Basketball, Pokemon",
  })
  async topMovers(
    @Query('count') count?: string,
    @Query('category') category?: string,
  ): Promise<unknown> {
    this.cardhedger.assertConfigured();
    const query: Record<string, string | undefined> = {};
    if (count !== undefined && count !== '') query.count = count;
    if (category !== undefined && category !== '') query.category = category;
    return this.cardhedger.forwardJson('GET', '/v1/cards/top-movers', {
      query,
    });
  }

  @Post('90day-prices-by-grade')
  @ApiOperation({
    summary: 'Get 90-Day Prices By Grade',
    description: 'Upstream: `POST /v1/cards/90day-prices-by-grade`.',
  })
  @ApiBody({ description: 'Request JSON', schema: { type: 'object' } })
  async prices90dByGrade(@Body() body: Record<string, unknown>): Promise<unknown> {
    this.cardhedger.assertConfigured();
    return this.cardhedger.forwardJson('POST', '/v1/cards/90day-prices-by-grade', {
      body,
    });
  }

  @Post('90day-prices-by-grade-search')
  @ApiOperation({
    summary: 'Search Cards with 90-Day Prices By Grade',
    description: 'Upstream: `POST /v1/cards/90day-prices-by-grade-search`.',
  })
  @ApiBody({ description: 'Request JSON', schema: { type: 'object' } })
  async prices90dByGradeSearch(
    @Body() body: Record<string, unknown>,
  ): Promise<unknown> {
    this.cardhedger.assertConfigured();
    return this.cardhedger.forwardJson(
      'POST',
      '/v1/cards/90day-prices-by-grade-search',
      { body },
    );
  }

  @Post('additions-summary')
  @ApiOperation({
    summary: 'Get Additions Summary',
    description: 'Upstream: `POST /v1/cards/additions-summary`.',
  })
  @ApiBody({ description: 'Request JSON', schema: { type: 'object' } })
  async additionsSummary(@Body() body: Record<string, unknown>): Promise<unknown> {
    this.cardhedger.assertConfigured();
    return this.cardhedger.forwardJson('POST', '/v1/cards/additions-summary', {
      body,
    });
  }

  @Post('price-updates')
  @ApiOperation({
    summary: 'Get Price Updates (Delta Poll)',
    description: 'Upstream: `POST /v1/cards/price-updates`.',
  })
  @ApiBody({ description: 'Request JSON', schema: { type: 'object' } })
  async priceUpdates(@Body() body: Record<string, unknown>): Promise<unknown> {
    this.cardhedger.assertConfigured();
    return this.cardhedger.forwardJson('POST', '/v1/cards/price-updates', {
      body,
    });
  }

  @Post('subscribe-price-updates')
  @ApiOperation({
    summary: 'Subscribe to Price Updates',
    description: 'Upstream: `POST /v1/cards/subscribe-price-updates`.',
  })
  @ApiBody({ description: 'Request JSON', schema: { type: 'object' } })
  async subscribePriceUpdates(
    @Body() body: Record<string, unknown>,
  ): Promise<unknown> {
    this.cardhedger.assertConfigured();
    return this.cardhedger.forwardJson(
      'POST',
      '/v1/cards/subscribe-price-updates',
      { body },
    );
  }

  @Post('sales-stats-by-player')
  @ApiOperation({
    summary: 'Get Bucketed Sales Stats by Player',
    description: 'Upstream: `POST /v1/cards/sales-stats-by-player`.',
  })
  @ApiBody({ description: 'Request JSON', schema: { type: 'object' } })
  async salesStatsByPlayer(
    @Body() body: Record<string, unknown>,
  ): Promise<unknown> {
    this.cardhedger.assertConfigured();
    return this.cardhedger.forwardJson(
      'POST',
      '/v1/cards/sales-stats-by-player',
      { body },
    );
  }

  @Post('total-sales-by-player')
  @ApiOperation({
    summary: 'Get Total Sales Count by Player',
    description: 'Upstream: `POST /v1/cards/total-sales-by-player`.',
  })
  @ApiBody({ description: 'Request JSON', schema: { type: 'object' } })
  async totalSalesByPlayer(
    @Body() body: Record<string, unknown>,
  ): Promise<unknown> {
    this.cardhedger.assertConfigured();
    return this.cardhedger.forwardJson(
      'POST',
      '/v1/cards/total-sales-by-player',
      { body },
    );
  }
}
