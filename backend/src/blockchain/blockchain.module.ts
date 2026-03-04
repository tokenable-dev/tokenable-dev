import { Module } from '@nestjs/common';
import { BlockchainController } from './blockchain.controller';
import { BlockchainService } from './blockchain.service';
import { ethersProviderFactory } from './providers/ethers-provider.factory';
import { skyTokenFactory } from './providers/sky-token.factory';

@Module({
  controllers: [BlockchainController],
  providers: [BlockchainService, ethersProviderFactory, skyTokenFactory],
  exports: [BlockchainService],
})
export class BlockchainModule {}
