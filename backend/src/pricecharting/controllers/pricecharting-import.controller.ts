import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsObject, IsString, Matches, MaxLength, MinLength, IsIn } from 'class-validator';
import type { Request } from 'express';
import { MarketplaceAdminService } from '../../marketplace/admin/marketplace-admin.service';
import { PricechartingCatalogSearch } from '../pricecharting-catalog-search';
import { PricechartingImportService } from '../pricecharting-import.service';
import {
  PRICECHARTING_GUIDE_KEYS,
  PricechartingSyncService,
} from '../pricecharting-sync.service';

class SyncPricechartingGuideDto {
  @IsString()
  @IsIn(PRICECHARTING_GUIDE_KEYS)
  key!: string;
}

class RecordManualPriceHistoryDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  observedOn!: string;

  /** Dollar amounts keyed by `pricecharting_products` cent columns. Blank keys are omitted. */
  @IsObject()
  prices!: Record<string, unknown>;
}

class CreatePricechartingSourceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  label!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(2000)
  url!: string;
}

const MAX_BYTES = 50 * 1024 * 1024;

@ApiTags('marketplace-admin')
@Controller('marketplace/admin/pricecharting')
export class PricechartingImportController {
  constructor(
    private readonly admin: MarketplaceAdminService,
    private readonly imports: PricechartingImportService,
    private readonly sync: PricechartingSyncService,
    private readonly search: PricechartingCatalogSearch,
  ) {}

  @Get('products')
  @ApiOperation({
    summary: '[Admin] Find a catalog product by name or id',
    description:
      'Same local name search as the catalog, at most 20 rows, ordered by product name. A numeric query looks up that product id. Does not call PriceCharting.',
  })
  async searchProducts(@Req() req: Request, @Query('q') q?: string) {
    this.admin.assertAdminSession(req);
    const query = q?.trim() ?? '';
    if (/^\d+$/.test(query)) {
      const found = await this.search.matchOne({ id: query });
      return found.match ? [found.match] : [];
    }
    return this.search.search(query, 'name');
  }

  @Post('products/:id/prices')
  @ApiOperation({
    summary: '[Admin] Store one day of PriceCharting prices by hand',
    description:
      'Writes pricecharting_price_history only. Does not change the current catalog row and does not upload a CSV. Omitted price columns keep the value already stored for that date.',
  })
  recordHistory(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: RecordManualPriceHistoryDto,
  ) {
    this.admin.assertAdminSession(req);
    return this.imports.recordManualHistory(id, body.observedOn, body.prices);
  }

  @Get('products/:id/prices')
  @ApiOperation({
    summary: '[Admin] PriceCharting daily price series for one product',
    description:
      'All stored Seoul dates for this product id, oldest first. Prices are integer cents. One object, not one day per request.',
  })
  priceSeries(@Req() req: Request, @Param('id') id: string) {
    this.admin.assertAdminSession(req);
    return this.imports.priceSeries(id);
  }

  @Get('catalog')
  @ApiOperation({
    summary: '[Admin] PriceCharting catalog totals',
    description:
      'Independent catalog (not collection snapshots). Counts by genre, recent CSV uploads, and fixed guide buttons.',
  })
  async catalog(@Req() req: Request) {
    this.admin.assertAdminSession(req);
    const [summary, guides] = await Promise.all([
      this.imports.summary(),
      this.sync.guides(),
    ]);
    return { ...summary, guides };
  }

  @Post('sources')
  @ApiOperation({
    summary: '[Admin] Register a PriceCharting CSV URL',
    description:
      'https URL on pricecharting.com or sportscardspro.com. The server injects the API token when an admin runs sync.',
  })
  createSource(@Req() req: Request, @Body() body: CreatePricechartingSourceDto) {
    this.admin.assertAdminSession(req);
    return this.sync.create(body.label, body.url);
  }

  @Delete('sources/:id')
  @ApiOperation({ summary: '[Admin] Remove a PriceCharting CSV URL' })
  removeSource(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    this.admin.assertAdminSession(req);
    return this.sync.remove(id);
  }

  @Post('sync')
  @ApiOperation({
    summary: '[Admin] Download one PriceCharting guide and upsert it',
    description:
      'Fixed guides only (video games, pokemon, magic, yugioh, one piece). The server builds the download URL and injects the token. Changed prices are stored for that Seoul date.',
  })
  syncNow(@Req() req: Request, @Body() body: SyncPricechartingGuideDto) {
    this.admin.assertAdminSession(req);
    return this.sync.runOne(body.key);
  }

  @Post('import')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: '[Admin] Upsert a PriceCharting / SportsCardsPro CSV',
    description:
      'Pokemon, One Piece, or a single sports set. Same product id updates prices. Prices stored as integer cents. Max 50 MB.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_BYTES } }),
  )
  importCsv(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    this.admin.assertAdminSession(req);
    if (!file) {
      return this.imports.importFile({
        buffer: Buffer.alloc(0),
        originalname: '',
        size: 0,
      });
    }
    return this.imports.importFile(
      {
        buffer: file.buffer,
        originalname: file.originalname,
        size: file.size,
      },
      { sportsArchive: true },
    );
  }
}
