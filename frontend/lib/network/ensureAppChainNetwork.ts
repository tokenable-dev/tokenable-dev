import type { AppChainDefinition } from "@/lib/chains";
import { getBrowserRpcUrls } from "@/lib/chains/registry";
import type { SupportedChainId } from "@/lib/chains/types";

const CHAIN_ID_HEX = (chainId: number) => `0x${chainId.toString(16)}`;

export interface EnsureAppChainResult {
  success: boolean;
  error?: string;
}

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function addChainParams(chain: AppChainDefinition) {
  const rpcUrls = getBrowserRpcUrls(chain.id as SupportedChainId);
  return {
    chainId: CHAIN_ID_HEX(chain.id),
    chainName: chain.label,
    nativeCurrency: chain.viemChain.nativeCurrency,
    rpcUrls,
    blockExplorerUrls: [chain.explorerBaseUrl],
  };
}

/**
 * Adds the app chain to the wallet if missing, then switches to it.
 */
export async function ensureAppChainNetwork(
  provider: Eip1193Provider,
  chain: AppChainDefinition,
): Promise<EnsureAppChainResult> {
  const chainIdHex = CHAIN_ID_HEX(chain.id);
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
    return { success: true };
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code === 4902) {
      try {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [addChainParams(chain)],
        });
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: chainIdHex }],
        });
        return { success: true };
      } catch (addErr) {
        return {
          success: false,
          error: (addErr as Error)?.message ?? `Failed to add ${chain.label}`,
        };
      }
    }
    return {
      success: false,
      error: (err as Error)?.message ?? `Failed to switch to ${chain.label}`,
    };
  }
}
