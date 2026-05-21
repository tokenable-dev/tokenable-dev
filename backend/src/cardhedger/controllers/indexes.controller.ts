import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CardhedgerIndexesService } from '../indexes.service';

@ApiTags('Card Hedge · Market Data')
@Controller('cardhedger')
export class CardhedgerIndexesController {
  constructor(private readonly indexes: CardhedgerIndexesService) {}

  @Get('indexes')
  @ApiOperation({
    summary:
      'Dashboard market indexes (Pokemon/MLB/NFL/NBA) aggregated from Cardhedger categories',
  })
  getIndexes(@Query('refresh') refresh?: string) {
    const forceRefresh =
      refresh === '1' ||
      refresh === 'true' ||
      refresh === 'force' ||
      refresh === 'yes';
    return this.indexes.getDashboardIndexes({ forceRefresh });
  }
}
