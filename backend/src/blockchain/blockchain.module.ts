import { Module } from '@nestjs/common';
import { BlockchainController } from './blockchain.controller';
import { BlockchainService } from './blockchain.service';
import { ethersProviderFactory } from './providers/ethers-provider.factory';
import { tokenableRwaFactory } from './providers/tokenable-rwa.factory';
import { usdcFactory } from './providers/usdc.factory';

@Module({
  controllers: [BlockchainController],
  providers: [
    BlockchainService,
    ethersProviderFactory,
    usdcFactory,
    tokenableRwaFactory,
  ],
  exports: [BlockchainService],
})
export class BlockchainModule {}
