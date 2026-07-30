import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RwaToken } from '../marketplace/entities/rwa-token.entity';
import { MarketplaceNotificationsModule } from '../marketplace/notifications/marketplace-notifications.module';
import { VaultAsset } from './entities/vault-asset.entity';
import { VaultCycle } from './entities/vault-cycle.entity';
import { VaultRedemption } from './entities/vault-redemption.entity';
import { VaultSubmissionItem } from './entities/vault-submission-item.entity';
import { VaultSubmission } from './entities/vault-submission.entity';
import { VaultSubmissionService } from './vault-submission.service';
import { VaultSubmissionsController } from './vault-submissions.controller';
import { VaultService } from './vault.service';

/**
 * Owns the physical-asset lifecycle tables (VaultAsset -> VaultCycle ->
 * redemption) plus sell-flow submissions (pre-mint package tracking).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      VaultAsset,
      VaultCycle,
      VaultRedemption,
      VaultSubmission,
      VaultSubmissionItem,
      RwaToken,
    ]),
    MarketplaceNotificationsModule,
  ],
  controllers: [VaultSubmissionsController],
  providers: [VaultService, VaultSubmissionService],
  exports: [VaultService, VaultSubmissionService],
})
export class VaultModule {}
