import { ConfigService } from '@nestjs/config';
import { Contract, JsonRpcProvider } from 'ethers';
import { SKY_TOKEN_ABI } from '../abis/sky-token.abi';
import {
  ETHERS_PROVIDER,
  SKY_TOKEN_CONTRACT,
} from '../constants/injection-tokens';

export const skyTokenFactory = {
  provide: SKY_TOKEN_CONTRACT,
  inject: [ETHERS_PROVIDER, ConfigService],
  useFactory: (
    provider: JsonRpcProvider,
    configService: ConfigService,
  ): Contract => {
    const address = configService.getOrThrow<string>('SKY_TOKEN_ADDRESS');
    return new Contract(address, SKY_TOKEN_ABI, provider);
  },
};
