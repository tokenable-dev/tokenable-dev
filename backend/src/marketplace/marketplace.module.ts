import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { PriceModule } from '../price/price.module';
import { PoketraceModule } from '../poketrace/poketrace.module';
import { CollectionMarketService } from './collection-market.service';
import { CollectionService } from './collection.service';
import { MarketplaceCollection } from './entities/marketplace-collection.entity';
import { Order } from './entities/order.entity';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, MarketplaceCollection]),
    BlockchainModule,
    PriceModule,
    PoketraceModule,
  ],
  controllers: [MarketplaceController],
  providers: [
    MarketplaceService,
    CollectionService,
    CollectionMarketService,
  ],
  exports: [
    MarketplaceService,
    CollectionService,
    CollectionMarketService,
    PoketraceModule,
  ],
})
export class MarketplaceModule {}
