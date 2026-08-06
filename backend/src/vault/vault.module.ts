import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RwaToken } from '../marketplace/entities/rwa-token.entity';
import { MarketplaceNotificationsModule } from '../marketplace/notifications/marketplace-notifications.module';
import { VaultAsset } from './entities/vault-asset.entity';
import { VaultCycle } from './entities/vault-cycle.entity';
import { VaultRedeemPaymentClaim } from './entities/vault-redeem-payment-claim.entity';
import { VaultRedemption } from './entities/vault-redemption.entity';
import { VaultSubmissionItem } from './entities/vault-submission-item.entity';
import { VaultSubmission } from './entities/vault-submission.entity';
import { VaultPsaArrivalReview } from './entities/vault-psa-arrival-review.entity';
import { VaultSubmissionService } from './vault-submission.service';
import { VaultSubmissionsController } from './vault-submissions.controller';
import { VaultService } from './vault.service';
import { PsaReceivedMailService } from './psa-received-mail.service';

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
      VaultRedeemPaymentClaim,
      VaultSubmission,
      VaultSubmissionItem,
      VaultPsaArrivalReview,
      RwaToken,
    ]),
    MarketplaceNotificationsModule,
  ],
  controllers: [VaultSubmissionsController],
  providers: [VaultService, VaultSubmissionService, PsaReceivedMailService],
  exports: [VaultService, VaultSubmissionService, PsaReceivedMailService],
})
export class VaultModule {}
