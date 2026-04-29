import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CardhedgerService } from '../cardhedger.service';

@ApiTags('Card Hedge · Image Search')
@Controller('cardhedger/v1/cards')
export class CardhedgerImageController {
  constructor(private readonly cardhedger: CardhedgerService) {}

  @Post('image-search')
  @ApiOperation({
    summary: 'Search cards by image',
    description:
      'Upstream: `POST /v1/cards/image-search`. Body is typically JSON (`image_url` or `image_base64`).',
  })
  @ApiBody({ description: 'Request JSON', schema: { type: 'object' } })
  async imageSearch(@Body() body: Record<string, unknown>): Promise<unknown> {
    this.cardhedger.assertConfigured();
    return this.cardhedger.forwardJson('POST', '/v1/cards/image-search', {
      body,
    });
  }

  @Post('details-by-cert-ocr')
  @ApiOperation({
    summary: 'Get Card Details by Graded Card Image',
    description: 'Upstream: `POST /v1/cards/details-by-cert-ocr`.',
  })
  @ApiBody({ description: 'Request JSON', schema: { type: 'object' } })
  async detailsByCertOcr(
    @Body() body: Record<string, unknown>,
  ): Promise<unknown> {
    this.cardhedger.assertConfigured();
    return this.cardhedger.forwardJson(
      'POST',
      '/v1/cards/details-by-cert-ocr',
      { body },
    );
  }

  @Post('prices-by-cert-ocr')
  @ApiOperation({
    summary: 'Get Card Prices by Graded Card Image',
    description: 'Upstream: `POST /v1/cards/prices-by-cert-ocr`.',
  })
  @ApiBody({ description: 'Request JSON', schema: { type: 'object' } })
  async pricesByCertOcr(
    @Body() body: Record<string, unknown>,
  ): Promise<unknown> {
    this.cardhedger.assertConfigured();
    return this.cardhedger.forwardJson(
      'POST',
      '/v1/cards/prices-by-cert-ocr',
      { body },
    );
  }
}
