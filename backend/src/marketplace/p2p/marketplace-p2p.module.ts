import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainModule } from '../../blockchain/blockchain.module';
import { KycModule } from '../../kyc/kyc.module';
import { UserModule } from '../../user/user.module';
import { VaultModule } from '../../vault/vault.module';
import { MarketplaceAdminModule } from '../admin/marketplace-admin.module';
import { P2pListing } from '../entities/p2p-listing.entity';
import { P2pOrder } from '../entities/p2p-order.entity';
import { P2pAdminController } from './p2p-admin.controller';
import { P2pController } from './p2p.controller';
import { P2pService } from './p2p.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([P2pListing, P2pOrder]),
    BlockchainModule,
    UserModule,
    VaultModule,
    MarketplaceAdminModule,
    KycModule,
  ],
  controllers: [P2pController, P2pAdminController],
  providers: [P2pService],
  exports: [P2pService],
})
export class MarketplaceP2pModule {}
