import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { CardhedgerModule } from '../cardhedger/cardhedger.module';
import { CardhedgerMarketDataService } from './cardhedger-market-data.service';
import { CollectionMarketService } from './collection-market.service';
import { CollectionService } from './collection.service';
import { Ask } from './entities/ask.entity';
import { Bid } from './entities/bid.entity';
import { IdempotencyKey } from './entities/idempotency-key.entity';
import { HiddenAsset } from './entities/hidden-asset.entity';
import { MatchIntent } from './entities/match-intent.entity';
import { MarketplaceCollection } from './entities/marketplace-collection.entity';
import { Order } from './entities/order.entity';
import { OutboxEvent } from './entities/outbox-event.entity';
import { TradeExecution } from './entities/trade-execution.entity';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { BidsController } from './trading/bids.controller';
import { BidsQueryService } from './trading/bids-query.service';
import { OutboxPublisherService } from './trading/outbox-publisher.service';
import { RuleEngineService } from './trading/rule-engine.service';
import { SettlementProcessorService } from './trading/settlement-processor.service';
import { TokenResolutionService } from './trading/token-resolution.service';
import { TradeController } from './trading/trade.controller';
import { TradeExecutionQueryService } from './trading/trade-execution-query.service';
import { TradeOrchestratorService } from './trading/trade-orchestrator.service';
import { HiddenAssetsService } from './hidden-assets.service';

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
    MarketplaceController,
    BidsController,
    TradeController,
  ],
  providers: [
    MarketplaceService,
    CollectionService,
    CardhedgerMarketDataService,
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
    MarketplaceService,
    CollectionService,
    CollectionMarketService,
  ],
})
export class MarketplaceModule {}
