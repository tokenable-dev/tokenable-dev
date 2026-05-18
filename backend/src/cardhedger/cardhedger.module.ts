import { Module } from '@nestjs/common';
import { CardhedgerIndexesController } from './controllers/indexes.controller';
import { CardhedgerIndexesService } from './indexes.service';
import { CardhedgerService } from './cardhedger.service';

@Module({
  controllers: [CardhedgerIndexesController],
  providers: [CardhedgerService, CardhedgerIndexesService],
  exports: [CardhedgerService, CardhedgerIndexesService],
})
export class CardhedgerModule {}
