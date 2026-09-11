import { disconnect, getConnections } from "wagmi/actions";
import { wagmiPrivyConfig } from "@/lib/privy/config";

/**
 * Drop every wagmi connection (Privy embedded + injected MetaMask, etc.).
 * Call on Sign out so the next login cannot inherit a stale active connector.
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
}
