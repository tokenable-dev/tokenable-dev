import type { useConnect } from "wagmi";

export function findMetaMaskConnector(
  connectors: ReturnType<typeof useConnect>["connectors"],
) {
  return connectors.find((c) => c.id === "metaMaskSDK" || c.name === "MetaMask");
}

export function connectMetaMaskWallet(
  connect: ReturnType<typeof useConnect>["connect"],
  connectors: ReturnType<typeof useConnect>["connectors"],
): void {
  const metaMaskConnector = findMetaMaskConnector(connectors);
  if (metaMaskConnector) connect({ connector: metaMaskConnector });
}
