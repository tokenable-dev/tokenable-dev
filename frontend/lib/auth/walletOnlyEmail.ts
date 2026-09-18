/** Synthetic email for MetaMask / wallet-only Privy accounts — not a real inbox. */
const WALLET_ONLY_EMAIL_SUFFIX = "@privy.wallet";

export function isWalletOnlyPlaceholderEmail(
  email: string | null | undefined,
): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(WALLET_ONLY_EMAIL_SUFFIX);
}
