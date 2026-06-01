import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MarketplaceAdminService {
  constructor(private readonly config: ConfigService) {}

  adminWallets(): string[] {
    const wallets = this.config.get<string[]>('marketplace.adminWallets');
    return wallets?.length ? wallets : [];
  }

  isAdminWallet(address: string | null | undefined): boolean {
    const a = (address ?? '').trim().toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(a)) return false;
    return this.adminWallets().includes(a);
  }

  assertAdminWallet(address: string | null | undefined): void {
    if (!this.isAdminWallet(address)) {
      throw new ForbiddenException('Admin wallet not authorized');
    }
  }
}
