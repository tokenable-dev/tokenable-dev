import type { SupportedChainId } from "./types";

let activeChainIdForApi: SupportedChainId | null = null;

export function setActiveChainIdForApi(chainId: SupportedChainId): void {
  activeChainIdForApi = chainId;
}

export function getActiveChainIdForApi(): SupportedChainId | null {
  return activeChainIdForApi;
}

export const CHAIN_ID_HEADER = "x-tokenable-chain-id";
