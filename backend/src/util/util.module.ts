import { Module } from '@nestjs/common';
import { UtilController } from './util.controller';
import { UtilService } from './util.service';
import { PinataService } from './pinata/pinata.service';

@Module({
  controllers: [UtilController],
  providers: [UtilService, PinataService],
  exports: [PinataService],
})
export class UtilModule {}
