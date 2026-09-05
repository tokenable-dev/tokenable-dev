import { Injectable, Logger, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
import { CardhedgerPriceInfraModule } from './cardhedger/cardhedger-price-infra.module';
import {
  isCardhedgerPriceInfraEnabled,
  readCardhedgerFeatureFlags,
} from './config/cardhedger-feature-flags.util';
import { CardladderModule } from './cardladder/cardladder.module';
import { RwaModule } from './rwa/rwa.module';
import { PsaModule } from './psa/psa.module';
import { HealthModule } from './health/health.module';
import { SiteAccessModule } from './site-access/site-access.module';
import { Order } from './marketplace/entities/order.entity';
import { MarketplaceCollection } from './marketplace/entities/marketplace-collection.entity';
import { CollectionMarketSnapshot } from './marketplace/entities/collection-market-snapshot.entity';
import { RwaToken } from './marketplace/entities/rwa-token.entity';
import { RwaOwnerIndexCursor } from './blockchain/entities/rwa-owner-index-cursor.entity';
import { UserAuthProvider } from './user/entities/user-auth-provider.entity';
import { UserKycEvent } from './user/entities/user-kyc-event.entity';
import { User } from './user/entities/user.entity';
import { UserShippingAddress } from './user/entities/user-shipping-address.entity';
import { UserWallet } from './user/entities/user-wallet.entity';
import { PortfolioDailySnapshot } from './marketplace/entities/portfolio-daily-snapshot.entity';
import { PortfolioHolding } from './marketplace/entities/portfolio-holding.entity';
import { UserWatchlist } from './marketplace/entities/user-watchlist.entity';
import { UserBuyerListingAlert } from './marketplace/entities/user-buyer-listing-alert.entity';
import { CardTop100DailySnapshot } from './cardhedger/entities/card-top100-snapshot.entity';
import { CardhedgerPriceSubscription } from './cardhedger/entities/cardhedger-price-subscription.entity';
import { CardhedgerPriceDeltaCheckpoint } from './cardhedger/entities/cardhedger-price-delta-checkpoint.entity';
import { CardhedgerDailyPriceExportRun } from './cardhedger/entities/cardhedger-daily-price-export-run.entity';
import { CardhedgerPriceDeltaImportRun } from './cardhedger/entities/cardhedger-price-delta-import-run.entity';
import { MarketplaceAdmin } from './marketplace/entities/marketplace-admin.entity';
import { VaultAsset } from './vault/entities/vault-asset.entity';
import { VaultCycle } from './vault/entities/vault-cycle.entity';
import { VaultRedeemPaymentClaim } from './vault/entities/vault-redeem-payment-claim.entity';
import { VaultRedemption } from './vault/entities/vault-redemption.entity';
import { VaultSubmission } from './vault/entities/vault-submission.entity';
import { VaultSubmissionItem } from './vault/entities/vault-submission-item.entity';
import { VaultPsaArrivalReview } from './vault/entities/vault-psa-arrival-review.entity';
import { VaultPsaVaultedReview } from './vault/entities/vault-psa-vaulted-review.entity';
import { MarketplacePartner } from './marketplace/entities/marketplace-partner.entity';
import { MarketplacePartnerAddress } from './marketplace/entities/marketplace-partner-address.entity';
import { BulkMintJob } from './rwa/entities/bulk-mint-job.entity';
import { BulkMintJobItem } from './rwa/entities/bulk-mint-job-item.entity';
import { P2pListing } from './marketplace/entities/p2p-listing.entity';
import { P2pOrder } from './marketplace/entities/p2p-order.entity';
import { MarketplaceNotification } from './marketplace/entities/marketplace-notification.entity';
import { SelfVaultSettlement } from './marketplace/entities/self-vault-settlement.entity';
import { VaultModule } from './vault/vault.module';

/**
 * Rate-limit tracker keyed by real client IP. nginx sets X-Real-IP from
 * $remote_addr (not client-spoofable); browser traffic proxied through the
 * Next.js server would otherwise all share one container IP.
 */
@Injectable()
class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const headers = req.headers as Record<string, string | undefined> | undefined;
    const realIp = headers?.['x-real-ip']?.trim();
    return Promise.resolve(realIp || (req.ip as string) || 'unknown');
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, marketplaceConfig, cardladderConfig, ga4Config],
    }),
    EventEmitterModule.forRoot({ global: true }),
    // Per-IP request throttling — generous global ceiling; sensitive routes
    // (auth, site-access, cardhedger/psa proxies, chain scans) declare stricter
    // @Throttle overrides. THROTTLE_ENABLED=0 disables (load tests / local debug).
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60_000,
          limit: Number(process.env.THROTTLE_GLOBAL_LIMIT_PER_MIN ?? '300'),
        },
      ],
      skipIf: () => process.env.THROTTLE_ENABLED === '0',
    }),
    ScheduleModule.forRoot(),
    CacheModule,
    CardhedgerMetricsModule,

    SiteAccessModule,

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const poolLog = new Logger('TypeOrmPool');
        return {
        type: 'postgres',
        host: config.getOrThrow<string>('POSTGRES_HOST'),
        port: config.get<number>('POSTGRES_PORT', 5432),
        username: config.getOrThrow<string>('POSTGRES_USER'),
        password: config.getOrThrow<string>('POSTGRES_PASSWORD'),
        database: config.getOrThrow<string>('POSTGRES_DB'),
        extra: {
          /**
           * pg-pool uses this both for a new TCP handshake and for waiting
           * on a busy pool. Exceeding it surfaces as
           * "timeout exceeded when trying to connect" even when Postgres is up
           * (Docker Desktop dropped an idle socket, or all `max` clients are
           * checked out). KeepAlive avoids the silent-idle-drop case.
           */
          connectionTimeoutMillis: 8_000,
          /**
           * Bounded pool so a traffic spike queues inside the app instead of
           * exhausting Postgres max_connections (default 100, shared with
           * psql/admin sessions).
           */
          max: Number(config.get<string>('DB_POOL_MAX') ?? '20'),
          idleTimeoutMillis: 30_000,
          keepAlive: true,
          keepAliveInitialDelayMillis: 10_000,
          application_name: 'tokenable-api',
        },
        poolErrorHandler: (err: unknown) => {
          poolLog.warn(err instanceof Error ? err.message : String(err));
        },
        entities: [
          Order,
          MarketplaceCollection,
          CollectionMarketSnapshot,
          RwaToken,
          RwaOwnerIndexCursor,
          User,
          UserWallet,
          UserShippingAddress,
          UserAuthProvider,
          UserKycEvent,
          PortfolioDailySnapshot,
          PortfolioHolding,
          UserWatchlist,
          UserBuyerListingAlert,
          CardTop100DailySnapshot,
          CardhedgerPriceSubscription,
          CardhedgerPriceDeltaCheckpoint,
          CardhedgerDailyPriceExportRun,
          CardhedgerPriceDeltaImportRun,
          MarketplaceAdmin,
          MarketplacePartner,
          MarketplacePartnerAddress,
          VaultAsset,
          VaultCycle,
          VaultRedemption,
          VaultRedeemPaymentClaim,
          VaultSubmission,
          VaultSubmissionItem,
          VaultPsaArrivalReview,
          VaultPsaVaultedReview,
          BulkMintJob,
          BulkMintJobItem,
          P2pListing,
          P2pOrder,
          MarketplaceNotification,
          SelfVaultSettlement,
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
      };
      },
    }),

    /** After TypeORM so SchemaAssertService can inject DataSource. */
    HealthModule,

    AuthModule,
    PrivyModule,
    VaultModule,
    RwaModule,
    BlockchainModule,
    CardhedgerModule,
    ...(isCardhedgerPriceInfraEnabled(readCardhedgerFeatureFlags())
      ? [CardhedgerPriceInfraModule]
      : []),
    CardladderModule,
    PsaModule,
    MarketplaceModule,
    CardhedgerAdminModule,
    KycModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ClientIpThrottlerGuard }],
})
export class AppModule {}
