import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { CardhedgerModule } from '../cardhedger/cardhedger.module';
import { PsaModule } from '../psa/psa.module';
import { CardhedgerAiInsightService } from './collections/cardhedger-ai-insight.service';
import { CardhedgerMarketDataService } from './collections/cardhedger-market-data.service';
import { CertMarketTraceController } from './collections/cert-market-trace.controller';
import { CertMarketTraceService } from './collections/cert-market-trace.service';
import { CollectionMarketService } from './collections/collection-market.service';
import { CollectionService } from './collections/collection.service';
import { CollectionsController } from './collections/collections.controller';
import { MarketplaceCollection } from './entities/marketplace-collection.entity';
import { Order } from './entities/order.entity';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, MarketplaceCollection]),
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
    CardhedgerMarketDataService,
    CertMarketTraceService,
    CardhedgerAiInsightService,
    CollectionMarketService,
  ],
  exports: [OrdersService, CollectionService, CollectionMarketService],
})
export class MarketplaceModule {}
