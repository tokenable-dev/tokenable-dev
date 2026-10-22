import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MarketplaceAdminModule } from '../marketplace/admin/marketplace-admin.module';
import { CatalogCoverS3Service } from '../marketplace/collections/catalog-cover-s3.service';
import { PricechartingImportController } from './controllers/pricecharting-import.controller';
import { PricechartingListingController } from './controllers/pricecharting-listing.controller';
import { PricechartingProxyController } from './controllers/pricecharting-proxy.controller';
import { PricechartingCatalogSource } from './entities/pricecharting-catalog-source.entity';
import { PricechartingImportRun } from './entities/pricecharting-import-run.entity';
import { PricechartingListingPhoto } from './entities/pricecharting-listing-photo.entity';
import { PricechartingListing } from './entities/pricecharting-listing.entity';
import { PricechartingPriceHistory } from './entities/pricecharting-price-history.entity';
import { PricechartingProduct } from './entities/pricecharting-product.entity';
import { PricechartingArchive } from './pricecharting-archive';
import { PricechartingCatalogSearch } from './pricecharting-catalog-search';
import { PricechartingImportService } from './pricecharting-import.service';
import { PricechartingSyncService } from './pricecharting-sync.service';
import { PricechartingService } from './pricecharting.service';

/**
 * PriceCharting Prices proxy plus an independent CSV catalog.
 * Marketplace upstream is not exposed. Catalog is not the live market snapshot.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PricechartingProduct,
      PricechartingImportRun,
      PricechartingCatalogSource,
      PricechartingPriceHistory,
      PricechartingListing,
      PricechartingListingPhoto,
    ]),
    MarketplaceAdminModule,
    AuthModule,
  ],
  controllers: [
    PricechartingProxyController,
    PricechartingImportController,
    PricechartingListingController,
  ],
  providers: [
    PricechartingService,
    PricechartingArchive,
    PricechartingImportService,
    PricechartingSyncService,
    PricechartingCatalogSearch,
    CatalogCoverS3Service,
  ],
  exports: [PricechartingService],
})
export class PricechartingModule {}
