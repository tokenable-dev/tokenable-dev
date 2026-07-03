import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RwaToken } from '../marketplace/entities/rwa-token.entity';
import { VaultAsset } from './entities/vault-asset.entity';
import { VaultCycle } from './entities/vault-cycle.entity';
import { VaultRedemption } from './entities/vault-redemption.entity';
import { VaultService } from './vault.service';

/**
 * Owns the physical-asset lifecycle tables (VaultAsset -> VaultCycle ->
 * redemption). Deliberately independent of BlockchainModule — VaultService
 * only orchestrates DB state; on-chain mint/burn calls stay in
 * RwaChainWriterService and are invoked by RwaModule/marketplace-admin,
 * which then report results back into VaultService.
 */
@Module({
  imports: [TypeOrmModule.forFeature([VaultAsset, VaultCycle, VaultRedemption, RwaToken])],
  providers: [VaultService],
  exports: [VaultService],
})
export class VaultModule {}
