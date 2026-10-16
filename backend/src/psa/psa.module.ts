import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CardhedgerModule } from '../cardhedger/cardhedger.module';
import { MarketplaceCollection } from '../marketplace/entities/marketplace-collection.entity';
import { PsaController } from './psa.controller';
import { PsaPublicApiService } from './psa-public-api.service';
import { PsaService } from './psa.service';
import { PsaSpecPopulationCaptureService } from './psa-spec-population-capture.service';

@Module({
  imports: [
    CardhedgerModule,
    TypeOrmModule.forFeature([MarketplaceCollection]),
  ],
  controllers: [PsaController],
  providers: [PsaService, PsaPublicApiService, PsaSpecPopulationCaptureService],
  exports: [PsaService, PsaPublicApiService, PsaSpecPopulationCaptureService],
})
export class PsaModule {}
