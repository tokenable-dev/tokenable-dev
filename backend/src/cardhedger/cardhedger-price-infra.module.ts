import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketplaceAdminModule } from '../marketplace/admin/marketplace-admin.module';
import { MarketplaceCollection } from '../marketplace/entities/marketplace-collection.entity';
import { CollectionMarketSnapshot } from '../marketplace/entities/collection-market-snapshot.entity';
import { CardhedgerModule } from './cardhedger.module';
import { CardhedgerPriceSubscription } from './entities/cardhedger-price-subscription.entity';
import { CardhedgerPriceDeltaCheckpoint } from './entities/cardhedger-price-delta-checkpoint.entity';
import { CardhedgerDailyPriceExportRun } from './entities/cardhedger-daily-price-export-run.entity';
import { CardhedgerPriceDeltaImportRun } from './entities/cardhedger-price-delta-import-run.entity';
import { CardhedgerPriceSubscriptionService } from './cardhedger-price-subscription.service';
import { CardhedgerPriceWebhookService } from './cardhedger-price-webhook.service';
import { CardhedgerPriceDeltaImportService } from './cardhedger-price-delta-import.service';
import { CardhedgerPriceDeltaSchedulerService } from './cardhedger-price-delta-scheduler.service';
import { CardhedgerPriceWebhookController } from './controllers/cardhedger-price-webhook.controller';
import { CardhedgerPriceSubscriptionAdminController } from './controllers/cardhedger-price-subscription-admin.controller';

/**
 * Phase 8 — Cardhedger price push (webhook + subscribe) and nightly delta import.
 * CSV daily-price-export is Elite/Enterprise only; delta polling is the default 8B path.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CardhedgerPriceSubscription,
      CardhedgerPriceDeltaCheckpoint,
      CardhedgerDailyPriceExportRun,
      CardhedgerPriceDeltaImportRun,
      MarketplaceCollection,
      CollectionMarketSnapshot,
    ]),
    MarketplaceAdminModule,
    CardhedgerModule,
  ],
  controllers: [
    CardhedgerPriceWebhookController,
    CardhedgerPriceSubscriptionAdminController,
  ],
  providers: [
    CardhedgerPriceSubscriptionService,
    CardhedgerPriceWebhookService,
    CardhedgerPriceDeltaImportService,
    CardhedgerPriceDeltaSchedulerService,
  ],
  exports: [CardhedgerPriceSubscriptionService],
})
export class CardhedgerPriceInfraModule {}
