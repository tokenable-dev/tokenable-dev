import type { useConnect } from "wagmi";

export function connectMetaMaskWallet(
  connect: ReturnType<typeof useConnect>["connect"],
  connectors: ReturnType<typeof useConnect>["connectors"],
): void {
  const metaMaskConnector = connectors.find((c) => c.name === "MetaMask");
  if (metaMaskConnector) connect({ connector: metaMaskConnector });
}
