/**
 * Connected-wallet display: first 3 characters, "...", last 3 characters.
 */
export function formatConnectedWalletLabel(address: string): string {
  const a = address.trim();
  if (a.length <= 6) return a;
  return `${a.slice(0, 3)}...${a.slice(-3)}`;
}
