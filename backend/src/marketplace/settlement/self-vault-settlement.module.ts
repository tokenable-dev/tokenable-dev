import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainModule } from '../../blockchain/blockchain.module';
import { UserModule } from '../../user/user.module';
import { VaultModule } from '../../vault/vault.module';
import { MarketplaceAdminModule } from '../admin/marketplace-admin.module';
import { MarketplacePartnersModule } from '../partners/marketplace-partners.module';
import { MarketplaceNotificationsModule } from '../notifications/marketplace-notifications.module';
import { Order } from '../entities/order.entity';
import { PortfolioHolding } from '../entities/portfolio-holding.entity';
import { RwaToken } from '../entities/rwa-token.entity';
import { SelfVaultSettlement } from '../entities/self-vault-settlement.entity';
import { SelfVaultSettlementController } from './self-vault-settlement.controller';
import { SelfVaultSettlementService } from './self-vault-settlement.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SelfVaultSettlement,
      Order,
      RwaToken,
      PortfolioHolding,
    ]),
    MarketplaceAdminModule,
    UserModule,
    VaultModule,
    BlockchainModule,
    MarketplacePartnersModule,
    MarketplaceNotificationsModule,
  ],
  controllers: [SelfVaultSettlementController],
  providers: [SelfVaultSettlementService],
  exports: [SelfVaultSettlementService],
})
export class SelfVaultSettlementModule {}
