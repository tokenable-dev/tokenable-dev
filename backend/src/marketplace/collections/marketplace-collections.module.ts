import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainModule } from '../../blockchain/blockchain.module';
import { CardhedgerModule } from '../../cardhedger/cardhedger.module';
import { PsaModule } from '../../psa/psa.module';
import { MarketplaceAdminService } from '../admin/marketplace-admin.service';
import { Order } from '../entities/order.entity';
import { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import { RwaToken } from '../entities/rwa-token.entity';
import { MarketplaceMarketDataModule } from '../market-data/marketplace-market-data.module';
import { MarketplacePortfolioModule } from '../portfolio/marketplace-portfolio.module';
import { MarketplaceSnapshotsModule } from '../snapshots/marketplace-snapshots.module';
import { CertMarketTraceController } from './cert-market-trace.controller';
import { CertMarketTraceService } from './cert-market-trace.service';
import { CollectionMarketService } from './collection-market.service';
import { CollectionMerkleSetService } from './collection-merkle-set.service';
import { CollectionBootService } from './collection-boot.service';
import { CollectionComponentsService } from './collection-components.service';
import { CollectionCoverService } from './collection-cover.service';
import { CollectionService } from './collection.service';
import { RwaTokenRegistryService } from './rwa-token-registry.service';
import { CollectionsController } from './collections.controller';

/**
 * Collection buckets, order-book reads, cover enrichment, merkle leaves.
 * Composes market-data, snapshots, and portfolio submodules.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Order, MarketplaceCollection, RwaToken]),
    BlockchainModule,
    CardhedgerModule,
    PsaModule,
    MarketplaceMarketDataModule,
    forwardRef(() => MarketplaceSnapshotsModule),
    forwardRef(() => MarketplacePortfolioModule),
  ],
  controllers: [CollectionsController, CertMarketTraceController],
  providers: [
    MarketplaceAdminService,
    CollectionMerkleSetService,
    CollectionCoverService,
    CollectionComponentsService,
    CollectionBootService,
    CollectionService,
    RwaTokenRegistryService,
    CertMarketTraceService,
    CollectionMarketService,
  ],
  exports: [
    MarketplaceAdminService,
    CollectionService,
    RwaTokenRegistryService,
    CollectionMarketService,
  ],
})
export class MarketplaceCollectionsModule {}
