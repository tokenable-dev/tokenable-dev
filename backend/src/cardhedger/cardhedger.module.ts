import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CardhedgerCatalogController } from './controllers/cardhedger-catalog.controller';
import { CardhedgerProxyController } from './controllers/cardhedger-proxy.controller';
import { CardTop100Controller } from './controllers/card-top100.controller';
import { CardTopMoversController } from './controllers/card-top-movers.controller';
import { CardhedgerService } from './cardhedger.service';
import { CardTop100Service } from './card-top100.service';
import { CardTopMoversService } from './card-top-movers.service';
import { CardTop100DailySnapshot } from './entities/card-top100-snapshot.entity';

import { CardhedgerPriceInfraModule } from './cardhedger-price-infra.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CardTop100DailySnapshot]),
    forwardRef(() => CardhedgerPriceInfraModule),
  ],
  controllers: [
    CardhedgerCatalogController,
    CardhedgerProxyController,
    CardTop100Controller,
    CardTopMoversController,
  ],
  providers: [CardhedgerService, CardTop100Service, CardTopMoversService],
  exports: [CardhedgerService, CardhedgerPriceInfraModule],
})
export class CardhedgerModule {}
