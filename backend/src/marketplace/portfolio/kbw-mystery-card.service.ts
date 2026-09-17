import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KbwMysteryCardBurn } from '../entities/kbw-mystery-card-burn.entity';

@Injectable()
export class KbwMysteryCardService {
  constructor(
    @InjectRepository(KbwMysteryCardBurn)
    private readonly burns: Repository<KbwMysteryCardBurn>,
  ) {}

  private normalizeWallet(walletAddress: string): string {
    return walletAddress.trim().toLowerCase();
  }

  async isBurned(walletAddress: string): Promise<boolean> {
    const wallet = this.normalizeWallet(walletAddress);
    if (!wallet) return false;
    const row = await this.burns.findOne({ where: { walletAddress: wallet } });
    return Boolean(row);
  }

  async burn(walletAddress: string): Promise<{ burned: true; alreadyBurned: boolean }> {
    const wallet = this.normalizeWallet(walletAddress);
    if (!wallet) {
      return { burned: true, alreadyBurned: false };
    }
    const existing = await this.burns.findOne({ where: { walletAddress: wallet } });
    if (existing) {
      return { burned: true, alreadyBurned: true };
    }
    await this.burns.save(this.burns.create({ walletAddress: wallet }));
    return { burned: true, alreadyBurned: false };
  }
}
