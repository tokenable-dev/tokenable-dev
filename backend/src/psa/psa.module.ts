import { Module } from '@nestjs/common';
import { CardhedgerModule } from '../cardhedger/cardhedger.module';
import { PsaCollectorsSessionService } from './psa-collectors-session.service';
import { PsaController } from './psa.controller';
import { PsaPublicApiService } from './psa-public-api.service';
import { PsaCertEstimateScraperService } from './psa-cert-estimate-scraper.service';
import { PsaSpecScraperService } from './psa-spec-scraper.service';
import { PsaService } from './psa.service';

@Module({
  imports: [CardhedgerModule],
  controllers: [PsaController],
  providers: [
    PsaService,
    PsaPublicApiService,
    PsaCollectorsSessionService,
    PsaSpecScraperService,
    PsaCertEstimateScraperService,
  ],
  exports: [
    PsaService,
    PsaPublicApiService,
    PsaCollectorsSessionService,
    PsaSpecScraperService,
    PsaCertEstimateScraperService,
  ],
})
export class PsaModule {}
