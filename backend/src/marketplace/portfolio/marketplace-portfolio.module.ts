import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainModule } from '../../blockchain/blockchain.module';
import { User } from '../../user/entities/user.entity';
import { PortfolioDailySnapshot } from '../entities/portfolio-daily-snapshot.entity';
import { PortfolioHolding } from '../entities/portfolio-holding.entity';
import { RwaToken } from '../entities/rwa-token.entity';
import { MarketplaceCollectionsModule } from '../collections/marketplace-collections.module';
import { MarketplaceMarketDataModule } from '../market-data/marketplace-market-data.module';
import { PortfolioDailySnapshotSchedulerService } from './portfolio-daily-snapshot-scheduler.service';
import { PortfolioDailySnapshotService } from './portfolio-daily-snapshot.service';
import { PortfolioHoldingService } from './portfolio-holding.service';
import { PortfolioAssetsPageService } from './portfolio-assets-page.service';
import { PortfolioAssetsPageCacheService } from './portfolio-assets-page-cache.service';
import { PortfolioController } from './portfolio.controller';

/** Wallet portfolio daily snapshots and per-holding UI prefs (hide + cost basis). */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PortfolioDailySnapshot,
      PortfolioHolding,
      RwaToken,
      User,
    ]),
    BlockchainModule,
    MarketplaceMarketDataModule,
    forwardRef(() => MarketplaceCollectionsModule),
  ],
  controllers: [PortfolioController],
  providers: [
    PortfolioDailySnapshotService,
    PortfolioDailySnapshotSchedulerService,
    PortfolioHoldingService,
    PortfolioAssetsPageService,
    PortfolioAssetsPageCacheService,
  ],
  exports: [
    PortfolioDailySnapshotService,
    PortfolioDailySnapshotSchedulerService,
    PortfolioHoldingService,
    PortfolioAssetsPageService,
  ],
})
export class MarketplacePortfolioModule {}
