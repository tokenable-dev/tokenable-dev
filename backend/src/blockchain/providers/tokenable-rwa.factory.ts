import { ConfigService } from '@nestjs/config';
import { Contract, JsonRpcProvider } from 'ethers';
import { TOKENABLE_RWA_ABI } from '../abis/tokenable-rwa.abi';
import {
  ETHERS_PROVIDER,
  TOKENABLE_RWA_CONTRACT,
} from '../constants/injection-tokens';

export const tokenableRwaFactory = {
  provide: TOKENABLE_RWA_CONTRACT,
  inject: [ETHERS_PROVIDER, ConfigService],
  useFactory: (
    provider: JsonRpcProvider,
    configService: ConfigService,
  ): Contract => {
    const address = configService.get<string>('RWA_CONTRACT_ADDRESS')?.trim();
    if (!address) {
      throw new Error('Set RWA_CONTRACT_ADDRESS in environment');
    }
    return new Contract(address, TOKENABLE_RWA_ABI, provider);
  },
};
