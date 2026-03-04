import { ConfigService } from '@nestjs/config';
import { JsonRpcProvider } from 'ethers';
import { ETHERS_PROVIDER } from '../constants/injection-tokens';

export const ethersProviderFactory = {
  provide: ETHERS_PROVIDER,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): JsonRpcProvider => {
    const rpcUrl = configService.getOrThrow<string>('BESU_RPC_URL');
    return new JsonRpcProvider(rpcUrl);
  },
};
