import { Inject, Injectable } from '@nestjs/common';
import { Contract, formatEther } from 'ethers';
import { SKY_TOKEN_CONTRACT } from './constants/injection-tokens';

@Injectable()
export class BlockchainService {
  constructor(
    @Inject(SKY_TOKEN_CONTRACT)
    private readonly skyToken: Contract,
  ) {}

  async getTokenInfo(): Promise<{
    name: string;
    symbol: string;
    decimals: number;
  }> {
    const [name, symbol, decimals] = await Promise.all([
      this.skyToken.name(),
      this.skyToken.symbol(),
      this.skyToken.decimals(),
    ]);
    return { name, symbol, decimals: Number(decimals) };
  }

  async getTotalSupply(): Promise<string> {
    const supply = await this.skyToken.totalSupply();
    return formatEther(supply);
  }

  async getBalance(address: string): Promise<string> {
    const balance = await this.skyToken.balanceOf(address);
    return formatEther(balance);
  }
}
