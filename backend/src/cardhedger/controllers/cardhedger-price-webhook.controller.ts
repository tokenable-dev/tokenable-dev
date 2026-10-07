import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CardhedgerPriceWebhookService } from '../cardhedger-price-webhook.service';

/**
 * Inbound Cardhedger price-update webhooks (public — verified via shared secret).
 * Configure Cardhedger to POST here when subscribe-price-updates fires.
 */
@ApiTags('webhooks')
@Controller('webhooks/cardhedger')
export class CardhedgerPriceWebhookController {
  constructor(private readonly webhook: CardhedgerPriceWebhookService) {}

  @Post('price-updates')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Cardhedger price-update webhook',
    description:
      'Receives push notifications for subscribed cards. ' +
      'Requires `X-Cardhedger-Webhook-Secret` or `Authorization: Bearer` matching CARDHEDGER_WEBHOOK_SECRET.',
  })
  async handlePriceUpdates(@Req() req: Request, @Body() body: unknown) {
    this.webhook.assertAuthorized(req.headers as Record<string, unknown>);
    return this.webhook.handlePayload(body);
  }
}
