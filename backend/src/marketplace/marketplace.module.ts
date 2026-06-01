import { Module } from '@nestjs/common';
import { MarketplaceCollectionsModule } from './collections/marketplace-collections.module';
import { MarketplaceMarketDataModule } from './market-data/marketplace-market-data.module';
import { MarketplaceOrdersModule } from './orders/marketplace-orders.module';
import { MarketplacePortfolioModule } from './portfolio/marketplace-portfolio.module';
import { MarketplaceSnapshotsModule } from './snapshots/marketplace-snapshots.module';

/**
 * Marketplace domain — orders, collections, materialized snapshots, portfolio, Cardhedger market data.
 */
@Module({
  imports: [
    MarketplaceMarketDataModule,
    MarketplaceSnapshotsModule,
    MarketplacePortfolioModule,
    MarketplaceCollectionsModule,
    MarketplaceOrdersModule,
  ],
  exports: [
    MarketplaceMarketDataModule,
    MarketplaceSnapshotsModule,
    MarketplacePortfolioModule,
    MarketplaceCollectionsModule,
    MarketplaceOrdersModule,
  ],
})
export class MarketplaceModule {}
