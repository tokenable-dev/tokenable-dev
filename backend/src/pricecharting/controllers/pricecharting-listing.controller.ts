import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PricechartingCatalogSearch } from '../pricecharting-catalog-search';

@ApiTags('pricecharting')
@Controller('pricecharting')
export class PricechartingListingController {
  constructor(private readonly search: PricechartingCatalogSearch) {}

  @Get('catalog/product')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Local catalog match for one PriceCharting product',
    description:
      'Reads pricecharting_products. Exactly one of id, upc, or q. Does not call PriceCharting. Several q or upc matches are ambiguous and do not pick a winner.',
  })
  matchProduct(
    @Query('id') id?: string,
    @Query('upc') upc?: string,
    @Query('q') q?: string,
  ) {
    return this.search.matchOne({ id, upc, q });
  }

  @Get('catalog/products')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Local catalog text search, at most 20 products',
    description:
      'Partner box mint. Whole-word match, sealed boxes only (including bundles and premium collections that do not say box). Graded and raw cards are excluded. At most 20, ordered by product id. Does not call PriceCharting.',
  })
  searchProducts(@Query('q') q?: string) {
    return this.search.search(q ?? '', 'id', true);
  }

  @Get('catalog/upc')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Local catalog UPC lookup',
    description:
      'Partner box mint. Exact upc match, including leading zeros, sealed boxes only. At most 20 rows.',
  })
  searchUpc(@Query('upc') upc?: string) {
    return this.search.findByUpc(upc ?? '', true);
  }
}
