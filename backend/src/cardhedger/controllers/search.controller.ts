import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CardhedgerService } from '../cardhedger.service';

@ApiTags('Card Hedge · Card Search')
@Controller('cardhedger/v1/cards')
export class CardhedgerSearchController {
  constructor(private readonly cardhedger: CardhedgerService) {}

  @Post('card-search')
  @ApiOperation({
    summary: 'Search Cards',
    description: 'Upstream: `POST /v1/cards/card-search`.',
  })
  @ApiBody({ description: 'Request JSON', schema: { type: 'object' } })
  async cardSearch(@Body() body: Record<string, unknown>): Promise<unknown> {
    this.cardhedger.assertConfigured();
    return this.cardhedger.forwardJson('POST', '/v1/cards/card-search', {
      body,
    });
  }

  @Post('card-match')
  @ApiOperation({
    summary: 'AI-powered card matching',
    description: 'Upstream: `POST /v1/cards/card-match`.',
  })
  @ApiBody({ description: 'Request JSON', schema: { type: 'object' } })
  async cardMatch(@Body() body: Record<string, unknown>): Promise<unknown> {
    this.cardhedger.assertConfigured();
    return this.cardhedger.forwardJson('POST', '/v1/cards/card-match', {
      body,
    });
  }

  @Post('set-search')
  @ApiOperation({
    summary: 'Search Card Sets',
    description: 'Upstream: `POST /v1/cards/set-search`.',
  })
  @ApiBody({ description: 'Request JSON', schema: { type: 'object' } })
  async setSearch(@Body() body: Record<string, unknown>): Promise<unknown> {
    this.cardhedger.assertConfigured();
    return this.cardhedger.forwardJson('POST', '/v1/cards/set-search', {
      body,
    });
  }

  @Post('search-cards-wsort')
  @ApiOperation({
    summary: 'Search Cards with Sorting',
    description: 'Upstream: `POST /v1/cards/search-cards-wsort`.',
  })
  @ApiBody({ description: 'Request JSON', schema: { type: 'object' } })
  async searchCardsWsort(
    @Body() body: Record<string, unknown>,
  ): Promise<unknown> {
    this.cardhedger.assertConfigured();
    return this.cardhedger.forwardJson('POST', '/v1/cards/search-cards-wsort', {
      body,
    });
  }
}
