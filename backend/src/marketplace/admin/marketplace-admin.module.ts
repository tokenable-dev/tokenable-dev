import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainModule } from '../../blockchain/blockchain.module';
import { CardhedgerDailyPriceExportRun } from '../../cardhedger/entities/cardhedger-daily-price-export-run.entity';
import { CardhedgerPriceDeltaCheckpoint } from '../../cardhedger/entities/cardhedger-price-delta-checkpoint.entity';
import { CardhedgerPriceDeltaImportRun } from '../../cardhedger/entities/cardhedger-price-delta-import-run.entity';
import { CardhedgerPriceSubscription } from '../../cardhedger/entities/cardhedger-price-subscription.entity';
import { CardTop100DailySnapshot } from '../../cardhedger/entities/card-top100-snapshot.entity';
import { BulkMintJobItem } from '../../rwa/entities/bulk-mint-job-item.entity';
import { BulkMintJob } from '../../rwa/entities/bulk-mint-job.entity';
import { UserModule } from '../../user/user.module';
import { UserAuthProvider } from '../../user/entities/user-auth-provider.entity';
import { UserKycEvent } from '../../user/entities/user-kyc-event.entity';
import { User } from '../../user/entities/user.entity';
import { UserWallet } from '../../user/entities/user-wallet.entity';
import { VaultAsset } from '../../vault/entities/vault-asset.entity';
import { VaultCycle } from '../../vault/entities/vault-cycle.entity';
import { VaultRedemption } from '../../vault/entities/vault-redemption.entity';
import { VaultSubmissionItem } from '../../vault/entities/vault-submission-item.entity';
import { VaultSubmission } from '../../vault/entities/vault-submission.entity';
import { VaultModule } from '../../vault/vault.module';
import { CollectionMarketSnapshot } from '../entities/collection-market-snapshot.entity';
import { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import { MarketplacePartner } from '../entities/marketplace-partner.entity';
import { Order } from '../entities/order.entity';
import { P2pListing } from '../entities/p2p-listing.entity';
import { P2pOrder } from '../entities/p2p-order.entity';
import { PortfolioDailySnapshot } from '../entities/portfolio-daily-snapshot.entity';
import { PortfolioHolding } from '../entities/portfolio-holding.entity';
import { RwaToken } from '../entities/rwa-token.entity';
import { UserWatchlist } from '../entities/user-watchlist.entity';
import { MarketplaceAdmin } from '../entities/marketplace-admin.entity';
import { MarketplaceAdminAuthController } from './marketplace-admin-auth.controller';
import { MarketplaceAdminBootstrapService } from './marketplace-admin-bootstrap.service';
import { MarketplaceAdminService } from './marketplace-admin.service';
import { DataInventoryController } from './data-inventory.controller';
import { DataInventoryService } from './data-inventory.service';
import { PlatformAnalyticsController } from './platform-analytics.controller';
import { PlatformAnalyticsService } from './platform-analytics.service';
import { Ga4AnalyticsService } from './ga4-analytics.service';
import { UserAdminController } from './user-admin.controller';
import { UserAdminService } from './user-admin.service';
import { VaultSubmissionsAdminController } from './vault-submissions-admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MarketplaceAdmin,
      User,
      UserWallet,
      UserAuthProvider,
      UserKycEvent,
      UserWatchlist,
      Order,
      RwaToken,
      MarketplaceCollection,
      CollectionMarketSnapshot,
      PortfolioDailySnapshot,
      PortfolioHolding,
      BulkMintJob,
      BulkMintJobItem,
      MarketplacePartner,
      CardTop100DailySnapshot,
      CardhedgerPriceDeltaImportRun,
      CardhedgerPriceDeltaCheckpoint,
      CardhedgerPriceSubscription,
      CardhedgerDailyPriceExportRun,
      P2pOrder,
      P2pListing,
      VaultAsset,
      VaultCycle,
      VaultRedemption,
      VaultSubmission,
      VaultSubmissionItem,
    ]),
    UserModule,
    VaultModule,
    BlockchainModule,
  ],
  controllers: [
    MarketplaceAdminAuthController,
    UserAdminController,
    PlatformAnalyticsController,
    DataInventoryController,
    VaultSubmissionsAdminController,
  ],
  providers: [
    MarketplaceAdminService,
    MarketplaceAdminBootstrapService,
    UserAdminService,
    PlatformAnalyticsService,
    Ga4AnalyticsService,
    DataInventoryService,
  ],
  exports: [MarketplaceAdminService],
})
export class MarketplaceAdminModule {}
