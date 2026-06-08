import { Module } from '@nestjs/common';
import { CardhedgerCatalogController } from './controllers/cardhedger-catalog.controller';
import { CardhedgerProxyController } from './controllers/cardhedger-proxy.controller';
import { CardhedgerService } from './cardhedger.service';

@Module({
  controllers: [CardhedgerCatalogController, CardhedgerProxyController],
  providers: [CardhedgerService],
  exports: [CardhedgerService],
})
export class CardhedgerModule {}
