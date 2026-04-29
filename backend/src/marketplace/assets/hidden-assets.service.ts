import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { HiddenAsset } from '../entities/hidden-asset.entity';

@Injectable()
export class HiddenAssetsService {
  constructor(
    @InjectRepository(HiddenAsset)
    private readonly hiddenRepo: Repository<HiddenAsset>,
  ) {}

  private normalizeWallet(addr: string): string {
    return String(addr ?? '').trim().toLowerCase();
  }

  async listTokenIds(walletAddress: string): Promise<number[]> {
    const wallet = this.normalizeWallet(walletAddress);
    if (!wallet) return [];
    const rows = await this.hiddenRepo.find({
      where: { walletAddress: wallet },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => Number(r.tokenId)).filter((n) => Number.isFinite(n) && n >= 0);
  }

  async hide(walletAddress: string, tokenId: number): Promise<{ ok: true }> {
    const wallet = this.normalizeWallet(walletAddress);
    if (!wallet || !Number.isFinite(tokenId) || tokenId < 0) return { ok: true };
    try {
      await this.hiddenRepo.insert({ walletAddress: wallet, tokenId: Math.floor(tokenId) });
    } catch (e) {
      if (!(e instanceof QueryFailedError)) throw e;
      // Duplicate unique key -> already hidden; treat as success.
    }
    return { ok: true };
  }

  async unhide(walletAddress: string, tokenId: number): Promise<{ ok: true }> {
    const wallet = this.normalizeWallet(walletAddress);
    if (!wallet || !Number.isFinite(tokenId) || tokenId < 0) return { ok: true };
    await this.hiddenRepo.delete({ walletAddress: wallet, tokenId: Math.floor(tokenId) });
    return { ok: true };
  }
}
