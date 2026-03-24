import { ConfigService } from '@nestjs/config';
import { Contract, JsonRpcProvider } from 'ethers';
import { ERC20_ABI } from '../abis/erc20.abi';
import { ETHERS_PROVIDER, USDC_CONTRACT } from '../constants/injection-tokens';

export const usdcFactory = {
  provide: USDC_CONTRACT,
  inject: [ETHERS_PROVIDER, ConfigService],
  useFactory: (provider: JsonRpcProvider, configService: ConfigService): Contract => {
    const address = configService.getOrThrow<string>('USDC_CONTRACT_ADDRESS');
    return new Contract(address, ERC20_ABI, provider);
  },
};
