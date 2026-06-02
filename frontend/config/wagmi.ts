import { createConfig, http } from "wagmi";
import { sepolia } from "viem/chains";
import { metaMask } from "wagmi/connectors";

const ALCHEMY_RPC =
  process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL ??
  "https://eth-sepolia.g.alchemy.com/v2/demo";

const DAPP_ORIGIN =
  typeof window !== "undefined" ? window.location.origin : "https://tokenable.io";

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [
    metaMask({
      dappMetadata: {
        name: "Tokenable",
        url: DAPP_ORIGIN,
      },
      // Avoid opening MetaMask mobile on page load; connect only after user action.
      checkInstallationImmediately: false,
      checkInstallationOnAllCalls: false,
    }),
  ],
  transports: {
    [sepolia.id]: http(ALCHEMY_RPC),
  },
  ssr: true,
});

/** Re-export for convenience so other files can import `sepolia` from here */
export { sepolia };
