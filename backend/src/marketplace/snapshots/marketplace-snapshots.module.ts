import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollectionMarketSnapshot } from '../entities/collection-market-snapshot.entity';
import { Order } from '../entities/order.entity';
import { RwaToken } from '../entities/rwa-token.entity';
import { MarketplaceCollectionsModule } from '../collections/marketplace-collections.module';
import { MarketplaceMarketDataModule } from '../market-data/marketplace-market-data.module';
import { CollectionMarketSnapshotReadService } from './collection-market-snapshot-read.service';
import { CollectionMarketSnapshotSchedulerService } from './collection-market-snapshot-scheduler.service';
import { CollectionMarketSnapshotService } from './collection-market-snapshot.service';

/** Materialized Cardhedger snapshot rows (write, read, cron queue). */
@Module({
  imports: [
    TypeOrmModule.forFeature([CollectionMarketSnapshot, Order, RwaToken]),
    MarketplaceMarketDataModule,
    forwardRef(() => MarketplaceCollectionsModule), // CollectionService for refresh enrichment
  ],
  providers: [
    CollectionMarketSnapshotService,
    CollectionMarketSnapshotReadService,
    CollectionMarketSnapshotSchedulerService,
  ],
  exports: [
    CollectionMarketSnapshotService,
    CollectionMarketSnapshotReadService,
    CollectionMarketSnapshotSchedulerService,
  ],
})
export class MarketplaceSnapshotsModule {}
