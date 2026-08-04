import { Module } from '@nestjs/common';
import { MarketplaceAdminModule } from './admin/marketplace-admin.module';
import { MarketplaceCollectionsModule } from './collections/marketplace-collections.module';
import { MarketplaceMarketDataModule } from './market-data/marketplace-market-data.module';
import { MarketplaceOrdersModule } from './orders/marketplace-orders.module';
import { MarketplacePartnersModule } from './partners/marketplace-partners.module';
import { MarketplacePortfolioModule } from './portfolio/marketplace-portfolio.module';
import { MarketplaceWatchlistModule } from './watchlist/marketplace-watchlist.module';
import { MarketplaceSnapshotsModule } from './snapshots/marketplace-snapshots.module';
import { MarketplaceP2pModule } from './p2p/marketplace-p2p.module';
import { MarketplaceNotificationsModule } from './notifications/marketplace-notifications.module';
import { SelfVaultSettlementModule } from './settlement/self-vault-settlement.module';

/**
 * Marketplace domain — orders, collections, materialized snapshots, portfolio, Cardhedger market data, P2P.
 */
@Module({
  imports: [
    MarketplaceAdminModule,
    MarketplacePartnersModule,
    MarketplaceMarketDataModule,
    MarketplaceSnapshotsModule,
    MarketplacePortfolioModule,
    MarketplaceWatchlistModule,
    MarketplaceCollectionsModule,
    MarketplaceOrdersModule,
    MarketplaceP2pModule,
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
    MarketplaceCollectionsModule,
    MarketplaceOrdersModule,
    MarketplaceP2pModule,
    MarketplaceNotificationsModule,
    SelfVaultSettlementModule,
  ],
})
export class MarketplaceModule {}
