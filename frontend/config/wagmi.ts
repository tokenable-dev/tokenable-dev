import { createConfig, http } from "wagmi";
import { sepolia } from "viem/chains";
import { metaMask } from "wagmi/connectors";

const ALCHEMY_RPC =
  process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL ??
  "https://eth-sepolia.g.alchemy.com/v2/demo";

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [metaMask()],
  transports: {
    [sepolia.id]: http(ALCHEMY_RPC),
  },
  ssr: true,
});

/** Re-export for convenience so other files can import `sepolia` from here */
export { sepolia };
