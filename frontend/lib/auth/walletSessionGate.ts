import type { AuthUser } from "./auth";
import { getPrimaryWalletAddress, isUserWalletLinked, userHasLinkedWallet } from "./wallets";
import {
  isWalletSessionActive,
  type WalletConnectionSnapshot,
} from "@/lib/wallet/walletConnectionDisplay";

export type WalletSessionGateResult =
  | { action: "allow" }
  | { action: "connect-wallet" }
  | { action: "wallet-mismatch" };

/** Wallet session check after account-level gate (login + linked wallet) passes. */
export function resolveWalletSessionGate(
  user: AuthUser | null | undefined,
  connection: WalletConnectionSnapshot,
): WalletSessionGateResult {
  const sessionActive = isWalletSessionActive(connection);

  if (!sessionActive) {
    // If the account has a primary wallet, AccountWalletAligner will silently activate it.
    // For email/social users: embedded wallet is always available via Privy.
    // For wallet-first users: MetaMask may need explicit reconnection — Phase 4 Trading QA
    // must verify that wallet-first users are prompted to reconnect MetaMask before trading.
    if (user && getPrimaryWalletAddress(user)) {
      return { action: "allow" };
    }
    return { action: "connect-wallet" };
  }

  if (
    user &&
    userHasLinkedWallet(user) &&
    connection.address &&
    !isUserWalletLinked(user, connection.address)
  ) {
    // Primary wallet is set: AccountWalletAligner will auto-align to the correct wallet.
    // Mismatch prompt only triggers when no primary is set (unusual edge case).
    if (getPrimaryWalletAddress(user)) {
      return { action: "allow" };
    }
    return { action: "wallet-mismatch" };
  }

  return { action: "allow" };
}
