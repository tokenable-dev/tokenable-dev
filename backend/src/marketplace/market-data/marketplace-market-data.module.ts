import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainModule } from '../../blockchain/blockchain.module';
import { CardhedgerModule } from '../../cardhedger/cardhedger.module';
import { PsaModule } from '../../psa/psa.module';
import { PsaCertSnapshot } from '../entities/psa-cert-snapshot.entity';
import { PsaCertSnapshotService } from '../collections/psa-cert-snapshot.service';
import { CardhedgerAiInsightService } from './cardhedger-ai-insight.service';
import { CardhedgerMarketDataService } from './cardhedger-market-data.service';
import { CardhedgerResolveService } from './cardhedger-resolve.service';
import { CardhedgerPricingService } from './cardhedger-pricing.service';
import { CardhedgerMintService } from './cardhedger-mint.service';

/** Cardhedger resolve, preview, comps, PSA cert DB cache, and mint previews for marketplace pricing. */
@Module({
  imports: [
    TypeOrmModule.forFeature([PsaCertSnapshot]),
    CardhedgerModule,
    BlockchainModule,
    PsaModule,
  ],
  providers: [
    PsaCertSnapshotService,
    CardhedgerResolveService,
    CardhedgerPricingService,
    CardhedgerMintService,
    CardhedgerMarketDataService,
    CardhedgerAiInsightService,
  ],
  exports: [
    PsaCertSnapshotService,
    CardhedgerMarketDataService,
    CardhedgerAiInsightService,
  ],
})
export class MarketplaceMarketDataModule {}
