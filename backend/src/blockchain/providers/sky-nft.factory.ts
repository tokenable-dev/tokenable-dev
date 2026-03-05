import { ConfigService } from '@nestjs/config';
import { Contract, JsonRpcProvider } from 'ethers';
import { SKY_NFT_ABI } from '../abis/sky-nft.abi';
import { ETHERS_PROVIDER, SKY_NFT_CONTRACT } from '../constants/injection-tokens';

export const skyNftFactory = {
  provide: SKY_NFT_CONTRACT,
  inject: [ETHERS_PROVIDER, ConfigService],
  useFactory: (provider: JsonRpcProvider, configService: ConfigService): Contract => {
    const address = configService.getOrThrow<string>('NFT_CONTRACT_ADDRESS');
    return new Contract(address, SKY_NFT_ABI, provider);
  },
};
