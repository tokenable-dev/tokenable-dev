import { forwardRef, Module } from '@nestjs/common';
import { CardhedgerModule } from '../cardhedger/cardhedger.module';
import { MarketplaceMarketDataModule } from '../marketplace/market-data/marketplace-market-data.module';
import { PsaController } from './psa.controller';
import { PsaPublicApiService } from './psa-public-api.service';
import { PsaService } from './psa.service';

@Module({
  imports: [CardhedgerModule, forwardRef(() => MarketplaceMarketDataModule)],
  controllers: [PsaController],
  providers: [PsaService, PsaPublicApiService],
  exports: [PsaService, PsaPublicApiService],
})
export class PsaModule {}
