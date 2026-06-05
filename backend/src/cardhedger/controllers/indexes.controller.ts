import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CardhedgerIndexesService } from '../indexes.service';

/**
 * Cardhedger 시장 지수 — 대시보드용 카테고리 집계.
 */
@ApiTags('Card Hedge · Market Data')
@Controller('cardhedger')
export class CardhedgerIndexesController {
  constructor(private readonly indexes: CardhedgerIndexesService) {}

  /** Pokemon/MLB/NFL/NBA 등 대시보드 지수 */
  @ApiQuery({ name: 'refresh', required: false, example: 'false', description: '1/true 시 캐시 무시' })
  @Get('indexes')
  @ApiOperation({ summary: '시장 지수 (대시보드)' })
  getIndexes(@Query('refresh') refresh?: string) {
    const forceRefresh =
      refresh === '1' ||
      refresh === 'true' ||
      refresh === 'force' ||
      refresh === 'yes';
    return this.indexes.getDashboardIndexes({ forceRefresh });
  }
}
