import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainModule } from '../../blockchain/blockchain.module';
import { CardhedgerModule } from '../../cardhedger/cardhedger.module';
import { CardTop100DailySnapshot } from '../../cardhedger/entities/card-top100-snapshot.entity';
import { PsaModule } from '../../psa/psa.module';
import { UserWatchlist } from '../entities/user-watchlist.entity';
import { CardhedgerAiInsightEnrichmentService } from './cardhedger-ai-insight-enrichment.service';
import { CardhedgerAiInsightService } from './cardhedger-ai-insight.service';
import { CardhedgerMarketDataService } from './cardhedger-market-data.service';
import { CardhedgerResolveService } from './cardhedger-resolve.service';
import { CardhedgerPricingService } from './cardhedger-pricing.service';
import { CardhedgerCertLookupService } from './cardhedger-cert-lookup.service';
import { CardhedgerCertPricingService } from './cardhedger-cert-pricing.service';
import { CardhedgerMintService } from './cardhedger-mint.service';

/** Cardhedger resolve, preview, comps, and mint previews for marketplace pricing. */
@Module({
  imports: [
    TypeOrmModule.forFeature([UserWatchlist, CardTop100DailySnapshot]),
    CardhedgerModule,
    BlockchainModule,
    forwardRef(() => PsaModule),
  ],
  providers: [
    CardhedgerCertLookupService,
    CardhedgerCertPricingService,
    CardhedgerResolveService,
    CardhedgerPricingService,
    CardhedgerMintService,
    CardhedgerMarketDataService,
    CardhedgerAiInsightEnrichmentService,
    CardhedgerAiInsightService,
  ],
  exports: [
    CardhedgerMarketDataService,
    CardhedgerAiInsightService,
    CardhedgerAiInsightEnrichmentService,
  ],
})
export class MarketplaceMarketDataModule {}
