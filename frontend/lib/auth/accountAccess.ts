import type { AuthUser } from "./auth";
import { userHasLinkedWallet } from "./wallets";

export type AccountAccessLevel = 0 | 1 | 2;

/**
 * Internal staging bypass for KYC + chain switcher.
 * Must stay in sync with `backend/src/kyc/utils/kyc-gate.util.ts` (remove before mainnet).
 */
const INTERNAL_DEV_EMAILS = new Set(["tokenable.dev@gmail.com"]);

function normalizeAuthEmail(email: string | null | undefined): string {
  return email?.trim().toLowerCase() ?? "";
}

export function isInternalDevUser(user: AuthUser | null | undefined): boolean {
  const email = normalizeAuthEmail(user?.email);
  return email.length > 0 && INTERNAL_DEV_EMAILS.has(email);
}

/** Sepolia ↔ Ethereum mainnet picker — internal dev only until public launch. */
export function canUseAppChainSwitcher(user: AuthUser | null | undefined): boolean {
  return isInternalDevUser(user);
}

/** KYC Level 2 — `users.kyc_status === approved` (or staging bypass). */
export function isKycComplete(user: AuthUser | null | undefined): boolean {
  if (isInternalDevUser(user)) return true;
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
