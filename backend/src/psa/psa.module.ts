import { Module } from '@nestjs/common';
import { PriceModule } from '../price/price.module';
import { PsaController } from './psa.controller';
import { PsaPublicApiService } from './psa-public-api.service';
import { PsaService } from './psa.service';

@Module({
  imports: [PriceModule],
  controllers: [PsaController],
  providers: [PsaService, PsaPublicApiService],
  exports: [PsaService, PsaPublicApiService],
})
export class PsaModule {}
