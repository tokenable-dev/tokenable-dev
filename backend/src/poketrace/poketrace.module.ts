import { Module } from '@nestjs/common';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { PoketraceService } from './poketrace.service';

@Module({
  imports: [BlockchainModule],
  providers: [PoketraceService],
  exports: [PoketraceService],
})
export class PoketraceModule {}
