import type { AuthUser } from "./auth";
import { getUserLinkedWallets, userHasLinkedWallet } from "./wallets";

export type AccountAccessLevel = 0 | 1 | 2;

/**
 * Internal staging bypass for KYC + chain switcher.
 * Must stay in sync with `backend/src/kyc/utils/kyc-gate.util.ts` (remove before mainnet).
 */
const INTERNAL_DEV_EMAILS = new Set([
  "tokenable.dev@gmail.com",
  "ekvkd88@gmail.com",
  "giunssen@gmail.com",
  "dev@tokenable.io",
  "jongnam0309@gmail.com",
]);

/** MetaMask / external wallets used by the team (wallet-only Privy accounts). */
const INTERNAL_DEV_WALLETS = new Set([
  "0xd5abdd307414718c59949ac5465930a1f8a52691",
]);

function normalizeAuthEmail(email: string | null | undefined): string {
  return email?.trim().toLowerCase() ?? "";
}

function normalizeDevWallet(address: string | null | undefined): string {
  return address?.trim().toLowerCase() ?? "";
}

function userHasInternalDevWallet(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  const primary = normalizeDevWallet(user.walletAddress);
  if (primary && INTERNAL_DEV_WALLETS.has(primary)) return true;
  return getUserLinkedWallets(user).some((w) => {
    const addr = normalizeDevWallet(w.address);
    return addr.length > 0 && INTERNAL_DEV_WALLETS.has(addr);
  });
}

export function isInternalDevUser(user: AuthUser | null | undefined): boolean {
  const email = normalizeAuthEmail(user?.email);
  if (email.length > 0 && INTERNAL_DEV_EMAILS.has(email)) return true;
  return userHasInternalDevWallet(user);
}

/** Sepolia ↔ Ethereum ↔ Polygon picker — internal dev only until public launch. */
export function canUseAppChainSwitcher(user: AuthUser | null | undefined): boolean {
  return isInternalDevUser(user);
}

/** KYC Level 2 — Sumsub `approved` on reconciled session (see GET /api/kyc/status). */
export function isKycComplete(user: AuthUser | null | undefined): boolean {
  return user?.kycStatus === "approved";
}

export type HeaderNavMinLevel = 0 | 1 | 2;

export type HeaderNavGateResult =
  | { action: "allow" }
  | { action: "sign-in"; returnTo: string }
  | { action: "connect-wallet"; returnTo: string }
  | { action: "kyc"; returnTo: string };

/** Header nav / access gates — maps min level to the modal to show. */
export function resolveHeaderNavGate(
  user: AuthUser | null | undefined,
  minLevel: HeaderNavMinLevel,
  href: string,
): HeaderNavGateResult {
  if (minLevel === 0) return { action: "allow" };

  if (!user) {
    return { action: "sign-in", returnTo: href };
  }

  if (minLevel >= 1 && !userHasLinkedWallet(user)) {
    return { action: "connect-wallet", returnTo: href };
  }

  if (minLevel >= 2 && !isKycComplete(user)) {
    return { action: "kyc", returnTo: href };
  }

  return { action: "allow" };
}
