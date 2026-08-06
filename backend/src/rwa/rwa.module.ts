import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { MarketplaceAdminModule } from '../marketplace/admin/marketplace-admin.module';
import { MarketplaceCollectionsModule } from '../marketplace/collections/marketplace-collections.module';
import { MarketplaceOrdersModule } from '../marketplace/orders/marketplace-orders.module';
import { MarketplacePartnersModule } from '../marketplace/partners/marketplace-partners.module';
import { MarketplacePortfolioModule } from '../marketplace/portfolio/marketplace-portfolio.module';
import { Order } from '../marketplace/entities/order.entity';
import { PsaModule } from '../psa/psa.module';
import { UserModule } from '../user/user.module';
import { VaultModule } from '../vault/vault.module';
import { BulkMintAdminController } from './admin/bulk-mint-admin.controller';
import { FedexRateAdminController } from './admin/fedex-rate-admin.controller';
import { VaultSubmissionAdminMintController } from './admin/vault-submission-admin-mint.controller';
import { VaultSubmissionAdminMintService } from './admin/vault-submission-admin-mint.service';
import { BulkMintJobService } from './bulk-mint/bulk-mint-job.service';
import { PartnerSeaportAskService } from './bulk-mint/partner-seaport-ask.service';
import { BulkMintJobItem } from './entities/bulk-mint-job-item.entity';
import { BulkMintJob } from './entities/bulk-mint-job.entity';
import { MarketplaceNotificationsModule } from '../marketplace/notifications/marketplace-notifications.module';
import { VaultSubmissionItem } from '../vault/entities/vault-submission-item.entity';
import { PinataService } from './pinata/pinata.service';
import { RwaController } from './rwa.controller';
import { RwaMintService } from './rwa-mint.service';
import { RwaRedeemService } from './rwa-redeem.service';
import { RedeemShippingFeeCalculator } from './redeem-shipping-fee.calculator';
import { FedExRateClient } from './shipping/fedex-rate.client';
import { RwaService } from './rwa.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BulkMintJob,
      BulkMintJobItem,
      Order,
      VaultSubmissionItem,
    ]),
    BlockchainModule,
    AuthModule,
    UserModule,
    VaultModule,
    PsaModule,
    MarketplaceAdminModule,
    MarketplaceCollectionsModule,
    MarketplacePartnersModule,
    MarketplaceOrdersModule,
    MarketplacePortfolioModule,
    MarketplaceNotificationsModule,
  ],
  controllers: [
    RwaController,
    BulkMintAdminController,
    VaultSubmissionAdminMintController,
    FedexRateAdminController,
  ],
  providers: [
    PinataService,
    RwaService,
    RwaMintService,
    RwaRedeemService,
    RedeemShippingFeeCalculator,
    FedExRateClient,
    BulkMintJobService,
    PartnerSeaportAskService,
    VaultSubmissionAdminMintService,
  ],
  exports: [PinataService, BulkMintJobService],
})
export class RwaModule {}
