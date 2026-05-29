import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { CardhedgerModule } from '../cardhedger/cardhedger.module';
import { PsaModule } from '../psa/psa.module';
import { CardhedgerAiInsightService } from './collections/cardhedger-ai-insight.service';
import { CardhedgerMarketDataService } from './collections/cardhedger-market-data.service';
import { CertMarketTraceController } from './collections/cert-market-trace.controller';
import { CertMarketTraceService } from './collections/cert-market-trace.service';
import { CollectionMarketSnapshotReadService } from './collections/collection-market-snapshot-read.service';
import { CollectionMarketSnapshotSchedulerService } from './collections/collection-market-snapshot-scheduler.service';
import { CollectionMarketSnapshotService } from './collections/collection-market-snapshot.service';
import { CollectionMarketService } from './collections/collection-market.service';
import { CollectionService } from './collections/collection.service';
import { PsaCertSnapshotService } from './collections/psa-cert-snapshot.service';
import { RwaTokenRegistryService } from './collections/rwa-token-registry.service';
import { CollectionsController } from './collections/collections.controller';
import { CollectionMarketSnapshot } from './entities/collection-market-snapshot.entity';
import { MarketplaceCollection } from './entities/marketplace-collection.entity';
import { PsaCertSnapshot } from './entities/psa-cert-snapshot.entity';
import { RwaToken } from './entities/rwa-token.entity';
import { PortfolioDailySnapshot } from './entities/portfolio-daily-snapshot.entity';
import { PortfolioHiddenHolding } from './entities/portfolio-hidden-holding.entity';
import { Order } from './entities/order.entity';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';
import { User } from '../user/entities/user.entity';
import { PortfolioDailySnapshotService } from './collections/portfolio-daily-snapshot.service';
import { PortfolioDailySnapshotSchedulerService } from './collections/portfolio-daily-snapshot-scheduler.service';
import { PortfolioHiddenHoldingService } from './collections/portfolio-hidden-holding.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      MarketplaceCollection,
      CollectionMarketSnapshot,
      PsaCertSnapshot,
      RwaToken,
      PortfolioDailySnapshot,
      PortfolioHiddenHolding,
      User,
    ]),
    BlockchainModule,
    CardhedgerModule,
    PsaModule,
  ],
  controllers: [
    OrdersController,
    CollectionsController,
    CertMarketTraceController,
  ],
  providers: [
    OrdersService,
    CollectionService,
    PsaCertSnapshotService,
    RwaTokenRegistryService,
    CardhedgerMarketDataService,
    CertMarketTraceService,
    CardhedgerAiInsightService,
    CollectionMarketService,
    CollectionMarketSnapshotService,
    CollectionMarketSnapshotReadService,
    CollectionMarketSnapshotSchedulerService,
    PortfolioDailySnapshotService,
    PortfolioDailySnapshotSchedulerService,
    PortfolioHiddenHoldingService,
  ],
  exports: [
    OrdersService,
    CollectionService,
    PsaCertSnapshotService,
    RwaTokenRegistryService,
    CollectionMarketService,
    CollectionMarketSnapshotService,
  ],
})
export class MarketplaceModule {}
