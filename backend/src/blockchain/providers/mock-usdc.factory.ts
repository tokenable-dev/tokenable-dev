import { ConfigService } from '@nestjs/config';
import { Contract, JsonRpcProvider } from 'ethers';
import { MOCK_USDC_ABI } from '../abis/mock-usdc.abi';
import { ETHERS_PROVIDER, USDC_CONTRACT } from '../constants/injection-tokens';

export const mockUsdcFactory = {
  provide: USDC_CONTRACT,
  inject: [ETHERS_PROVIDER, ConfigService],
  useFactory: (provider: JsonRpcProvider, configService: ConfigService): Contract => {
    const address = configService.getOrThrow<string>('USDC_CONTRACT_ADDRESS');
    return new Contract(address, MOCK_USDC_ABI, provider);
  },
};
