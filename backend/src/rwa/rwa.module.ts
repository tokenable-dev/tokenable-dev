import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { MarketplaceAdminModule } from '../marketplace/admin/marketplace-admin.module';
import { MarketplaceOrdersModule } from '../marketplace/orders/marketplace-orders.module';
import { MarketplacePartnersModule } from '../marketplace/partners/marketplace-partners.module';
import { Order } from '../marketplace/entities/order.entity';
import { PsaModule } from '../psa/psa.module';
import { UserModule } from '../user/user.module';
import { VaultModule } from '../vault/vault.module';
import { BulkMintAdminController } from './admin/bulk-mint-admin.controller';
import { BulkMintJobService } from './bulk-mint/bulk-mint-job.service';
import { PartnerSeaportAskService } from './bulk-mint/partner-seaport-ask.service';
import { BulkMintJobItem } from './entities/bulk-mint-job-item.entity';
import { BulkMintJob } from './entities/bulk-mint-job.entity';
import { PinataService } from './pinata/pinata.service';
import { RwaController } from './rwa.controller';
import { RwaMintService } from './rwa-mint.service';
import { RwaRedeemService } from './rwa-redeem.service';
import { RwaService } from './rwa.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([BulkMintJob, BulkMintJobItem, Order]),
    BlockchainModule,
    AuthModule,
    UserModule,
    VaultModule,
    PsaModule,
    MarketplaceAdminModule,
    MarketplacePartnersModule,
    MarketplaceOrdersModule,
  ],
  controllers: [RwaController, BulkMintAdminController],
  providers: [
    PinataService,
    RwaService,
    RwaMintService,
    RwaRedeemService,
    BulkMintJobService,
    PartnerSeaportAskService,
  ],
  exports: [PinataService, BulkMintJobService],
})
export class RwaModule {}
