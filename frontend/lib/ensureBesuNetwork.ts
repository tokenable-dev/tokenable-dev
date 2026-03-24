import { sepolia } from "@/config/wagmi";

const CHAIN_ID_HEX = `0x${sepolia.id.toString(16)}`;

const ADD_CHAIN_PARAMS = {
  chainId: CHAIN_ID_HEX,
  chainName: sepolia.name,
  nativeCurrency: sepolia.nativeCurrency,
  rpcUrls: [sepolia.rpcUrls.default.http[0]],
  blockExplorerUrls: ["https://sepolia.etherscan.io"],
};

export interface EnsureBesuResult {
  success: boolean;
  error?: string;
}

type Eip1193Provider = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

/**
 * Adds SkyAnd Chain to MetaMask if not present, then switches to it.
 * Call when connected but on wrong network.
 */
export async function ensureBesuNetwork(
  provider: Eip1193Provider
): Promise<EnsureBesuResult> {
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
          error: (addErr as Error)?.message ?? "Failed to add network",
        };
      }
    }
    return {
      success: false,
      error: (err as Error)?.message ?? "Failed to switch network",
    };
  }
}
