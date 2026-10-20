import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketplaceAdminModule } from '../marketplace/admin/marketplace-admin.module';
import { PricechartingImportController } from './controllers/pricecharting-import.controller';
import { PricechartingProxyController } from './controllers/pricecharting-proxy.controller';
import { PricechartingCatalogSource } from './entities/pricecharting-catalog-source.entity';
import { PricechartingImportRun } from './entities/pricecharting-import-run.entity';
import { PricechartingPriceHistory } from './entities/pricecharting-price-history.entity';
import { PricechartingProduct } from './entities/pricecharting-product.entity';
import { PricechartingArchive } from './pricecharting-archive';
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
    ]),
    MarketplaceAdminModule,
  ],
  controllers: [PricechartingProxyController, PricechartingImportController],
  providers: [
    PricechartingService,
    PricechartingArchive,
    PricechartingImportService,
    PricechartingSyncService,
  ],
  exports: [PricechartingService],
})
export class PricechartingModule {}
