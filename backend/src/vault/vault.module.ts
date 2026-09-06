import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { MarketplaceNotificationsModule } from '../marketplace/notifications/marketplace-notifications.module';
import { VaultAsset } from './entities/vault-asset.entity';
import { VaultCycle } from './entities/vault-cycle.entity';
import { MarketplacePartner } from '../marketplace/entities/marketplace-partner.entity';
import { RwaToken } from '../marketplace/entities/rwa-token.entity';
import { VaultRedeemPaymentClaim } from './entities/vault-redeem-payment-claim.entity';
import { VaultRedemption } from './entities/vault-redemption.entity';
import { VaultSubmissionItem } from './entities/vault-submission-item.entity';
import { VaultSubmission } from './entities/vault-submission.entity';
import { VaultPsaArrivalReview } from './entities/vault-psa-arrival-review.entity';
import { VaultPsaVaultedReview } from './entities/vault-psa-vaulted-review.entity';
import { VaultSubmissionService } from './vault-submission.service';
import { VaultSubmissionsController } from './vault-submissions.controller';
import { VaultService } from './vault.service';
import { VaultMintRecoveryService } from './vault-mint-recovery.service';
import { GmailApiClient } from './gmail-api.client';
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
      VaultPsaVaultedReview,
      RwaToken,
      MarketplacePartner,
    ]),
    MarketplaceNotificationsModule,
    BlockchainModule,
  ],
  controllers: [VaultSubmissionsController],
  providers: [
    VaultService,
    VaultSubmissionService,
    GmailApiClient,
    PsaReceivedMailService,
    VaultMintRecoveryService,
  ],
  exports: [
    VaultService,
    VaultSubmissionService,
    GmailApiClient,
    PsaReceivedMailService,
  ],
})
export class VaultModule {}
