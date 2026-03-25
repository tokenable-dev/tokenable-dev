import { Module } from '@nestjs/common';
import { PinataService } from './pinata/pinata.service';

@Module({
  providers: [PinataService],
  exports: [PinataService],
})
export class UtilModule {}
