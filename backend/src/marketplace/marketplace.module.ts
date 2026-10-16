import { Module } from '@nestjs/common';
import { MarketplaceAdminModule } from './admin/marketplace-admin.module';
import { MarketplaceCollectionsModule } from './collections/marketplace-collections.module';
import { MarketplaceMarketDataModule } from './market-data/marketplace-market-data.module';
import { MarketplaceOrdersModule } from './orders/marketplace-orders.module';
import { MarketplacePartnersModule } from './partners/marketplace-partners.module';
import { MarketplacePortfolioModule } from './portfolio/marketplace-portfolio.module';
import { MarketplaceBuyerListingAlertModule } from './buyer-listing-alert/marketplace-buyer-listing-alert.module';
import { MarketplaceWatchlistModule } from './watchlist/marketplace-watchlist.module';
import { MarketplaceSnapshotsModule } from './snapshots/marketplace-snapshots.module';
import { MarketplaceNotificationsModule } from './notifications/marketplace-notifications.module';
import { SelfVaultSettlementModule } from './settlement/self-vault-settlement.module';

/**
 * Marketplace domain — orders, collections, materialized snapshots, portfolio, Cardhedger market data.
 */
@Module({
  imports: [
    MarketplaceAdminModule,
    MarketplacePartnersModule,
    MarketplaceMarketDataModule,
    MarketplaceSnapshotsModule,
    MarketplacePortfolioModule,
    MarketplaceWatchlistModule,
    MarketplaceBuyerListingAlertModule,
    MarketplaceCollectionsModule,
    MarketplaceOrdersModule,
    MarketplaceNotificationsModule,
    SelfVaultSettlementModule,
  ],
  exports: [
    MarketplaceAdminModule,
    MarketplacePartnersModule,
    MarketplaceMarketDataModule,
    MarketplaceSnapshotsModule,
    MarketplacePortfolioModule,
    MarketplaceWatchlistModule,
    MarketplaceBuyerListingAlertModule,
    MarketplaceCollectionsModule,
    MarketplaceOrdersModule,
    MarketplaceNotificationsModule,
    SelfVaultSettlementModule,
  ],
})
export class MarketplaceModule {}
