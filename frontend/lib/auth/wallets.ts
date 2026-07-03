import { getAddress } from "viem";
import type { AuthUser } from "./auth";

export type LinkedWallet = {
  address: string;
  linkedAt: string;
  isPrimary: boolean;
  chainType?: string;
  walletKind?: "embedded" | "external";
  walletClient?: string | null;
  connectorType?: string | null;
  source?: string;
};

export type AuthProviderLink = {
  providerType: string;
  providerSubject: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  isVerified: boolean;
  linkedAt: string;
};

export function getUserLinkedWallets(user: AuthUser | null | undefined): LinkedWallet[] {
  if (!user) return [];
  if (user.wallets?.length) return user.wallets;
  if (user.walletAddress?.trim()) {
    return [
      {
        address: user.walletAddress,
        linkedAt: user.walletLinkedAt ?? "",
        isPrimary: true,
      },
    ];
  }
  return [];
}

export function normalizeWalletAddress(address: string | undefined): string | undefined {
  if (!address?.trim()) return undefined;
  try {
    return getAddress(address.trim());
  } catch {
    return undefined;
  }
}

export function isUserWalletLinked(
  user: AuthUser | null | undefined,
  address: string | undefined,
): boolean {
  const normalized = normalizeWalletAddress(address);
  if (!normalized) return false;
  return getUserLinkedWallets(user).some(
    (w) => normalizeWalletAddress(w.address) === normalized,
  );
}

export function getPrimaryWalletAddress(user: AuthUser | null | undefined): string | undefined {
  const wallets = getUserLinkedWallets(user);
  const primary = wallets.find((w) => w.isPrimary) ?? wallets[0];
  return normalizeWalletAddress(primary?.address);
}

export function userHasLinkedWallet(user: AuthUser | null | undefined): boolean {
  return getUserLinkedWallets(user).length > 0;
}

/** Portfolio read path — never returns an address unless it is linked on the account. */
export function resolvePortfolioViewAddress(
  user: AuthUser | null | undefined,
  connectedAddress: string | undefined,
): string | undefined {
  const linked = getUserLinkedWallets(user)
    .map((w) => normalizeWalletAddress(w.address))
    .filter((a): a is string => Boolean(a));

  if (!linked.length) return undefined;

  const connected = normalizeWalletAddress(connectedAddress);
  if (connected && linked.includes(connected)) {
    return connected;
  }

  return getPrimaryWalletAddress(user);
}

export function isLinkedPortfolioViewAddress(
  user: AuthUser | null | undefined,
  address: string | undefined,
): boolean {
  const normalized = normalizeWalletAddress(address);
  if (!normalized) return false;
  return getUserLinkedWallets(user).some(
    (w) => normalizeWalletAddress(w.address) === normalized,
  );
}
