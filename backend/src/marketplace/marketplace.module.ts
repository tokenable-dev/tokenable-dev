import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { CollectionService } from './collection.service';
import { BucketBidService } from './bucket-bid.service';
import { BucketBid } from './entities/bucket-bid.entity';
import { MarketplaceCollection } from './entities/marketplace-collection.entity';
import { Order } from './entities/order.entity';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, BucketBid, MarketplaceCollection]),
    BlockchainModule,
  ],
  controllers: [MarketplaceController],
  providers: [MarketplaceService, BucketBidService, CollectionService],
  exports: [MarketplaceService, BucketBidService, CollectionService],
})
export class MarketplaceModule {}
