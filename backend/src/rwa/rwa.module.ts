import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { UserModule } from '../user/user.module';
import { VaultModule } from '../vault/vault.module';
import { PinataService } from './pinata/pinata.service';
import { RwaController } from './rwa.controller';
import { RwaMintService } from './rwa-mint.service';
import { RwaRedeemService } from './rwa-redeem.service';
import { RwaService } from './rwa.service';

@Module({
  imports: [BlockchainModule, AuthModule, UserModule, VaultModule],
  controllers: [RwaController],
  providers: [PinataService, RwaService, RwaMintService, RwaRedeemService],
  exports: [PinataService],
})
export class RwaModule {}
