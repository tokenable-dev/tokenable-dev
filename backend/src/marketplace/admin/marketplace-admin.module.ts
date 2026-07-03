import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '../../user/user.module';
import { UserAuthProvider } from '../../user/entities/user-auth-provider.entity';
import { User } from '../../user/entities/user.entity';
import { UserWallet } from '../../user/entities/user-wallet.entity';
import { CollectionMarketSnapshot } from '../entities/collection-market-snapshot.entity';
import { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import { Order } from '../entities/order.entity';
import { PortfolioDailySnapshot } from '../entities/portfolio-daily-snapshot.entity';
import { RwaToken } from '../entities/rwa-token.entity';
import { UserWatchlist } from '../entities/user-watchlist.entity';
import { MarketplaceAdmin } from '../entities/marketplace-admin.entity';
import { MarketplaceAdminAuthController } from './marketplace-admin-auth.controller';
import { MarketplaceAdminBootstrapService } from './marketplace-admin-bootstrap.service';
import { MarketplaceAdminService } from './marketplace-admin.service';
import { PlatformAnalyticsController } from './platform-analytics.controller';
import { PlatformAnalyticsService } from './platform-analytics.service';
import { Ga4AnalyticsService } from './ga4-analytics.service';
import { UserAdminController } from './user-admin.controller';
import { UserAdminService } from './user-admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MarketplaceAdmin,
      User,
      UserWallet,
      UserAuthProvider,
      UserWatchlist,
      Order,
      RwaToken,
      MarketplaceCollection,
      CollectionMarketSnapshot,
      PortfolioDailySnapshot,
    ]),
    UserModule,
  ],
  controllers: [
    MarketplaceAdminAuthController,
    UserAdminController,
    PlatformAnalyticsController,
  ],
  providers: [
    MarketplaceAdminService,
    MarketplaceAdminBootstrapService,
    UserAdminService,
    PlatformAnalyticsService,
    Ga4AnalyticsService,
  ],
  exports: [MarketplaceAdminService],
})
export class MarketplaceAdminModule {}
