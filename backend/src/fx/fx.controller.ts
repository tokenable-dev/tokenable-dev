import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogNamesDto } from './catalog-names.dto';
import { CatalogNameTranslationService } from './catalog-name-translation.service';
import { FxService } from './fx.service';

@ApiTags('fx')
@Controller('fx')
export class FxController {
  constructor(
    private readonly fx: FxService,
    private readonly catalogNameTranslation: CatalogNameTranslationService,
  ) {}

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

  @Post('catalog-names')
  @ApiOperation({
    summary: 'Display translations for catalog phrases',
    description:
      'Public. Translates card-name leftovers, set names, and variants for ja, zh-CN, and zh-TW. ' +
      'Results stay in process memory. Stored catalog rows and collection_key are not changed.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        translations: { 'Monkey D. Luffy': 'モンキー・D・ルフィ' },
      },
    },
  })
  async catalogNames(@Body() dto: CatalogNamesDto) {
    return {
      translations: await this.catalogNameTranslation.translate(dto.locale, dto.texts),
    };
  }
}
