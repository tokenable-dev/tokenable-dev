import { Contract, JsonRpcProvider } from 'ethers';
import { ChainConfigService } from '../chain-config.service';
import { TOKENABLE_RWA_ABI } from '../abis/tokenable-rwa.abi';
import {
  ETHERS_PROVIDER,
  TOKENABLE_RWA_CONTRACT,
} from '../constants/injection-tokens';

export const tokenableRwaFactory = {
  provide: TOKENABLE_RWA_CONTRACT,
  inject: [ETHERS_PROVIDER, ChainConfigService],
  useFactory: (
    provider: JsonRpcProvider,
    chainConfig: ChainConfigService,
  ): Contract => {
    const chainId = chainConfig.getDefaultChainId();
    const address = chainConfig.getRwaAddress(chainId);
    return new Contract(address, TOKENABLE_RWA_ABI, provider);
  },
};
