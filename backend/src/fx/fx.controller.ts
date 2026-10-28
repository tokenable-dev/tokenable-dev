import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FxService } from './fx.service';

@ApiTags('fx')
@Controller('fx')
export class FxController {
  constructor(private readonly fx: FxService) {}

  @Get('rates')
  @ApiOperation({
    summary: 'Latest ECB display rates',
    description:
      'Public. USD reference rates for display only. Does not affect USDC settlement. ' +
      '`rates` are foreign units per 1 USD. A missing table returns USD = 1 and stale.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        base: 'USD',
        source: 'frankfurter-ecb',
        observationDate: '2026-10-26',
        fetchedAt: '2026-10-27T15:30:00.000Z',
        stale: false,
        rates: { USD: 1, EUR: 0.89381, KRW: 1325.28 },
      },
    },
  })
  rates() {
    return this.fx.getCached();
  }
}
