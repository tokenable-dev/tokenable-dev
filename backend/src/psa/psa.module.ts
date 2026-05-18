import { Module } from '@nestjs/common';
import { CardhedgerModule } from '../cardhedger/cardhedger.module';
import { PsaController } from './psa.controller';
import { PsaPublicApiService } from './psa-public-api.service';
import { PsaSpecScraperService } from './psa-spec-scraper.service';
import { PsaService } from './psa.service';

@Module({
  imports: [CardhedgerModule],
  controllers: [PsaController],
  providers: [PsaService, PsaPublicApiService, PsaSpecScraperService],
  exports: [PsaService, PsaPublicApiService, PsaSpecScraperService],
})
export class PsaModule {}
