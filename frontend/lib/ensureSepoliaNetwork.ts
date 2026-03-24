import { sepolia } from "@/config/wagmi";

const CHAIN_ID_HEX = `0x${sepolia.id.toString(16)}`; // 0xaa36a7

const ADD_CHAIN_PARAMS = {
  chainId: CHAIN_ID_HEX,
  chainName: "Sepolia",
  nativeCurrency: sepolia.nativeCurrency,
  rpcUrls: [sepolia.rpcUrls.default.http[0]],
  blockExplorerUrls: ["https://sepolia.etherscan.io"],
};

export interface EnsureSepoliaResult {
  success: boolean;
  error?: string;
}

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

/**
 * Adds Sepolia to MetaMask if not present, then switches to it.
 * Called automatically when the user connects on the wrong network.
 */
export async function ensureSepoliaNetwork(
  provider: Eip1193Provider
): Promise<EnsureSepoliaResult> {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_ID_HEX }],
    });
    return { success: true };
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code === 4902) {
      try {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [ADD_CHAIN_PARAMS],
        });
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: CHAIN_ID_HEX }],
        });
        return { success: true };
      } catch (addErr) {
        return {
          success: false,
          error: (addErr as Error)?.message ?? "Failed to add Sepolia",
        };
      }
    }
    return {
      success: false,
      error: (err as Error)?.message ?? "Failed to switch to Sepolia",
    };
  }
}
