import { addRpcUrlOverrideToChain } from "@privy-io/chains";
import { createConfig } from "@privy-io/wagmi";
import type { PrivyClientConfig } from "@privy-io/react-auth";
import { http } from "wagmi";
import {
  DEFAULT_CHAIN_ID,
  getChainDefinition,
  getDefaultPrivyChain,
  getPrivySupportedChains,
  isChainConfigured,
} from "@/lib/chains/registry";
import {
  PRIVY_LOGIN_METHODS_ORDER,
  resolvePrivyLoginMethodsOrder,
} from "./features";
import { resolvePrivyFundingEnvironment } from "./funding";

export {
  isPrivyFullLoginEnabled,
  isPrivyLoginMinimal,
  isPrivyMoonpaySandboxEnabled,
  resolvePrivyLoginMethods,
  resolvePrivyLoginMethodsOrder,
  PRIVY_LOGIN_METHODS_ORDER,
  PRIVY_CLIENT_FEATURE_MATRIX,
} from "./features";
export {
  chainIdToCaip2,
  formatPrivyFundingError,
  isMainnetChain,
  resolveDefaultFundingAmount,
  resolveFundingDestinationAsset,
  resolveFundingTargetChainId,
  resolvePrivyFundingEnvironment,
  shouldUseMoonPayOnTestnet,
  shouldSkipFundingReadinessCheck,
  usesMoonPayFunding,
} from "./funding";

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim() ?? "";

/** Privy + wagmi stack is active when App ID is set. */
export function isPrivyEnabled(): boolean {
  return PRIVY_APP_ID.length > 0;
}

export function isPrivyGoogleLoginEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PRIVY_GOOGLE_LOGIN === "true";
}

/**
 * External wallet is a first-class login method (always enabled).
 * Email/social users' signing wallet = their Privy embedded wallet.
 * Wallet-first users' signing wallet = their external wallet (MetaMask etc).
 * The backend (privy-user.parser) stores external wallet first in walletAddresses,
 * so getPrimaryWalletAddress() correctly returns the user's actual signing wallet.
 * @deprecated Wallet login is always on — kept for isEmbeddedOnlyWalletPolicy() only.
 */
export function isPrivyWalletLoginEnabled(): boolean {
  return true;
}

/**
 * Wallets shown in Privy login, link, and connect modals.
 * Covers both first-class wallet login and post-login linking.
 */
export const PRIVY_EXTERNAL_WALLET_LIST = [
  "metamask",
  "coinbase_wallet",
  "rainbow",
  "wallet_connect",
] as const;

/**
 * Returns false — wallet login is enabled, so embedded is NOT forced as the only signing wallet.
 * Signing wallet is resolved from the user's actual primary wallet (backend-stored):
 *   - Email/social login users → Privy embedded wallet (their backend primary)
 *   - Wallet-first login users → external wallet (their backend primary)
 */
export function isEmbeddedOnlyWalletPolicy(): boolean {
  return false;
}

const supportedChains = getPrivySupportedChains();
const defaultChain = getDefaultPrivyChain();
const wagmiChains: [typeof defaultChain, ...typeof supportedChains] =
  supportedChains.length > 0
    ? ([supportedChains[0], ...supportedChains.slice(1)] as [
        typeof defaultChain,
        ...typeof supportedChains,
      ])
    : ([defaultChain] as [typeof defaultChain]);

/** @deprecated Use getChainDefinition from `@/lib/chains`. */
export const privyDefaultChain = defaultChain;

/** Passed to `<PrivyProvider config={…} />`. Rebuild when MoonPay sandbox mode changes. */
export function buildPrivyClientConfig(options?: {
  useSandbox?: boolean;
}): PrivyClientConfig {
  const useSandbox =
    options?.useSandbox ?? resolvePrivyFundingEnvironment() === "sandbox";
  return {
    // Privy accepts loginMethods OR loginMethodsAndOrder — not both.
    loginMethodsAndOrder: resolvePrivyLoginMethodsOrder(),
    appearance: {
      theme: "dark",
      accentColor: "#6366F1",
      // Link/connect modals (linkWallet, UserPill) — separate from loginMethods.
      walletList: isPrivyEnabled() ? [...PRIVY_EXTERNAL_WALLET_LIST] : [],
      showWalletLoginFirst: false,
    },
    embeddedWallets: {
      ethereum: {
        createOnLogin: "users-without-wallets",
      },
      showWalletUIs: true,
    },
    fundingMethodConfig: {
      moonpay: {
        // Mainnet (Polygon/ETH) must be false — sandbox cannot deliver mainnet USDC.
        // Sepolia QA uses true. Toggle via active app chain (see PrivyAppProviders).
        useSandbox,
      },
    },
    supportedChains: [...wagmiChains],
    defaultChain,
  };
}

/** @deprecated Prefer {@link buildPrivyClientConfig} — static default (Sepolia sandbox). */
export const privyClientConfig: PrivyClientConfig = buildPrivyClientConfig();

const transports = Object.fromEntries(
  wagmiChains.map((chain) => {
    const def = getChainDefinition(chain.id as typeof DEFAULT_CHAIN_ID);
    return [chain.id, http(def.viemChain.rpcUrls.default.http[0])];
  }),
);

/** Wagmi config when Privy is enabled — connectors are injected by PrivyProvider. */
export const wagmiPrivyConfig = createConfig({
  chains: wagmiChains,
  transports,
  ssr: true,
});

/** @deprecated Use `privyClientConfig` — kept for older imports. */
export const privyConfig = privyClientConfig;
