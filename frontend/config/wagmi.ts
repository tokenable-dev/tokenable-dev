import { createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { metaMask } from "wagmi/connectors";

export const besu = defineChain({
  id: 2741,
  name: "Besu",
  rpcUrls: {
    default: { http: ["https://besu.dressdio.me"] },
  },
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  blockExplorers: {
    default: { name: "Besu Explorer", url: "https://besu.dressdio.me" },
  },
});

export const wagmiConfig = createConfig({
  chains: [besu],
  connectors: [metaMask()],
  transports: {
    [besu.id]: http("https://besu.dressdio.me"),
  },
  ssr: true,
});
