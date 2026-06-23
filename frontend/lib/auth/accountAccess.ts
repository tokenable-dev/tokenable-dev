import type { AuthUser } from "./auth";
import { userHasLinkedWallet } from "./wallets";

export type AccountAccessLevel = 0 | 1 | 2;

/**
 * KYC completion — backend field TBD. Stub until Polsinelli / identity provider integration.
 */
export function isKycComplete(_user: AuthUser | null | undefined): boolean {
  return false;
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
