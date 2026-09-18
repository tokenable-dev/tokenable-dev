/** Wagmi connection fields used for header / CTA display. */
export type WalletConnectionSnapshot = {
  address?: string;
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
};

/** Show connected wallet UI (address chip) — includes in-flight reconnect with a known address. */
export function isWalletSessionActive(connection: WalletConnectionSnapshot): boolean {
  return Boolean(
    (connection.isConnected && connection.address) ||
      (connection.isReconnecting && connection.address),
  );
}

/** Show a pending state instead of the disconnected Connect CTA. */
export function isWalletSessionPending(connection: WalletConnectionSnapshot): boolean {
  return (
    connection.isConnecting ||
    (connection.isReconnecting && !connection.address)
  );
}
