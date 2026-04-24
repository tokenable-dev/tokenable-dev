import { Module } from '@nestjs/common';
import { PriceModule } from '../price/price.module';
import { PoketraceModule } from '../poketrace/poketrace.module';
import { PsaController } from './psa.controller';
import { PsaPublicApiService } from './psa-public-api.service';
import { PsaService } from './psa.service';

@Module({
  imports: [PriceModule, PoketraceModule],
  controllers: [PsaController],
  providers: [PsaService, PsaPublicApiService],
  exports: [PsaService, PsaPublicApiService],
})
export class PsaModule {}
