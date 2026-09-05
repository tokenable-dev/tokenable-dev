import type { Chain } from "viem/chains";

/** Supported EVM networks — Sepolia (default public), Ethereum, Polygon. */
export const SUPPORTED_CHAIN_IDS = [11155111, 1, 137] as const;

export type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];

export type AppChainDefinition = {
  id: SupportedChainId;
  key: "mainnet" | "sepolia" | "polygon";
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
