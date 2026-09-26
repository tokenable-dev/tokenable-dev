import type { AuthUser } from "./auth";
import {
  getPrimaryWalletAddress,
  isUserWalletLinked,
  normalizeWalletAddress,
  userHasLinkedWallet,
} from "./wallets";
import {
  isWalletSessionActive,
  isWalletSessionPending,
  type WalletConnectionSnapshot,
} from "@/lib/wallet/walletConnectionDisplay";

export type WalletSessionGateResult =
  | { action: "allow" }
  | { action: "connect-wallet" }
  | { action: "wallet-mismatch" };

/**
 * Wallet session check after account-level gate (login + linked wallet) passes.
 *
 * States this models (not identical):
 * - linked (backend primary) vs active (wagmi session) vs account match vs ready
 * Chain readiness is enforced later by `useEnsureAccountWalletReady` / AppChain.
 */
export function resolveWalletSessionGate(
  user: AuthUser | null | undefined,
  connection: WalletConnectionSnapshot,
): WalletSessionGateResult {
  const sessionActive = isWalletSessionActive(connection);
  const primary = getPrimaryWalletAddress(user);
  const connected = normalizeWalletAddress(connection.address);

  // Do not assume silent MetaMask activation will succeed — prompt connect/activate.
  if (!sessionActive) {
    return { action: "connect-wallet" };
  }

  if (
    user &&
    userHasLinkedWallet(user) &&
    connected &&
    !isUserWalletLinked(user, connected)
  ) {
    return { action: "wallet-mismatch" };
  }

  // Primary is the signing wallet. Connected but wrong account must not proceed.
  if (primary && connected && connected !== primary) {
    return { action: "wallet-mismatch" };
  }

  return { action: "allow" };
}

/** Trade CTAs: wagmi reconnect/connect or Privy activation still in flight. */
export function isTradeWalletSessionPending(
  connection: WalletConnectionSnapshot,
  walletActivationInFlight: boolean,
): boolean {
  return isWalletSessionPending(connection) || walletActivationInFlight;
}
