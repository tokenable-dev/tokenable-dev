import { Module } from '@nestjs/common';
import { BlockchainController } from './blockchain.controller';
import { BlockchainService } from './blockchain.service';
import { IpfsGatewayResolverService } from './ipfs-gateway-resolver.service';
import { ethersProviderFactory } from './providers/ethers-provider.factory';
import { tokenableRwaFactory } from './providers/tokenable-rwa.factory';
import { usdcFactory } from './providers/usdc.factory';

@Module({
  controllers: [BlockchainController],
  providers: [
    IpfsGatewayResolverService,
    BlockchainService,
    ethersProviderFactory,
    usdcFactory,
    tokenableRwaFactory,
  ],
  exports: [BlockchainService, IpfsGatewayResolverService],
})
export class BlockchainModule {}
