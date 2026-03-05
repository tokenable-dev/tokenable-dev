import { ConfigService } from '@nestjs/config';
import { Contract, JsonRpcProvider } from 'ethers';
import { SKY_MARKETPLACE_ABI } from '../abis/sky-marketplace.abi';
import { ETHERS_PROVIDER, MARKETPLACE_CONTRACT } from '../constants/injection-tokens';

export const skyMarketplaceFactory = {
  provide: MARKETPLACE_CONTRACT,
  inject: [ETHERS_PROVIDER, ConfigService],
  useFactory: (provider: JsonRpcProvider, configService: ConfigService): Contract => {
    const address = configService.getOrThrow<string>('MARKETPLACE_ADDRESS');
    return new Contract(address, SKY_MARKETPLACE_ABI, provider);
  },
};
