/** Default admin wallet (override via NEXT_PUBLIC_MARKETPLACE_ADMIN_WALLETS). */
const DEFAULT_ADMIN = "0xd5abdd307414718c59949ac5465930a1f8a52691";

export function marketplaceAdminWallets(): string[] {
  const raw =
    (typeof process !== "undefined" &&
      process.env.NEXT_PUBLIC_MARKETPLACE_ADMIN_WALLETS?.trim()) ||
    DEFAULT_ADMIN;
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^0x[a-f0-9]{40}$/.test(s));
}

export function isMarketplaceAdminWallet(
  address: string | null | undefined,
): boolean {
  const a = (address ?? "").trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(a)) return false;
  return marketplaceAdminWallets().includes(a);
}
