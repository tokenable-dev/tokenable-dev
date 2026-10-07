import type { AuthUser } from "./auth";
import { getUserLinkedWallets } from "./wallets";

/** Synthetic email for MetaMask / wallet-only Privy accounts — not a real inbox. */
const WALLET_ONLY_EMAIL_SUFFIX = "@privy.wallet";

export function isWalletOnlyPlaceholderEmail(
  email: string | null | undefined,
): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(WALLET_ONLY_EMAIL_SUFFIX);
}

/**
 * Wallet / MetaMask accounts must add a real inbox before event follow-up modals.
 * Mobile Privy sync can briefly return a linked wallet before `@privy.wallet` email is set.
 */
export function userNeedsContactEmail(
  user: AuthUser | null | undefined,
): boolean {
  if (!user) return false;
  if (isWalletOnlyPlaceholderEmail(user.email)) return true;
  const trimmed = user.email?.trim();
  if (!trimmed && getUserLinkedWallets(user).length > 0) return true;
  return false;
}
