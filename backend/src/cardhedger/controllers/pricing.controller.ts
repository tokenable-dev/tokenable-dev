import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CardhedgerService } from '../cardhedger.service';

@ApiTags('Card Hedge · Pricing & Valuations')
@Controller('cardhedger/v1/cards')
export class CardhedgerPricingController {
  constructor(private readonly cardhedger: CardhedgerService) {}

  @Post('price-estimate')
  @ApiOperation({
    summary: 'Get Price Estimate for a Card',
    description: 'Upstream: `POST /v1/cards/price-estimate`.',
  })
  @ApiBody({ description: 'Request JSON', schema: { type: 'object' } })
  async priceEstimate(@Body() body: Record<string, unknown>): Promise<unknown> {
    this.cardhedger.assertConfigured();
    return this.cardhedger.forwardJson('POST', '/v1/cards/price-estimate', {
      body,
    });
  }

  @Post('batch-price-estimate')
  @ApiOperation({
    summary: 'Get Batch Price Estimates',
    description: 'Upstream: `POST /v1/cards/batch-price-estimate`.',
  })
  @ApiBody({ description: 'Request JSON', schema: { type: 'object' } })
  async batchPriceEstimate(
    @Body() body: Record<string, unknown>,
  ): Promise<unknown> {
    this.cardhedger.assertConfigured();
    return this.cardhedger.forwardJson(
      'POST',
      '/v1/cards/batch-price-estimate',
      { body },
    );
  }

  @Post('prices-by-card')
  @ApiOperation({
    summary: 'Get Card Prices by Card ID',
    description: 'Upstream: `POST /v1/cards/prices-by-card`.',
  })
  @ApiBody({ description: 'Request JSON', schema: { type: 'object' } })
  async pricesByCard(@Body() body: Record<string, unknown>): Promise<unknown> {
    this.cardhedger.assertConfigured();
    return this.cardhedger.forwardJson('POST', '/v1/cards/prices-by-card', {
      body,
    });
  }

  @Post('prices-by-cert')
  @ApiOperation({
    summary: 'Get Card Prices by Certificate Number',
    description: 'Upstream: `POST /v1/cards/prices-by-cert`.',
  })
  @ApiBody({ description: 'Request JSON', schema: { type: 'object' } })
  async pricesByCert(@Body() body: Record<string, unknown>): Promise<unknown> {
    this.cardhedger.assertConfigured();
    return this.cardhedger.forwardJson('POST', '/v1/cards/prices-by-cert', {
      body,
    });
  }

  @Post('batch-prices-by-cert')
  @ApiOperation({
    summary: 'Get Best Price Estimates by Certificate Numbers (Batch)',
    description: 'Upstream: `POST /v1/cards/batch-prices-by-cert`.',
  })
  @ApiBody({ description: 'Request JSON', schema: { type: 'object' } })
  async batchPricesByCert(
    @Body() body: Record<string, unknown>,
  ): Promise<unknown> {
    this.cardhedger.assertConfigured();
    return this.cardhedger.forwardJson(
      'POST',
      '/v1/cards/batch-prices-by-cert',
      { body },
    );
  }

  @Post('details-by-certs')
  @ApiOperation({
    summary: 'Get Card Details by Certificate Numbers (Batch)',
    description: 'Upstream: `POST /v1/cards/details-by-certs`.',
  })
  @ApiBody({ description: 'Request JSON', schema: { type: 'object' } })
  async detailsByCerts(@Body() body: Record<string, unknown>): Promise<unknown> {
    this.cardhedger.assertConfigured();
    return this.cardhedger.forwardJson('POST', '/v1/cards/details-by-certs', {
      body,
    });
  }

  @Post('all-prices-by-card')
  @ApiOperation({
    summary: 'Get All Latest Prices By Card',
    description: 'Upstream: `POST /v1/cards/all-prices-by-card`.',
  })
  @ApiBody({ description: 'Request JSON', schema: { type: 'object' } })
  async allPricesByCard(@Body() body: Record<string, unknown>): Promise<unknown> {
    this.cardhedger.assertConfigured();
    return this.cardhedger.forwardJson('POST', '/v1/cards/all-prices-by-card', {
      body,
    });
  }

  @Post('comps')
  @ApiOperation({
    summary: 'Get Comparable Prices (COMPS)',
    description: 'Upstream: `POST /v1/cards/comps`.',
  })
  @ApiBody({ description: 'Request JSON', schema: { type: 'object' } })
  async comps(@Body() body: Record<string, unknown>): Promise<unknown> {
    this.cardhedger.assertConfigured();
    return this.cardhedger.forwardJson('POST', '/v1/cards/comps', {
      body,
    });
  }
}
