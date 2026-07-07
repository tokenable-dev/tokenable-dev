import type { Chain } from "viem/chains";

/** Supported EVM networks — Ethereum Sepolia (dev) and Ethereum mainnet. */
export const SUPPORTED_CHAIN_IDS = [11155111, 1] as const;

export type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];

export type AppChainDefinition = {
  id: SupportedChainId;
  key: "mainnet" | "sepolia";
  label: string;
  shortLabel: string;
  isTestnet: boolean;
  nativeSymbol: string;
  explorerBaseUrl: string;
  viemChain: Chain;
};

export type ChainContracts = {
  chainId: SupportedChainId;
  rwaAddress: `0x${string}`;
  usdcAddress: `0x${string}`;
  rpcUrl: string;
};
