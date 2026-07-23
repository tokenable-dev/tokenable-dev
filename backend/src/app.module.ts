import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import appConfig from './config/app.config';
import marketplaceConfig from './config/marketplace.config';
import cardladderConfig from './config/cardladder.config';
import ga4Config from './config/ga4.config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from './common/cache/cache.module';
import { CardhedgerMetricsModule } from './common/metrics/cardhedger-metrics.module';
import { CardhedgerAdminModule } from './cardhedger/admin/cardhedger-admin.module';
import { KycModule } from './kyc/kyc.module';
import { PrivyModule } from './privy/privy.module';
import { AuthModule } from './auth/auth.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { CardhedgerModule } from './cardhedger/cardhedger.module';
import { CardladderModule } from './cardladder/cardladder.module';
import { RwaModule } from './rwa/rwa.module';
import { PsaModule } from './psa/psa.module';
import { HealthModule } from './health/health.module';
import { SiteAccessModule } from './site-access/site-access.module';
import { Order } from './marketplace/entities/order.entity';
import { MarketplaceCollection } from './marketplace/entities/marketplace-collection.entity';
import { CollectionMarketSnapshot } from './marketplace/entities/collection-market-snapshot.entity';
import { RwaToken } from './marketplace/entities/rwa-token.entity';
import { UserAuthProvider } from './user/entities/user-auth-provider.entity';
import { UserKycEvent } from './user/entities/user-kyc-event.entity';
import { User } from './user/entities/user.entity';
import { UserWallet } from './user/entities/user-wallet.entity';
import { VerificationToken } from './auth/entities/verification-token.entity';
import { PortfolioDailySnapshot } from './marketplace/entities/portfolio-daily-snapshot.entity';
import { PortfolioHolding } from './marketplace/entities/portfolio-holding.entity';
import { UserWatchlist } from './marketplace/entities/user-watchlist.entity';
import { CardTop100DailySnapshot } from './cardhedger/entities/card-top100-snapshot.entity';
import { CardhedgerPriceSubscription } from './cardhedger/entities/cardhedger-price-subscription.entity';
import { CardhedgerPriceDeltaCheckpoint } from './cardhedger/entities/cardhedger-price-delta-checkpoint.entity';
import { CardhedgerDailyPriceExportRun } from './cardhedger/entities/cardhedger-daily-price-export-run.entity';
import { CardhedgerPriceDeltaImportRun } from './cardhedger/entities/cardhedger-price-delta-import-run.entity';
import { MarketplaceAdmin } from './marketplace/entities/marketplace-admin.entity';
import { VaultAsset } from './vault/entities/vault-asset.entity';
import { VaultCycle } from './vault/entities/vault-cycle.entity';
import { VaultRedemption } from './vault/entities/vault-redemption.entity';
import { P2pListing } from './marketplace/entities/p2p-listing.entity';
import { P2pOrder } from './marketplace/entities/p2p-order.entity';
import { MarketplaceNotification } from './marketplace/entities/marketplace-notification.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, marketplaceConfig, cardladderConfig, ga4Config],
    }),
    EventEmitterModule.forRoot({ global: true }),
    ScheduleModule.forRoot(),
    CacheModule,
    CardhedgerMetricsModule,

    HealthModule,
    SiteAccessModule,

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.getOrThrow<string>('POSTGRES_HOST'),
        port: config.get<number>('POSTGRES_PORT', 5432),
        username: config.getOrThrow<string>('POSTGRES_USER'),
        password: config.getOrThrow<string>('POSTGRES_PASSWORD'),
        database: config.getOrThrow<string>('POSTGRES_DB'),
        extra: {
          /** Fail fast when Postgres is down instead of hanging API requests. */
          connectionTimeoutMillis: 8_000,
        },
        entities: [
          Order,
          MarketplaceCollection,
          CollectionMarketSnapshot,
          RwaToken,
          User,
          UserWallet,
          UserAuthProvider,
          UserKycEvent,
          VerificationToken,
          PortfolioDailySnapshot,
          PortfolioHolding,
          UserWatchlist,
          CardTop100DailySnapshot,
          CardhedgerPriceSubscription,
          CardhedgerPriceDeltaCheckpoint,
          CardhedgerDailyPriceExportRun,
          CardhedgerPriceDeltaImportRun,
          MarketplaceAdmin,
          VaultAsset,
          VaultCycle,
          VaultRedemption,
          P2pListing,
          P2pOrder,
          MarketplaceNotification,
        ],
        // Schema sync is always disabled in production — use SQL migration scripts
        // under backend/sql/schema/ instead. Enabled only in non-production
        // environments for developer convenience.
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        // SQL query logs are opt-in — set DB_LOGGING=1 when debugging migrations/queries.
        logging:
          config.get<string>('DB_LOGGING') === '1' ||
          config.get<string>('DB_LOGGING') === 'true',
        // Slow-query instrumentation: log queries exceeding the threshold when PERF_LOG is set.
        // TypeORM calls logQuerySlow() independently of normal query logging.
        maxQueryExecutionTime:
          process.env.PERF_LOG === 'true' || process.env.PERF_LOG === '1'
            ? Number(process.env.PERF_THRESHOLD_DB_MS ?? '500')
            : undefined,
      }),
    }),

    AuthModule,
    PrivyModule,
    RwaModule,
    BlockchainModule,
    CardhedgerModule,
    CardladderModule,
    PsaModule,
    MarketplaceModule,
    CardhedgerAdminModule,
    KycModule,
  ],
})
export class AppModule {}
