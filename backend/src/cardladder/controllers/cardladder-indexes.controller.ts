import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CardladderIndexesService } from '../cardladder-indexes.service';

@ApiTags('cardladder')
@Controller('cardladder')
export class CardladderIndexesController {
  constructor(private readonly indexes: CardladderIndexesService) {}

  @Get('indexes')
  @ApiOperation({
    summary: '대시보드 시장 지수 (Pokemon / MLB / NFL / NBA)',
    description:
      'Card Ladder 공개 지수 페이지를 서버에서 스크래핑합니다(캐시). `refresh=1` 이면 캐시를 무시하고 새로 가져옵니다.',
  })
  @ApiQuery({
    name: 'refresh',
    required: false,
    example: 'false',
    description: '1 또는 true 이면 강제 새로고침',
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
