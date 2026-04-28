import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CardhedgerService } from './cardhedger.service';

@ApiTags('Card Hedge · Card Details')
@Controller('cardhedger/v1/cards')
export class CardhedgerDetailsController {
  constructor(private readonly cardhedger: CardhedgerService) {}

  @Post('card-details')
  @ApiOperation({
    summary: 'Get Card Details by ID',
    description: 'Upstream: `POST /v1/cards/card-details`.',
  })
  @ApiBody({ description: 'Request JSON', schema: { type: 'object' } })
  async cardDetails(@Body() body: Record<string, unknown>): Promise<unknown> {
    this.cardhedger.assertConfigured();
    return this.cardhedger.forwardJson('POST', '/v1/cards/card-details', {
      body,
    });
  }

  @Post('card-request')
  @ApiOperation({
    summary: 'Create Card Request',
    description:
      'Upstream: `POST /v1/cards/card-request`. May require commercial agreement upstream.',
  })
  @ApiBody({ description: 'Request JSON', schema: { type: 'object' } })
  async cardRequest(@Body() body: Record<string, unknown>): Promise<unknown> {
    this.cardhedger.assertConfigured();
    return this.cardhedger.forwardJson('POST', '/v1/cards/card-request', {
      body,
    });
  }
}
