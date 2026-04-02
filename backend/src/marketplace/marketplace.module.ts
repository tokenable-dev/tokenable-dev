import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { CollectionService } from './collection.service';
import { MarketplaceCollection } from './entities/marketplace-collection.entity';
import { Order } from './entities/order.entity';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order, MarketplaceCollection]), BlockchainModule],
  controllers: [MarketplaceController],
  providers: [MarketplaceService, CollectionService],
  exports: [MarketplaceService, CollectionService],
})
export class MarketplaceModule {}
