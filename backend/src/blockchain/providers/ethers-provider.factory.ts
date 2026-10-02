import { ChainConfigService } from '../chain-config.service';
import { ETHERS_PROVIDER } from '../constants/injection-tokens';

export const ethersProviderFactory = {
  provide: ETHERS_PROVIDER,
  inject: [ChainConfigService],
  useFactory: (chainConfig: ChainConfigService) =>
    chainConfig.createJsonRpcProvider(),
};
