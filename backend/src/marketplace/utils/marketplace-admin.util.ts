const DEFAULT_MARKETPLACE_ADMIN_WALLET =
  '0xd5abdd307414718c59949ac5465930a1f8a52691';

/** Wallets allowed to override collection cover images (comma-separated env). */
export function marketplaceAdminWallets(): string[] {
  const raw =
    process.env.MARKETPLACE_ADMIN_WALLETS?.trim() ||
    DEFAULT_MARKETPLACE_ADMIN_WALLET;
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^0x[a-f0-9]{40}$/.test(s));
}

export function isMarketplaceAdminWallet(
  address: string | null | undefined,
): boolean {
  const a = (address ?? '').trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(a)) return false;
  return marketplaceAdminWallets().includes(a);
}

export function assertMarketplaceAdminWallet(
  address: string | null | undefined,
): void {
  if (!isMarketplaceAdminWallet(address)) {
    throw new Error('MARKETPLACE_ADMIN_FORBIDDEN');
  }
}
