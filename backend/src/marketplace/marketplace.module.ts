import { Module } from '@nestjs/common';
import { MarketplaceAdminModule } from './admin/marketplace-admin.module';
import { MarketplaceCollectionsModule } from './collections/marketplace-collections.module';
import { MarketplaceMarketDataModule } from './market-data/marketplace-market-data.module';
import { MarketplaceOrdersModule } from './orders/marketplace-orders.module';
import { MarketplacePortfolioModule } from './portfolio/marketplace-portfolio.module';
import { MarketplaceWatchlistModule } from './watchlist/marketplace-watchlist.module';
import { MarketplaceSnapshotsModule } from './snapshots/marketplace-snapshots.module';
import { MarketplaceP2pModule } from './p2p/marketplace-p2p.module';

/**
 * Marketplace domain — orders, collections, materialized snapshots, portfolio, Cardhedger market data, P2P.
 */
@Module({
  imports: [
    MarketplaceAdminModule,
    MarketplaceMarketDataModule,
    MarketplaceSnapshotsModule,
    MarketplacePortfolioModule,
    MarketplaceWatchlistModule,
    MarketplaceCollectionsModule,
    MarketplaceOrdersModule,
    MarketplaceP2pModule,
  ],
  exports: [
    MarketplaceAdminModule,
    MarketplaceMarketDataModule,
    MarketplaceSnapshotsModule,
    MarketplacePortfolioModule,
    MarketplaceWatchlistModule,
    MarketplaceCollectionsModule,
    MarketplaceOrdersModule,
    MarketplaceP2pModule,
  ],
})
export class MarketplaceModule {}
