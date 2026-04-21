import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { NftModule } from './nft/nft.module';
import { PriceModule } from './price/price.module';
import { PsaModule } from './psa/psa.module';
import { UtilModule } from './util/util.module';
import { Ask } from './marketplace/entities/ask.entity';
import { Bid } from './marketplace/entities/bid.entity';
import { IdempotencyKey } from './marketplace/entities/idempotency-key.entity';
import { MatchIntent } from './marketplace/entities/match-intent.entity';
import { MarketplaceCollection } from './marketplace/entities/marketplace-collection.entity';
import { Order } from './marketplace/entities/order.entity';
import { OutboxEvent } from './marketplace/entities/outbox-event.entity';
import { TradeExecution } from './marketplace/entities/trade-execution.entity';
import { User } from './user/entities/user.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // PostgreSQL 연결 (환경변수 기반)
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.getOrThrow<string>('POSTGRES_HOST'),
        port: config.get<number>('POSTGRES_PORT', 5432),
        username: config.getOrThrow<string>('POSTGRES_USER'),
        password: config.getOrThrow<string>('POSTGRES_PASSWORD'),
        database: config.getOrThrow<string>('POSTGRES_DB'),
        entities: [
          Order,
          MarketplaceCollection,
          User,
          Bid,
          Ask,
          MatchIntent,
          TradeExecution,
          IdempotencyKey,
          OutboxEvent,
        ],
        // 프로덕션은 기본 false. 빈 DB 최초 부트스트랩 시에만 TYPEORM_SYNC=true (이후 반드시 끌 것)
        synchronize:
          config.get<string>('NODE_ENV') !== 'production' ||
          config.get<string>('TYPEORM_SYNC', '') === 'true',
        logging: config.get<string>('NODE_ENV') === 'development',
      }),
    }),

    AuthModule,
    NftModule,
    UtilModule,
    BlockchainModule,
    PriceModule,
    PsaModule,
    MarketplaceModule,
  ],
})
export class AppModule {}
