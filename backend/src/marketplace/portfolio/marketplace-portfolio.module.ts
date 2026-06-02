import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainModule } from '../../blockchain/blockchain.module';
import { User } from '../../user/entities/user.entity';
import { PortfolioDailySnapshot } from '../entities/portfolio-daily-snapshot.entity';
import { PortfolioHiddenHolding } from '../entities/portfolio-hidden-holding.entity';
import { MarketplaceCollectionsModule } from '../collections/marketplace-collections.module';
import { MarketplaceMarketDataModule } from '../market-data/marketplace-market-data.module';
import { PortfolioDailySnapshotSchedulerService } from './portfolio-daily-snapshot-scheduler.service';
import { PortfolioDailySnapshotService } from './portfolio-daily-snapshot.service';
import { PortfolioHiddenHoldingService } from './portfolio-hidden-holding.service';
import { PortfolioController } from './portfolio.controller';

/** Wallet portfolio daily snapshots and hidden-holdings UI state. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PortfolioDailySnapshot,
      PortfolioHiddenHolding,
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
    PortfolioHiddenHoldingService,
  ],
  exports: [
    PortfolioDailySnapshotService,
    PortfolioDailySnapshotSchedulerService,
    PortfolioHiddenHoldingService,
  ],
})
export class MarketplacePortfolioModule {}
