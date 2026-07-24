import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainModule } from '../../blockchain/blockchain.module';
import { Order } from '../entities/order.entity';
import { P2pListing } from '../entities/p2p-listing.entity';
import { MarketplaceCollectionsModule } from '../collections/marketplace-collections.module';
import { MarketplacePartnersModule } from '../partners/marketplace-partners.module';
import { MarketplacePortfolioModule } from '../portfolio/marketplace-portfolio.module';
import { MarketplaceNotificationsModule } from '../notifications/marketplace-notifications.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, P2pListing]),
    MarketplaceCollectionsModule,
    MarketplacePortfolioModule,
    MarketplacePartnersModule,
    MarketplaceNotificationsModule,
    BlockchainModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class MarketplaceOrdersModule {}
