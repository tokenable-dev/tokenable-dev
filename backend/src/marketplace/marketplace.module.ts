import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { CardhedgerModule } from '../cardhedger/cardhedger.module';
import { CardhedgerAiInsightService } from './collections/cardhedger-ai-insight.service';
import { CardhedgerMarketDataService } from './collections/cardhedger-market-data.service';
import { CollectionMarketService } from './collections/collection-market.service';
import { CollectionService } from './collections/collection.service';
import { CollectionsController } from './collections/collections.controller';
import { Ask } from './entities/ask.entity';
import { Bid } from './entities/bid.entity';
import { IdempotencyKey } from './entities/idempotency-key.entity';
import { HiddenAsset } from './entities/hidden-asset.entity';
import { MatchIntent } from './entities/match-intent.entity';
import { MarketplaceCollection } from './entities/marketplace-collection.entity';
import { Order } from './entities/order.entity';
import { OutboxEvent } from './entities/outbox-event.entity';
import { TradeExecution } from './entities/trade-execution.entity';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';
import { AssetsController } from './assets/assets.controller';
import { HiddenAssetsService } from './assets/hidden-assets.service';
import { BidsController } from './trading/bids.controller';
import { BidsQueryService } from './trading/bids-query.service';
import { OutboxPublisherService } from './trading/outbox-publisher.service';
import { RuleEngineService } from './trading/rule-engine.service';
import { SettlementProcessorService } from './trading/settlement-processor.service';
import { TokenResolutionService } from './trading/token-resolution.service';
import { TradeController } from './trading/trade.controller';
import { TradeExecutionQueryService } from './trading/trade-execution-query.service';
import { TradeOrchestratorService } from './trading/trade-orchestrator.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      MarketplaceCollection,
      Bid,
      Ask,
      MatchIntent,
      TradeExecution,
      IdempotencyKey,
      OutboxEvent,
      HiddenAsset,
    ]),
    BlockchainModule,
    CardhedgerModule,
  ],
  controllers: [
    OrdersController,
    CollectionsController,
    AssetsController,
    BidsController,
    TradeController,
  ],
  providers: [
    OrdersService,
    CollectionService,
    CardhedgerMarketDataService,
    CardhedgerAiInsightService,
    CollectionMarketService,
    RuleEngineService,
    TokenResolutionService,
    BidsQueryService,
    TradeOrchestratorService,
    TradeExecutionQueryService,
    SettlementProcessorService,
    OutboxPublisherService,
    HiddenAssetsService,
  ],
  exports: [
    OrdersService,
    CollectionService,
    CollectionMarketService,
  ],
})
export class MarketplaceModule {}
