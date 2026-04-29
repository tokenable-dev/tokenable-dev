import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CARDHEDGER_ENDPOINT_PRIORITY_NOTES,
  CARDHEDGER_OPERATIONS,
  CARDHEDGER_UPSTREAM_DEFAULT,
} from '../cardhedger.registry';

@ApiTags('cardhedger')
@Controller('cardhedger')
export class CardhedgerCatalogController {
  @ApiOperation({
    summary:
      'Card Hedge API catalog — full operation list; each route is also exposed in Swagger under its tag (server injects `X-API-Key`).',
  })
  @Get('catalog')
  catalog() {
    return {
      upstream: CARDHEDGER_UPSTREAM_DEFAULT,
      apiPrefix: '/api/cardhedger',
      usage:
        'Use Swagger groups **Card Hedge · …** or this catalog. All calls use server-side `CARDHEDGER_API_KEY`.',
      priorityNotes: [...CARDHEDGER_ENDPOINT_PRIORITY_NOTES],
      operations: CARDHEDGER_OPERATIONS,
      openapiUrl: 'https://api.cardhedger.com/openapi.json',
      docsUrl: 'https://api.cardhedger.com/docs',
    };
  }
}
