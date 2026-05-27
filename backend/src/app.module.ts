import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from './common/cache/cache.module';
import { AuthModule } from './auth/auth.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { CardhedgerModule } from './cardhedger/cardhedger.module';
import { RwaModule } from './rwa/rwa.module';
import { PsaModule } from './psa/psa.module';
import { HealthModule } from './health/health.module';
import { Order } from './marketplace/entities/order.entity';
import { MarketplaceCollection } from './marketplace/entities/marketplace-collection.entity';
import { CollectionMarketSnapshot } from './marketplace/entities/collection-market-snapshot.entity';
import { PsaCertSnapshot } from './marketplace/entities/psa-cert-snapshot.entity';
import { RwaToken } from './marketplace/entities/rwa-token.entity';
import { User } from './user/entities/user.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    CacheModule,

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
        ],
        // 프로덕션은 기본 false. 빈 DB 최초 부트스트랩 시에만 TYPEORM_SYNC=true (이후 반드시 끌 것)
        synchronize:
          config.get<string>('NODE_ENV') !== 'production' ||
          config.get<string>('TYPEORM_SYNC', '') === 'true',
        logging: config.get<string>('NODE_ENV') === 'development',
      }),
    }),

    AuthModule,
    RwaModule,
    BlockchainModule,
    CardhedgerModule,
    PsaModule,
    MarketplaceModule,
  ],
})
export class AppModule {}
