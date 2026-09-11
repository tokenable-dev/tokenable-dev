import { Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CardTopMoversService } from '../card-top-movers.service';

@ApiTags('cardhedger')
@Controller('cardhedger')
export class CardTopMoversController {
  constructor(private readonly service: CardTopMoversService) {}

  /**
   * Weekly top gainers — server-side 1h cache (matches Cardhedger upstream TTL).
   */
  @Get('top-movers')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Top movers (weekly price gain)',
    description:
      'Cards with positive weekly price changes from CardHedger. ' +
      'Cached in-memory for 1 hour per category + count.',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Category filter (e.g. Pokemon, Baseball). Omit for all categories.',
    example: 'Pokemon',
  })
  @ApiQuery({
    name: 'count',
    required: false,
    description: 'Number of cards (1–100, default 20).',
    example: 20,
  })
  async getTopMovers(
    @Query('category') category?: string,
    @Query('count') count?: string,
  ) {
    const countNum = count != null ? parseInt(count, 10) : undefined;
    return this.service.getTopMovers({
      ...(category?.trim() ? { category: category.trim() } : {}),
      ...(Number.isFinite(countNum) ? { count: countNum } : {}),
    });
  }

  /** Admin: clear in-memory cache (next request refetches upstream). */
  @Post('top-movers/refresh')
  @HttpCode(200)
  @ApiOperation({ summary: '[Admin] Clear top-movers cache' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'count', required: false })
  refreshCache(
    @Query('category') category?: string,
    @Query('count') count?: string,
  ) {
    const countNum = count != null ? parseInt(count, 10) : undefined;
    if (category?.trim() || Number.isFinite(countNum)) {
      this.service.clearCache(category?.trim(), countNum);
    } else {
      this.service.clearCache();
    }
    return { ok: true };
  }
}
