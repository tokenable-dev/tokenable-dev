import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainModule } from '../../blockchain/blockchain.module';
import { Order } from '../entities/order.entity';
import { MarketplaceCollectionsModule } from '../collections/marketplace-collections.module';
import { MarketplacePortfolioModule } from '../portfolio/marketplace-portfolio.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    MarketplaceCollectionsModule,
    MarketplacePortfolioModule,
    BlockchainModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class MarketplaceOrdersModule {}
