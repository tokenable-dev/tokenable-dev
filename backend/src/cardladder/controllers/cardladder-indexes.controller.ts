import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CardladderIndexesService } from '../cardladder-indexes.service';

@ApiTags('Card Ladder')
@Controller('cardladder')
export class CardladderIndexesController {
  constructor(private readonly indexes: CardladderIndexesService) {}

  @Get('indexes')
  @ApiOperation({
    summary: 'Dashboard market indexes (Pokemon / MLB / NFL / NBA)',
    description:
      'Scrapes Card Ladder public indexes page server-side (cached). Pass `refresh=1` to bypass TTL.',
  })
  @ApiQuery({
    name: 'refresh',
    required: false,
    example: 'false',
    description: '1/true forces a fresh scrape',
  })
  async getIndexes(@Query('refresh') refresh?: string) {
    const forceRefresh =
      refresh === '1' ||
      refresh === 'true' ||
      refresh === 'force' ||
      refresh === 'yes';
    return this.indexes.getDashboardIndexes({ forceRefresh });
  }
}
