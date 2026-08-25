import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainModule } from '../../blockchain/blockchain.module';
import { VaultModule } from '../../vault/vault.module';
import { Order } from '../entities/order.entity';
import { P2pListing } from '../entities/p2p-listing.entity';
import { CollectionMarketSnapshot } from '../entities/collection-market-snapshot.entity';
import { MarketplaceCollectionsModule } from '../collections/marketplace-collections.module';
import { MarketplacePartnersModule } from '../partners/marketplace-partners.module';
import { MarketplacePortfolioModule } from '../portfolio/marketplace-portfolio.module';
import { MarketplaceNotificationsModule } from '../notifications/marketplace-notifications.module';
import { MarketplaceBuyerListingAlertModule } from '../buyer-listing-alert/marketplace-buyer-listing-alert.module';
import { SelfVaultSettlementModule } from '../settlement/self-vault-settlement.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, P2pListing, CollectionMarketSnapshot]),
    MarketplaceCollectionsModule,
    MarketplacePortfolioModule,
    MarketplacePartnersModule,
    MarketplaceNotificationsModule,
    MarketplaceBuyerListingAlertModule,
    BlockchainModule,
    VaultModule,
    SelfVaultSettlementModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class MarketplaceOrdersModule {}
