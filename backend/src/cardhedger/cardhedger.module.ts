import { Module } from '@nestjs/common';
import { CardhedgerCatalogController } from './cardhedger-catalog.controller';
import { CardhedgerDetailsController } from './cardhedger-details.controller';
import { CardhedgerDownloadController } from './cardhedger-download.controller';
import { CardhedgerImageController } from './cardhedger-image.controller';
import { CardhedgerIndexesController } from './cardhedger-indexes.controller';
import { CardhedgerIndexesService } from './cardhedger-indexes.service';
import { CardhedgerIssuesController } from './cardhedger-issues.controller';
import { CardhedgerMarketController } from './cardhedger-market.controller';
import { CardhedgerPricingController } from './cardhedger-pricing.controller';
import { CardhedgerSearchController } from './cardhedger-search.controller';
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
