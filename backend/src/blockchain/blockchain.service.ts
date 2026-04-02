import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Contract, formatUnits } from 'ethers';
import { TOKENABLE_RWA_CONTRACT, USDC_CONTRACT } from './constants/injection-tokens';

/** OpenZeppelin ERC721 — tokenId 미민팅 시 revert */
function isErc721InvalidTokenError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const err = e as { code?: string; reason?: string; shortMessage?: string };
  const blob = `${err.code ?? ''} ${err.reason ?? ''} ${err.shortMessage ?? ''}`.toLowerCase();
  return (
    err.code === 'CALL_EXCEPTION' &&
    (blob.includes('invalid token') ||
      blob.includes('nonexistent token') ||
      blob.includes('owner query for nonexistent'))
  );
}

@Injectable()
export class BlockchainService {
  constructor(
    @Inject(USDC_CONTRACT)
    private readonly usdc: Contract,
    @Inject(TOKENABLE_RWA_CONTRACT)
    private readonly tokenableRwa: Contract,
  ) {}

  // ── USDC (Circle Sepolia USDC) ───────────────────────────────────
  async getTokenInfo(): Promise<{ name: string; symbol: string; decimals: number }> {
    const [name, symbol, decimals] = await Promise.all([
      this.usdc.name(),
      this.usdc.symbol(),
      this.usdc.decimals(),
    ]);
    return { name, symbol, decimals: Number(decimals) };
  }

  async getTotalSupply(): Promise<string> {
    const supply = await this.usdc.totalSupply();
    return formatUnits(supply, 6);
  }

  async getTokenBalance(address: string): Promise<string> {
    const balance = await this.usdc.balanceOf(address);
    return formatUnits(balance, 6);
  }

  // ── Tokenable_RWA (ERC-721) ─────────────────────────────────────
  async getRwaInfo(): Promise<{ name: string; symbol: string; totalMinted: number }> {
    const [name, symbol, totalMinted] = await Promise.all([
      this.tokenableRwa.name(),
      this.tokenableRwa.symbol(),
      this.tokenableRwa.totalMinted(),
    ]);
    return { name, symbol, totalMinted: Number(totalMinted) };
  }

  async getRwaOwner(tokenId: number): Promise<string> {
    try {
      return await this.tokenableRwa.ownerOf(tokenId);
    } catch (e: unknown) {
      if (isErc721InvalidTokenError(e)) {
        throw new NotFoundException(
          `RWA #${tokenId} does not exist on the configured contract (redeploy / contract address changed?)`,
        );
      }
      throw e;
    }
  }

  async getRwaTokenURI(tokenId: number): Promise<string> {
    try {
      return await this.tokenableRwa.tokenURI(tokenId);
    } catch (e: unknown) {
      if (isErc721InvalidTokenError(e)) {
        throw new NotFoundException(
          `RWA #${tokenId} does not exist on the configured contract (redeploy / contract address changed?)`,
        );
      }
      throw e;
    }
  }

  async getRwaBalance(address: string): Promise<number> {
    const balance = await this.tokenableRwa.balanceOf(address);
    return Number(balance);
  }

  async getRwaTokensByOwner(address: string): Promise<number[]> {
    const tokenIds: bigint[] = await this.tokenableRwa.tokensOfOwner(address);
    return tokenIds.map(Number);
  }
}
