import {
  getChainDefinition,
  getPrivySupportedChains,
  SUPPORTED_CHAIN_IDS,
  type SupportedChainId,
} from "@/lib/chains";

export type PrivyFundingEnvironment = "sandbox" | "production";

export const TOKENABLE_FUNDING_ASSET = "usdc" as const;

/** Production launch target (Polygon) — used when not in Amoy pay-test mode. */
export const PRODUCTION_FUNDING_CAIP2 = "eip155:137" as const;

/** Amoy testnet — dev MoonPay sandbox destination. */
export const AMOY_FUNDING_CAIP2 = "eip155:80002" as const;

/** Ethereum mainnet — common Privy Dashboard default during MoonPay setup. */
export const ETHEREUM_FUNDING_CAIP2 = "eip155:1" as const;

/** @deprecated Use {@link resolveFundingTargetCaip2}. */
export const TOKENABLE_FUNDING_CAIP2 = PRODUCTION_FUNDING_CAIP2;

/** EVM chain id → CAIP-2 (Privy fiat on-ramp / funding APIs). */
export function chainIdToCaip2(chainId: number): `eip155:${number}` {
  return `eip155:${chainId}`;
}

export function parseCaip2EvmChainId(caip2: string): number | null {
  if (!caip2.startsWith("eip155:")) return null;
  const id = Number.parseInt(caip2.slice("eip155:".length), 10);
  return Number.isFinite(id) ? id : null;
}

/**
 * When true, Amoy uses MoonPay (`useFiatOnramp`) instead of MockUSDC mint.
 * Set `NEXT_PUBLIC_PRIVY_FUNDING_USE_ONRAMP_ON_TESTNET=true` for pay-flow QA only.
 */
export function shouldUseMoonPayOnTestnet(): boolean {
  return process.env.NEXT_PUBLIC_PRIVY_FUNDING_USE_ONRAMP_ON_TESTNET === "true";
}

/** Chain id passed to `useFiatOnramp` destination (defaults to Amoy for dev). */
export function resolveFundingTargetChainId(): SupportedChainId {
  const raw = process.env.NEXT_PUBLIC_PRIVY_FUNDING_CHAIN_ID?.trim();
  const n = Number(raw);
  if (SUPPORTED_CHAIN_IDS.includes(n as SupportedChainId)) {
    return n as SupportedChainId;
  }
  return 80002;
}

export function resolveFundingTargetCaip2(): `eip155:${number}` {
  return chainIdToCaip2(resolveFundingTargetChainId());
}

/**
 * Privy on-ramp environment.
 * - `production` — live card / Apple Pay / Google Pay (Dashboard providers in production mode).
 * - `sandbox` — MoonPay sandbox and provider test flows.
 */
export function resolvePrivyFundingEnvironment(): PrivyFundingEnvironment {
  const raw = process.env.NEXT_PUBLIC_PRIVY_FUNDING_ENVIRONMENT?.trim().toLowerCase();
  if (raw === "sandbox" || raw === "production") return raw;
  return process.env.NODE_ENV === "production" ? "production" : "sandbox";
}

/** Default fiat amount shown in the Privy on-ramp amount step. */
export function resolveDefaultFundingAmount(): string {
  const raw = process.env.NEXT_PUBLIC_PRIVY_FUNDING_DEFAULT_AMOUNT?.trim();
  if (raw && /^\d+(\.\d+)?$/.test(raw)) return raw;
  return "50";
}

export function isMainnetChain(chainId: SupportedChainId): boolean {
  return !getChainDefinition(chainId).isTestnet;
}

/** Whether `chainId` is listed in `privyClientConfig.supportedChains`. */
export function isPrivyProviderChain(chainId: number): boolean {
  return getPrivySupportedChains().some((chain) => chain.id === chainId);
}

export function usesMoonPayFunding(chainId: SupportedChainId): boolean {
  return isMainnetChain(chainId) || shouldUseMoonPayOnTestnet();
}

export function assertFundingChainSupported(chainId: SupportedChainId): void {
  const target = resolveFundingTargetChainId();
  if (chainId !== target) {
    const label = getChainDefinition(target).shortLabel;
    throw new Error(
      `Switch the header network to ${label} before testing MoonPay (funding target chain ${target}).`,
    );
  }
  if (!isPrivyProviderChain(chainId)) {
    throw new Error(`Chain ${chainId} is not enabled in Privy.`);
  }
}

export function formatPrivyFundingError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("Wallet funding is not enabled")) {
    return [
      "Wallet funding is not enabled for this Privy app.",
      "Enable MoonPay under Privy Dashboard → Account Funding.",
      "See docs/guides/privy-wallet-funding.md",
    ].join(" ");
  }
  if (msg.includes("funding methods")) {
    return [
      "No MoonPay funding methods are configured for this Privy app.",
      "Complete Account Funding setup in the Privy Dashboard.",
    ].join(" ");
  }
  if (msg.includes("Funding chain") && msg.includes("not in PrivyProvider")) {
    return [
      "Privy Dashboard default funding network does not match this app.",
      `Set Account Funding → Funding token to Polygon Amoy + USDC (${AMOY_FUNDING_CAIP2}) or Ethereum + USDC (${ETHEREUM_FUNDING_CAIP2}).`,
      "Keep the header network on Amoy while testing.",
    ].join(" ");
  }
  return msg || "Funding flow failed. Please try again.";
}

export type PrivyFundingSettingsResponse = {
  appId: string;
  fundingReadiness: {
    ready: boolean;
    fiatOnRampEnabled: boolean;
    methods: string[];
    providers: string[];
    defaultRecommendedAmount: string | null;
    defaultRecommendedChain: string | null;
    defaultRecommendedAsset: string | null;
    chainAligned: boolean;
    moonpayEnabled: boolean;
    targetFundingCaip2: string;
    dashboardChecklist: string[];
    dashboardUrl: string;
  };
};
