import type { AuthUser } from "./auth";
import { userHasLinkedWallet } from "./wallets";

export type AccountAccessLevel = 0 | 1 | 2;

/** Internal dev account — pre-launch feature testing (KYC bypass, chain switcher). */
const INTERNAL_DEV_EMAILS = new Set(["tokenable.dev@gmail.com"]);

function normalizeAuthEmail(email: string | null | undefined): string {
  return email?.trim().toLowerCase() ?? "";
}

export function isInternalDevUser(user: AuthUser | null | undefined): boolean {
  const email = normalizeAuthEmail(user?.email);
  return email.length > 0 && INTERNAL_DEV_EMAILS.has(email);
}

export function isKycDevBypassUser(user: AuthUser | null | undefined): boolean {
  return isInternalDevUser(user);
}

/** Amoy ↔ Polygon mainnet picker — internal dev only until public launch. */
export function canUseAppChainSwitcher(user: AuthUser | null | undefined): boolean {
  return isInternalDevUser(user);
}

/**
 * KYC completion — synced from backend `kyc_status` (Privy identity verification in Phase 5).
 * `tokenable.dev@gmail.com` bypasses for local/staging feature testing.
 */
export function isKycComplete(user: AuthUser | null | undefined): boolean {
  if (isKycDevBypassUser(user)) return true;
  return user?.kycStatus === "approved";
}

export function deriveAccountAccessLevel(
  user: AuthUser | null | undefined,
): AccountAccessLevel {
  if (!user) return 0;
  if (!userHasLinkedWallet(user)) return 0;
  if (!isKycComplete(user)) return 1;
  return 2;
}

export function hasLinkedWallet(user: AuthUser | null | undefined): boolean {
  return userHasLinkedWallet(user);
}

export type HeaderNavMinLevel = 0 | 1 | 2;

export type HeaderNavGateResult =
  | { action: "allow" }
  | { action: "sign-in"; returnTo: string }
  | { action: "connect-wallet"; returnTo: string }
  | { action: "kyc"; returnTo: string };

/** Header nav click — maps IA account levels to the modal to show. */
export function resolveHeaderNavGate(
  user: AuthUser | null | undefined,
  minLevel: HeaderNavMinLevel,
  href: string,
): HeaderNavGateResult {
  if (minLevel === 0) return { action: "allow" };

  if (!user) {
    return { action: "sign-in", returnTo: href };
  }

  if (minLevel >= 1 && !hasLinkedWallet(user)) {
    return { action: "connect-wallet", returnTo: href };
  }

  if (minLevel >= 2 && !isKycComplete(user)) {
    return { action: "kyc", returnTo: href };
  }

  return { action: "allow" };
}
