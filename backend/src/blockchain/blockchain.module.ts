import { Module } from '@nestjs/common';
import { BlockchainController } from './blockchain.controller';
import { BlockchainService } from './blockchain.service';
import { ethersProviderFactory } from './providers/ethers-provider.factory';
import { skyNftFactory } from './providers/sky-nft.factory';
import { mockUsdcFactory } from './providers/mock-usdc.factory';
import { skyMarketplaceFactory } from './providers/sky-marketplace.factory';

@Module({
  controllers: [BlockchainController],
  providers: [
    BlockchainService,
    ethersProviderFactory,
    mockUsdcFactory,
    skyNftFactory,
    skyMarketplaceFactory,
  ],
  exports: [BlockchainService],
})
export class BlockchainModule {}
