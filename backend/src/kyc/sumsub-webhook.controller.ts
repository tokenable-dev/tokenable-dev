import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { SumsubWebhookService } from './sumsub-webhook.service';

@ApiTags('webhooks')
@Controller('webhooks/sumsub')
export class SumsubWebhookController {
  constructor(private readonly webhook: SumsubWebhookService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Sumsub applicant status webhook',
    description:
      'Public endpoint verified via `X-Payload-Digest` HMAC. Configure in Sumsub Dashboard.',
  })
  async handle(@Req() req: RawBodyRequest<Request>, @Body() body: unknown) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new UnauthorizedException('Raw body required for webhook verification');
    }
    const digest = String(req.headers['x-payload-digest'] ?? '');
    this.webhook.assertDigest(rawBody, digest);
    return this.webhook.handlePayload(body);
  }
}
