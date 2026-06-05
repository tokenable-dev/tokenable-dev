import { Module } from '@nestjs/common';
import { CardhedgerService } from './cardhedger.service';

@Module({
  providers: [CardhedgerService],
  exports: [CardhedgerService],
})
export class CardhedgerModule {}
