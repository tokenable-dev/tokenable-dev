import { Module } from '@nestjs/common';
import { CardhedgerCatalogController } from './controllers/catalog.controller';
import { CardhedgerDetailsController } from './controllers/details.controller';
import { CardhedgerDownloadController } from './controllers/download.controller';
import { CardhedgerImageController } from './controllers/image.controller';
import { CardhedgerIndexesController } from './controllers/indexes.controller';
import { CardhedgerIssuesController } from './controllers/issues.controller';
import { CardhedgerMarketController } from './controllers/market.controller';
import { CardhedgerPricingController } from './controllers/pricing.controller';
import { CardhedgerSearchController } from './controllers/search.controller';
import { CardhedgerIndexesService } from './indexes.service';
import { CardhedgerService } from './cardhedger.service';

@Module({
  controllers: [
    CardhedgerCatalogController,
    CardhedgerIndexesController,
    CardhedgerMarketController,
    CardhedgerSearchController,
    CardhedgerDetailsController,
    CardhedgerPricingController,
    CardhedgerImageController,
    CardhedgerIssuesController,
    CardhedgerDownloadController,
  ],
  providers: [CardhedgerService, CardhedgerIndexesService],
  exports: [CardhedgerService, CardhedgerIndexesService],
})
export class CardhedgerModule {}
