import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CardhedgerCatalogController } from './controllers/cardhedger-catalog.controller';
import { CardhedgerProxyController } from './controllers/cardhedger-proxy.controller';
import { CardTop100Controller } from './controllers/card-top100.controller';
import { CardhedgerService } from './cardhedger.service';
import { CardTop100Service } from './card-top100.service';
import { CardTop100DailySnapshot } from './entities/card-top100-snapshot.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CardTop100DailySnapshot])],
  controllers: [CardhedgerCatalogController, CardhedgerProxyController, CardTop100Controller],
  providers: [CardhedgerService, CardTop100Service],
  exports: [CardhedgerService],
})
export class CardhedgerModule {}
