import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { NftModule } from './nft/nft.module';
import { UtilModule } from './util/util.module';
import { BlockchainModule } from './blockchain/blockchain.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    NftModule,
    UtilModule,
    BlockchainModule,
  ],
})
export class AppModule {}
