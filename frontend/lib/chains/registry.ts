import { addRpcUrlOverrideToChain } from "@privy-io/chains";
import {
  mainnet as viemMainnet,
  polygon as viemPolygon,
  sepolia as viemSepolia,
} from "viem/chains";
import type { AppChainDefinition, ChainContracts, SupportedChainId } from "./types";
import { SUPPORTED_CHAIN_IDS } from "./types";

const ADDR = /^0x[a-fA-F0-9]{40}$/;

function parseHexAddr(raw: string | undefined): `0x${string}` | null {
  const value = raw?.trim() ?? "";
  if (!value || !ADDR.test(value)) return null;
  return value as `0x${string}`;
}

function parseChainId(raw: string | undefined): SupportedChainId | null {
  const n = Number(raw?.trim());
  return SUPPORTED_CHAIN_IDS.includes(n as SupportedChainId)
    ? (n as SupportedChainId)
    : null;
}

/** Static env reads — required for Next.js client bundle inlining. */
function readRpcUrl(chainId: SupportedChainId): string | undefined {
  switch (chainId) {
    case 1:
      return process.env.NEXT_PUBLIC_CHAIN_1_RPC_URL?.trim() || undefined;
    case 137:
      return process.env.NEXT_PUBLIC_CHAIN_137_RPC_URL?.trim() || undefined;
    case 11155111:
      return process.env.NEXT_PUBLIC_CHAIN_11155111_RPC_URL?.trim() || undefined;
  }
}

function readRwaAddress(chainId: SupportedChainId): `0x${string}` | null {
  switch (chainId) {
    case 1:
      return parseHexAddr(process.env.NEXT_PUBLIC_CHAIN_1_RWA);
    case 137:
      return parseHexAddr(process.env.NEXT_PUBLIC_CHAIN_137_RWA);
    case 11155111:
      return parseHexAddr(process.env.NEXT_PUBLIC_CHAIN_11155111_RWA);
  }
}

function readUsdcAddress(chainId: SupportedChainId): `0x${string}` | null {
  switch (chainId) {
    case 1:
      return parseHexAddr(process.env.NEXT_PUBLIC_CHAIN_1_USDC);
    case 137:
      return parseHexAddr(process.env.NEXT_PUBLIC_CHAIN_137_USDC);
    case 11155111:
      return parseHexAddr(process.env.NEXT_PUBLIC_CHAIN_11155111_USDC);
  }
}

const BASE_DEFINITIONS: Record<SupportedChainId, Omit<AppChainDefinition, "viemChain">> = {
  1: {
    id: 1,
    key: "mainnet",
    label: "Ethereum",
    shortLabel: "Ethereum",
    isTestnet: false,
    nativeSymbol: "ETH",
    explorerBaseUrl: "https://etherscan.io",
  },
  137: {
    id: 137,
    key: "polygon",
    label: "Polygon",
    shortLabel: "Polygon",
    isTestnet: false,
    nativeSymbol: "POL",
    explorerBaseUrl: "https://polygonscan.com",
  },
  11155111: {
    id: 11155111,
    key: "sepolia",
    label: "Ethereum Sepolia",
    shortLabel: "Sepolia",
    isTestnet: true,
    nativeSymbol: "ETH",
    explorerBaseUrl: "https://sepolia.etherscan.io",
  },
};

function baseViemChain(chainId: SupportedChainId) {
  switch (chainId) {
    case 1:
      return viemMainnet;
    case 137:
      return viemPolygon;
    case 11155111:
      return viemSepolia;
  }
}

export function getChainDefinition(chainId: SupportedChainId): AppChainDefinition {
  const base = BASE_DEFINITIONS[chainId];
  const rpcUrl = readRpcUrl(chainId);
  const viemChain = rpcUrl
    ? addRpcUrlOverrideToChain(baseViemChain(chainId), rpcUrl)
    : baseViemChain(chainId);
  return { ...base, viemChain };
}

/**
 * Dev fallbacks when env vars are not set.
 *
 * Sepolia USDC (Circle official testnet): 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
 * Ethereum mainnet USDC: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
 * Polygon USDC (native): 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
 */
const DEV_FALLBACK: Record<
  SupportedChainId,
  { rpcUrl: string; rwaAddress: `0x${string}`; usdcAddress: `0x${string}` }
> = {
  1: {
    rpcUrl: "https://cloudflare-eth.com",
    rwaAddress: "0x0000000000000000000000000000000000000000",
    usdcAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  },
  137: {
    rpcUrl: "https://polygon-rpc.com",
    rwaAddress: "0x0000000000000000000000000000000000000000",
    usdcAddress: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  },
  11155111: {
    rpcUrl: "https://rpc.sepolia.org",
    rwaAddress: "0x0000000000000000000000000000000000000000",
    usdcAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  },
};

export function getChainContracts(chainId: SupportedChainId): ChainContracts {
  const rpcUrl = readRpcUrl(chainId);
  const rwaAddress = readRwaAddress(chainId);
  const usdcAddress = readUsdcAddress(chainId);
  if (!rpcUrl || !rwaAddress || !usdcAddress) {
    if (process.env.NODE_ENV !== "development") {
      throw new Error(
        `[chains] Chain ${chainId} is not fully configured. Set NEXT_PUBLIC_CHAIN_${chainId}_RPC_URL, _RWA, and _USDC.`,
      );
    }
    const fb = DEV_FALLBACK[chainId];
    if (typeof window !== "undefined") {
      const key = `__chainWarn_${chainId}`;
      if (!(window as unknown as Record<string, boolean>)[key]) {
        (window as unknown as Record<string, boolean>)[key] = true;
        console.warn(
          `[chains] Chain ${chainId} using dev fallback — set NEXT_PUBLIC_CHAIN_${chainId}_RPC_URL/_RWA/_USDC for full functionality.`,
        );
      }
    }
    return {
      chainId,
      rpcUrl: rpcUrl ?? fb.rpcUrl,
      rwaAddress: rwaAddress ?? fb.rwaAddress,
      usdcAddress: usdcAddress ?? fb.usdcAddress,
    };
  }
  return { chainId, rpcUrl, rwaAddress, usdcAddress };
}

export function isChainRpcConfigured(chainId: SupportedChainId): boolean {
  return Boolean(readRpcUrl(chainId));
}

export function isChainConfigured(chainId: SupportedChainId): boolean {
  return Boolean(readRpcUrl(chainId) && readRwaAddress(chainId) && readUsdcAddress(chainId));
}

export function getConfiguredChains(): AppChainDefinition[] {
  return SUPPORTED_CHAIN_IDS.filter(isChainConfigured).map(getChainDefinition);
}

export function resolveDefaultChainId(): SupportedChainId {
  const fromEnv = parseChainId(process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID);
  if (fromEnv && isChainConfigured(fromEnv)) return fromEnv;
  const first = SUPPORTED_CHAIN_IDS.find(isChainConfigured);
  if (first) return first;
  return 11155111;
}

export const DEFAULT_CHAIN_ID = resolveDefaultChainId();

/** Privy/wagmi chain list — only configured networks. */
export function getPrivySupportedChains() {
  return getConfiguredChains().map((c) => c.viemChain);
}

export function getDefaultPrivyChain() {
  return getChainDefinition(DEFAULT_CHAIN_ID).viemChain;
}
