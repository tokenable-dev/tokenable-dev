import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainModule } from '../../blockchain/blockchain.module';
import { UserModule } from '../../user/user.module';
import { VaultModule } from '../../vault/vault.module';
import { MarketplaceAdminModule } from '../admin/marketplace-admin.module';
import { SelfVaultSettlement } from '../entities/self-vault-settlement.entity';
import { SelfVaultSettlementController } from './self-vault-settlement.controller';
import { SelfVaultSettlementService } from './self-vault-settlement.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SelfVaultSettlement]),
    MarketplaceAdminModule,
    UserModule,
    VaultModule,
    BlockchainModule,
  ],
  controllers: [SelfVaultSettlementController],
  providers: [SelfVaultSettlementService],
  exports: [SelfVaultSettlementService],
})
export class SelfVaultSettlementModule {}
