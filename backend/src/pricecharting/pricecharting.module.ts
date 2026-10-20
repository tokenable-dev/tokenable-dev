import { Module } from '@nestjs/common';
import { PricechartingProxyController } from './controllers/pricecharting-proxy.controller';
import { PricechartingService } from './pricecharting.service';

/**
 * PriceCharting Prices HTTP proxy (product / products / csv).
 * Marketplace upstream is not exposed — unrelated to Tokenable vault/Seaport.
 */
@Module({
  controllers: [PricechartingProxyController],
  providers: [PricechartingService],
  exports: [PricechartingService],
})
export class PricechartingModule {}
