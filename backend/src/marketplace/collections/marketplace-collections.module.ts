import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainModule } from '../../blockchain/blockchain.module';
import { CardhedgerModule } from '../../cardhedger/cardhedger.module';
import { PsaModule } from '../../psa/psa.module';
import { VaultCycle } from '../../vault/entities/vault-cycle.entity';
import { VaultModule } from '../../vault/vault.module';
import { UserModule } from '../../user/user.module';
import { MarketplaceAdminModule } from '../admin/marketplace-admin.module';
import { Order } from '../entities/order.entity';
import { MarketplaceCollection } from '../entities/marketplace-collection.entity';
import { RwaToken } from '../entities/rwa-token.entity';
import { MarketplaceMarketDataModule } from '../market-data/marketplace-market-data.module';
import { MarketplaceSnapshotsModule } from '../snapshots/marketplace-snapshots.module';
import { CertMarketTraceController } from './cert-market-trace.controller';
import { CertMarketTraceService } from './cert-market-trace.service';
import { CollectionMarketService } from './collection-market.service';
import { CollectionMerkleSetService } from './collection-merkle-set.service';
import { CollectionBootService } from './collection-boot.service';
import { CollectionComponentsService } from './collection-components.service';
import { CollectionCoverService } from './collection-cover.service';
import { CollectionEnrichmentService } from './collection-enrichment.service';
import { CollectionIdentityService } from './collection-identity.service';
import { IdentityCacheDecisionEngine } from './identity-cache-decision.engine';
import { IdentityCacheExecutionService } from './identity-cache-execution.service';
import { IdentityCacheReconciliationService } from './identity-cache-reconciliation.service';
import { IdentityCacheSloService } from './identity-cache-slo.service';
import { IdentityCacheWarmupService } from './identity-cache-warmup.service';
import { IdentityStructuredLogger } from './identity-structured-logger';
import {
  IDENTITY_CACHE_PROVIDER,
  InProcessIdentityCacheProvider,
} from './identity-cache.provider';
import { LayeredIdentityCacheProvider } from './layered-identity-cache.provider';
import { RedisIdentityCacheProvider } from './redis-identity-cache.provider';
import { CollectionService } from './collection.service';
import { RwaTokenRegistryService } from './rwa-token-registry.service';
import { CollectionsController } from './collections.controller';
import { RwaTokenAdminController } from './rwa-token-admin.controller';
import { RwaTokenAdminService } from './rwa-token-admin.service';
import { MintEventListenerService } from './mint-event-listener.service';

/**
 * Collection buckets, order-book reads, cover enrichment, merkle leaves.
 * Composes market-data, snapshots, and portfolio submodules.
 *
 * forwardRef(MarketplaceSnapshotsModule): CollectionMarketService depends on the
 * three snapshot services (CollectionMarketSnapshotService, Read, Scheduler).
 * MarketplaceSnapshotsModule also imports this module (for CollectionEnrichmentService),
 * creating a circular module dependency. forwardRef on both sides is the NestJS-
 * recommended way to handle this pattern without changing service boundaries.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Order, MarketplaceCollection, RwaToken, VaultCycle]),
    MarketplaceAdminModule,
    BlockchainModule,
    CardhedgerModule,
    PsaModule,
    VaultModule,
    UserModule,
    MarketplaceMarketDataModule,
    forwardRef(() => MarketplaceSnapshotsModule),
  ],
  controllers: [
    CollectionsController,
    CertMarketTraceController,
    RwaTokenAdminController,
  ],
  providers: [
    InProcessIdentityCacheProvider,
    RedisIdentityCacheProvider,
    LayeredIdentityCacheProvider,
    {
      provide: IDENTITY_CACHE_PROVIDER,
      useExisting: LayeredIdentityCacheProvider,
    },
    CollectionIdentityService,
    IdentityCacheDecisionEngine,
    IdentityCacheExecutionService,
    IdentityCacheReconciliationService,
    IdentityCacheSloService,
    IdentityCacheWarmupService,
    IdentityStructuredLogger,
    CollectionMerkleSetService,
    CollectionCoverService,
    CollectionComponentsService,
    CollectionBootService,
    CollectionService,
    CollectionEnrichmentService,
    RwaTokenRegistryService,
    RwaTokenAdminService,
    CertMarketTraceService,
    CollectionMarketService,
    MintEventListenerService,
  ],
  exports: [
    CollectionService,
    CollectionEnrichmentService,
    RwaTokenRegistryService,
    CollectionMarketService,
  ],
})
export class MarketplaceCollectionsModule {}
