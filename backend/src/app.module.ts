import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import appConfig from './config/app.config';
import marketplaceConfig from './config/marketplace.config';
import psaConfig from './config/psa.config';
import cardladderConfig from './config/cardladder.config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from './common/cache/cache.module';
import { CardhedgerMetricsModule } from './common/metrics/cardhedger-metrics.module';
import { CardhedgerAdminModule } from './cardhedger/admin/cardhedger-admin.module';
import { AuthModule } from './auth/auth.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { CardhedgerModule } from './cardhedger/cardhedger.module';
import { CardladderModule } from './cardladder/cardladder.module';
import { RwaModule } from './rwa/rwa.module';
import { PsaModule } from './psa/psa.module';
import { HealthModule } from './health/health.module';
import { Order } from './marketplace/entities/order.entity';
import { MarketplaceCollection } from './marketplace/entities/marketplace-collection.entity';
import { CollectionMarketSnapshot } from './marketplace/entities/collection-market-snapshot.entity';
import { PsaCertSnapshot } from './marketplace/entities/psa-cert-snapshot.entity';
import { RwaToken } from './marketplace/entities/rwa-token.entity';
import { User } from './user/entities/user.entity';
import { PortfolioDailySnapshot } from './marketplace/entities/portfolio-daily-snapshot.entity';
import { PortfolioHiddenHolding } from './marketplace/entities/portfolio-hidden-holding.entity';
import { CardTop100DailySnapshot } from './cardhedger/entities/card-top100-snapshot.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, marketplaceConfig, psaConfig, cardladderConfig],
    }),
    EventEmitterModule.forRoot({ global: true }),
    ScheduleModule.forRoot(),
    CacheModule,
    CardhedgerMetricsModule,

    HealthModule,

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
          PsaCertSnapshot,
          RwaToken,
          User,
          PortfolioDailySnapshot,
          PortfolioHiddenHolding,
          CardTop100DailySnapshot,
        ],
        // Schema sync is always disabled in production — use SQL migration scripts
        // under backend/sql/schema/ instead. Enabled only in non-production
        // environments for developer convenience.
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        logging: config.get<string>('NODE_ENV') === 'development',
      }),
    }),

    AuthModule,
    RwaModule,
    BlockchainModule,
    CardhedgerModule,
    CardladderModule,
    PsaModule,
    MarketplaceModule,
    CardhedgerAdminModule,
  ],
})
export class AppModule {}
