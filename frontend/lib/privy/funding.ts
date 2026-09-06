import {
  getChainDefinition,
  getPrivySupportedChains,
  SUPPORTED_CHAIN_IDS,
  type SupportedChainId,
} from "@/lib/chains";

export type PrivyFundingEnvironment = "sandbox" | "production";

export const TOKENABLE_FUNDING_ASSET = "usdc" as const;

/** @deprecated Prefer Polygon / active app chain — kept for docs. */
export const PRODUCTION_FUNDING_CAIP2 = "eip155:1" as const;

/** Sepolia testnet — MoonPay sandbox destination (UI QA only). */
export const SEPOLIA_FUNDING_CAIP2 = "eip155:11155111" as const;

/** Ethereum mainnet. */
export const ETHEREUM_FUNDING_CAIP2 = "eip155:1" as const;

/** Polygon mainnet — Tokenable production trading / USDC settlement. */
export const POLYGON_FUNDING_CAIP2 = "eip155:137" as const;

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
 * When true, Sepolia uses MoonPay (`useFiatOnramp`) instead of MockUSDC mint.
 * Set `NEXT_PUBLIC_PRIVY_FUNDING_USE_ONRAMP_ON_TESTNET=true` for pay-flow QA only.
 */
export function shouldUseMoonPayOnTestnet(): boolean {
  return process.env.NEXT_PUBLIC_PRIVY_FUNDING_USE_ONRAMP_ON_TESTNET === "true";
}

/**
 * Dev-only: attempt MoonPay checkout even when `fundingReadiness.ready` is false.
 * Only applies with sandbox / testnet funding — never for mainnet live purchases.
 */
export function shouldSkipFundingReadinessCheck(
  fundingChainId?: SupportedChainId,
): boolean {
  if (process.env.NEXT_PUBLIC_PRIVY_FUNDING_SKIP_READINESS_CHECK !== "true") {
    return false;
  }
  const chainId = fundingChainId ?? resolveFundingTargetChainId();
  if (isMainnetChain(chainId)) return false;
  return resolvePrivyFundingEnvironment(chainId) === "sandbox";
}

/**
 * Chain USDC is delivered to.
 *
 * Priority:
 * 1. Active app chain when it is a mainnet (Polygon / Ethereum) — matches trading network
 * 2. `NEXT_PUBLIC_PRIVY_FUNDING_CHAIN_ID` explicit override
 * 3. Sepolia (sandbox QA default)
 */
export function resolveFundingTargetChainId(
  preferredChainId?: SupportedChainId,
): SupportedChainId {
  if (
    preferredChainId != null &&
    isMainnetChain(preferredChainId) &&
    isPrivyProviderChain(preferredChainId)
  ) {
    return preferredChainId;
  }

  const raw = process.env.NEXT_PUBLIC_PRIVY_FUNDING_CHAIN_ID?.trim();
  const n = Number(raw);
  if (SUPPORTED_CHAIN_IDS.includes(n as SupportedChainId)) {
    return n as SupportedChainId;
  }

  if (preferredChainId != null && isPrivyProviderChain(preferredChainId)) {
    return preferredChainId;
  }

  return 11155111;
}

export function resolveFundingTargetCaip2(
  preferredChainId?: SupportedChainId,
): `eip155:${number}` {
  return chainIdToCaip2(resolveFundingTargetChainId(preferredChainId));
}

/**
 * Privy / MoonPay environment for the funding destination.
 * Mainnet destinations always use live MoonPay — sandbox cannot deliver Polygon/ETH USDC.
 */
export function resolvePrivyFundingEnvironment(
  fundingChainId?: SupportedChainId,
): PrivyFundingEnvironment {
  const chainId = fundingChainId ?? resolveFundingTargetChainId();
  if (isMainnetChain(chainId)) return "production";

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

/**
 * Destination asset for `useFiatOnramp`.
 * Always the symbol `"usdc"` — a contract address routes Privy through Stripe
 * Embedded onramp, which does not support Polygon native USDC and surfaces
 * "Unsupported asset for Stripe onramp".
 */
export function resolveFundingDestinationAsset(
  _chainId?: SupportedChainId,
): string {
  return TOKENABLE_FUNDING_ASSET;
}

export function assertFundingChainSupported(chainId: SupportedChainId): void {
  if (!usesMoonPayFunding(chainId)) {
    throw new Error(
      "MoonPay is not available on this testnet. Switch to Polygon (or enable NEXT_PUBLIC_PRIVY_FUNDING_USE_ONRAMP_ON_TESTNET).",
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
  if (msg.includes("Stripe") || msg.includes("FiatOnramp:Stripe")) {
    return [
      "Stripe on-ramp is not supported for Polygon USDC.",
      "Add funds uses MoonPay only — refresh and try again.",
    ].join(" ");
  }
  if (msg.includes("Unable to initialize flow")) {
    return [
      "MoonPay checkout popup could not open (often blocked by the browser).",
      "Allow popups for this site, then Add funds again and select MoonPay / card when prompted.",
    ].join(" ");
  }
  if (msg.includes("Funding chain") && msg.includes("not in PrivyProvider")) {
    return [
      "Privy Dashboard default funding network does not match this app.",
      `Set Account Funding → Funding token to Polygon + USDC (${POLYGON_FUNDING_CAIP2}) or Ethereum + USDC (${ETHEREUM_FUNDING_CAIP2}).`,
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
