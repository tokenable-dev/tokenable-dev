import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PortfolioHiddenHolding } from '../entities/portfolio-hidden-holding.entity';

@Injectable()
export class PortfolioHiddenHoldingService {
  constructor(
    @InjectRepository(PortfolioHiddenHolding)
    private readonly hiddenRepo: Repository<PortfolioHiddenHolding>,
  ) {}

  private normalizeWallet(walletAddress: string): string {
    return walletAddress.trim().toLowerCase();
  }

  async listHiddenTokenIds(walletAddress: string): Promise<number[]> {
    const wallet = this.normalizeWallet(walletAddress);
    if (!wallet) return [];
    const rows = await this.hiddenRepo.find({
      where: { walletAddress: wallet },
      order: { hiddenAt: 'DESC' },
    });
    return rows.map((r) => r.tokenId);
  }

  async hide(walletAddress: string, tokenId: number): Promise<void> {
    const wallet = this.normalizeWallet(walletAddress);
    if (!wallet) return;
    const tid = Math.max(0, Math.floor(Number(tokenId)));
    await this.hiddenRepo.upsert(
      { walletAddress: wallet, tokenId: tid },
      ['walletAddress', 'tokenId'],
    );
  }

  async unhide(walletAddress: string, tokenId: number): Promise<void> {
    const wallet = this.normalizeWallet(walletAddress);
    if (!wallet) return;
    const tid = Math.max(0, Math.floor(Number(tokenId)));
    await this.hiddenRepo.delete({ walletAddress: wallet, tokenId: tid });
  }

  async filterVisibleTokenIds(
    walletAddress: string,
    tokenIds: number[],
  ): Promise<number[]> {
    const wallet = this.normalizeWallet(walletAddress);
    if (!wallet || tokenIds.length === 0) return tokenIds;
    const hidden = new Set(await this.listHiddenTokenIds(wallet));
    if (hidden.size === 0) return tokenIds;
    return tokenIds.filter((id) => !hidden.has(id));
  }
}
