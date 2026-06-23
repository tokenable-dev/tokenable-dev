import type { AuthUser } from "./auth";
import { isUserWalletLinked, userHasLinkedWallet } from "./wallets";
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
    return { action: "connect-wallet" };
  }

  if (
    user &&
    userHasLinkedWallet(user) &&
    connection.address &&
    !isUserWalletLinked(user, connection.address)
  ) {
    return { action: "wallet-mismatch" };
  }

  return { action: "allow" };
}
