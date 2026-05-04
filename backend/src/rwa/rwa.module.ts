import { Module } from '@nestjs/common';
import { PinataService } from './pinata/pinata.service';
import { RwaController } from './rwa.controller';
import { RwaService } from './rwa.service';

@Module({
  controllers: [RwaController],
  providers: [PinataService, RwaService],
})
export class RwaModule {}
