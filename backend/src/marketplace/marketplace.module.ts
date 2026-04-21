import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { PriceModule } from '../price/price.module';
import { PoketraceModule } from '../poketrace/poketrace.module';
import { CollectionMarketService } from './collection-market.service';
import { CollectionService } from './collection.service';
import { Ask } from './entities/ask.entity';
import { Bid } from './entities/bid.entity';
import { IdempotencyKey } from './entities/idempotency-key.entity';
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
    ]),
    BlockchainModule,
    PriceModule,
    PoketraceModule,
  ],
  controllers: [MarketplaceController, BidsController, TradeController],
  providers: [
    MarketplaceService,
    CollectionService,
    CollectionMarketService,
    RuleEngineService,
    TokenResolutionService,
    BidsQueryService,
    TradeOrchestratorService,
    TradeExecutionQueryService,
    SettlementProcessorService,
    OutboxPublisherService,
  ],
  exports: [
    MarketplaceService,
    CollectionService,
    CollectionMarketService,
    PoketraceModule,
  ],
})
export class MarketplaceModule {}
