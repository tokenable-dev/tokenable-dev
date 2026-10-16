import { disconnect, getConnections } from "wagmi/actions";
import { wagmiPrivyConfig } from "@/lib/privy/config";

/**
 * Drop every wagmi connection (Privy embedded + injected MetaMask, etc.).
 * Call on Sign out so the next login cannot inherit a stale active connector.
 *
 * Also best-effort revoke of the origin's `eth_accounts` grant so MetaMask is
 * not silently listed in `useWallets()` and re-prompted after logout.
 */
export async function disconnectAllWagmiWallets(): Promise<void> {
  try {
    const connections = getConnections(wagmiPrivyConfig);
    await Promise.all(
      connections.map((c) =>
        disconnect(wagmiPrivyConfig, { connector: c.connector }).catch(
          () => undefined,
        ),
      ),
    );
  } catch {
    // Best-effort — Privy logout already cleared the auth session.
  }

  // Never block sign-out / next social login on MetaMask permission UI.
  await Promise.race([
    revokeInjectedEthAccountsGrant(),
    new Promise<void>((resolve) => setTimeout(resolve, 400)),
  ]);
}

type Eip1193Provider = {
  request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

/** Clear MetaMask (etc.) site permission without opening a connect prompt. */
async function revokeInjectedEthAccountsGrant(): Promise<void> {
  if (typeof window === "undefined") return;
  const ethereum = (window as Window & { ethereum?: Eip1193Provider }).ethereum;
  if (!ethereum?.request) return;
  try {
    await ethereum.request({
      method: "wallet_revokePermissions",
      params: [{ eth_accounts: {} }],
    });
  } catch {
    // Older wallets may not support EIP-2255 — ignore.
  }
}
