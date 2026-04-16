import { Module } from '@nestjs/common';
import { PoketraceService } from './poketrace.service';

@Module({
  providers: [PoketraceService],
  exports: [PoketraceService],
})
export class PoketraceModule {}
