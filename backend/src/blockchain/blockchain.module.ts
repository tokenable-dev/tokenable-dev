import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RwaToken } from '../marketplace/entities/rwa-token.entity';
import { BlockchainController } from './blockchain.controller';
import { BlockchainService } from './blockchain.service';
import { IpfsGatewayResolverService } from './ipfs-gateway-resolver.service';
import { RwaAssetResolveService } from './rwa-asset-resolve.service';
import { RwaChainWriterService } from './rwa-chain-writer.service';
import { ethersProviderFactory } from './providers/ethers-provider.factory';
import { tokenableRwaFactory } from './providers/tokenable-rwa.factory';
import { ChainConfigService } from './chain-config.service';
import { TOKENABLE_RWA_CONTRACT } from './constants/injection-tokens';

@Module({
  imports: [TypeOrmModule.forFeature([RwaToken])],
  controllers: [BlockchainController],
  providers: [
    IpfsGatewayResolverService,
    BlockchainService,
    RwaAssetResolveService,
    RwaChainWriterService,
    ethersProviderFactory,
    tokenableRwaFactory,
    ChainConfigService,
  ],
  exports: [
    BlockchainService,
    IpfsGatewayResolverService,
    RwaAssetResolveService,
    RwaChainWriterService,
    TOKENABLE_RWA_CONTRACT,
    ChainConfigService,
  ],
})
export class BlockchainModule {}
