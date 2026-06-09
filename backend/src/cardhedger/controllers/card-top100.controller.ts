import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CardTop100Service } from '../card-top100.service';

@ApiTags('cardhedger')
@Controller('cardhedger')
export class CardTop100Controller {
  constructor(private readonly service: CardTop100Service) {}

  /**
   * Returns the list of categories currently known to the service.
   * Populated by the daily discovery cron or the last force-refresh.
   */
  @Get('top100/categories')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Top 100 — available categories',
    description:
      'Returns all card categories discovered from CardHedger. ' +
      'Updated daily at 09:00 KST by the scheduled cron. ' +
      'Falls back to the hardcoded seed list (Pokemon, Baseball, Basketball, Football) until first discovery runs.',
  })
  getCategories() {
    return this.service.getCategories();
  }

  /**
   * Returns cached PSA 10 top-100 for the given category.
   * Category name is case-insensitive (e.g. "pokemon" or "Pokemon").
   */
  @Get('top100/:category')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Top 100 cards (PSA 10, by category)',
    description:
      'Cached 90-day average price top-100 for the requested category. ' +
      'Refreshed daily at 09:00 KST.',
  })
  @ApiParam({
    name: 'category',
    description: 'Category name (case-insensitive). See GET /cardhedger/top100/categories for available values.',
    example: 'Pokemon',
  })
  async getTop100(@Param('category') category: string) {
    // Normalise to title-case to match CardHedger's exact strings
    const normalised =
      category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
    return this.service.getTop100(normalised);
  }

  /** Admin: refresh a single category immediately. */
  @Post('top100/:category/refresh')
  @HttpCode(200)
  @ApiOperation({
    summary: '[Admin] Force-refresh a single category',
  })
  @ApiParam({ name: 'category', example: 'Pokemon' })
  async forceRefresh(@Param('category') category: string) {
    const normalised =
      category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
    return this.service.forceRefresh(normalised);
  }

  /** Admin: run category discovery + refresh all discovered categories. */
  @Post('top100/refresh-all')
  @HttpCode(200)
  @ApiOperation({
    summary: '[Admin] Discover categories & refresh all',
    description:
      'Calls CardHedger without a category filter to discover all active categories, ' +
      'then refreshes top-100 for each one sequentially.',
  })
  async forceRefreshAll() {
    return this.service.forceRefreshAll();
  }

  /** Admin: run only the category discovery step (no data refresh). */
  @Post('top100/discover-categories')
  @HttpCode(200)
  @ApiOperation({
    summary: '[Admin] Discover categories only',
    description:
      'Calls CardHedger without a category filter to discover all active categories. ' +
      'Does not refresh card data.',
  })
  async discoverCategories() {
    const categories = await this.service.discoverCategoriesLive();
    return { categories };
  }

  /**
   * Historical daily snapshots for a category (newest first).
   * Useful for future price-trend charts.
   */
  @Get('top100/:category/history')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Top 100 — daily history for a category',
    description: 'Returns historical daily snapshots, newest first. Up to 365 rows.',
  })
  @ApiParam({ name: 'category', example: 'Pokemon' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max rows (default 90, max 365)', example: 90 })
  async getHistory(
    @Param('category') category: string,
    @Query('limit') limit?: string,
  ) {
    const normalised =
      category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
    const limitNum = Math.min(365, Math.max(1, parseInt(limit ?? '90', 10) || 90));
    return this.service.getHistory(normalised, limitNum);
  }
}
