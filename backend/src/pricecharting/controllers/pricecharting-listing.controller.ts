import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CATALOG_COVER_MAX_BYTES } from '../../marketplace/collections/catalog-cover-s3.service';
import type { User } from '../../user/entities/user.entity';
import { PricechartingCatalogSearch } from '../pricecharting-catalog-search';
import { PricechartingListingService } from '../pricecharting-listing.service';

class CreatePricechartingListingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  pricechartingProductId!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  clientRequestId!: string;
}

class SubmitPricechartingListingDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  askPriceCents!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  sealedStatus!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  conditionNote?: string;
}

@ApiTags('pricecharting')
@Controller('pricecharting')
export class PricechartingListingController {
  constructor(
    private readonly search: PricechartingCatalogSearch,
    private readonly listings: PricechartingListingService,
  ) {}

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
      'Same token match as catalog/product q. Ordered by product id, not by PriceCharting relevance. Does not call PriceCharting.',
  })
  searchProducts(@Query('q') q?: string) {
    return this.search.search(q ?? '');
  }

  @Get('catalog/upc')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Local catalog UPC lookup',
    description: 'Exact string match on upc, including leading zeros. At most 20 rows.',
  })
  searchUpc(@Query('upc') upc?: string) {
    return this.search.findByUpc(upc ?? '');
  }

  @Get('listings')
  @ApiOperation({ summary: 'Submitted catalog listings' })
  listSubmitted() {
    return this.listings.listSubmitted();
  }

  @Get('listings/mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Catalog listings for the signed-in seller' })
  listMine(@Req() req: Request & { user: User }) {
    return this.listings.listMine(req.user.id);
  }

  @Get('listings/:id')
  @ApiOperation({ summary: 'One submitted catalog listing' })
  getSubmitted(@Param('id', ParseUUIDPipe) id: string) {
    return this.listings.getSubmitted(id);
  }

  @Post('listings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Start a catalog listing draft',
    description: 'The same seller and clientRequestId returns the existing draft.',
  })
  create(@Req() req: Request & { user: User }, @Body() body: CreatePricechartingListingDto) {
    return this.listings.createDraft({
      sellerUserId: req.user.id,
      pricechartingProductId: body.pricechartingProductId,
      clientRequestId: body.clientRequestId,
    });
  }

  @Post('listings/:id/photos')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary: 'Upload a photo of the physical item',
    description:
      'Stores under covers/pricecharting-listings/{listingId}/{photoId}. Does not write a collection cover or slab key.',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: CATALOG_COVER_MAX_BYTES },
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        cb(null, allowed.includes(file.mimetype));
      },
    }),
  )
  addPhoto(
    @Req() req: Request & { user: User },
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Image file is required');
    return this.listings.addPhoto(req.user.id, id, file);
  }

  @Post('listings/:id/submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Submit a catalog listing' })
  submit(
    @Req() req: Request & { user: User },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SubmitPricechartingListingDto,
  ) {
    return this.listings.submit(req.user.id, id, body);
  }

  @Post('listings/:id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cancel a catalog listing' })
  cancel(@Req() req: Request & { user: User }, @Param('id', ParseUUIDPipe) id: string) {
    return this.listings.cancel(req.user.id, id);
  }
}
