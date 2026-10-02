import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { BlockchainModule } from '../../blockchain/blockchain.module';
import { MarketplaceCollectionsModule } from '../collections/marketplace-collections.module';
import { UserBuyerListingAlert } from '../entities/user-buyer-listing-alert.entity';
import { Order } from '../entities/order.entity';
import { MarketplaceNotificationsModule } from '../notifications/marketplace-notifications.module';
import { BuyerListingAlertController } from './buyer-listing-alert.controller';
import { BuyerListingAlertService } from './buyer-listing-alert.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserBuyerListingAlert, Order]),
    AuthModule,
    BlockchainModule,
    MarketplaceCollectionsModule,
    MarketplaceNotificationsModule,
  ],
  controllers: [BuyerListingAlertController],
  providers: [BuyerListingAlertService],
  exports: [BuyerListingAlertService],
})
export class MarketplaceBuyerListingAlertModule {}
