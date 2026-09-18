import { createConfig } from "@privy-io/wagmi";
import type { PrivyClientConfig, WalletListEntry } from "@privy-io/react-auth";
import { http, fallback } from "wagmi";
import { ASSETS } from "@/constants/assets";
import {
  getBrowserRpcUrls,
  getDefaultPrivyChain,
  getPrivySupportedChains,
} from "@/lib/chains/registry";
import type { SupportedChainId } from "@/lib/chains/types";
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
 * Never include bare `wallet_connect` — it expands to 100+ WalletConnect registry icons.
 * Mobile: named wallets only (MetaMask / Coinbase / Rainbow deeplinks).
 * Desktop: same + detected extensions + one WalletConnect QR button.
 */
export function resolvePrivyExternalWalletList(): WalletListEntry[] {
  const mobile =
    typeof navigator !== "undefined" &&
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (mobile) {
    return ["metamask", "coinbase_wallet", "rainbow"];
  }
  return [
    "metamask",
    "coinbase_wallet",
    "rainbow",
    "detected_ethereum_wallets",
    "wallet_connect_qr",
  ];
}

/** Static fallback list (no WC registry dump). */
export const PRIVY_EXTERNAL_WALLET_LIST: WalletListEntry[] = [
  "metamask",
  "coinbase_wallet",
  "rainbow",
];

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

/** Logo for Privy login modal — same wordmark as GNB top-left.
 * Use a stable same-origin path (no `window` / env branching) so SSR and client match.
 */
function privyModalLogoUrl(): string {
  return ASSETS.logo.tokenableDs;
}

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
      // Match Tokenable-with design system-17/Login.html card surface (#141414).
      theme: "#141414",
      accentColor: "#1A6FFF",
      landingHeader: "",
      loginMessage: "",
      // Tokenable wordmark at top of the login / connect modal (same as GNB).
      logo: privyModalLogoUrl(),
      // Link/connect modals (linkWallet, UserPill) — separate from loginMethods.
      // Never use bare `wallet_connect` (100+ registry icons).
      walletList: isPrivyEnabled() ? resolvePrivyExternalWalletList() : [],
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
    const chainId = chain.id as SupportedChainId;
    const urls = getBrowserRpcUrls(chainId);
    // Prefer public RPCs when NEXT_PUBLIC points at a shared Alchemy key —
    // browser clients sharing one key hit 429; Alchemy's error body lacks CORS.
    const httpClients = urls.map((url) =>
      http(url, { retryCount: 0, timeout: 12_000 }),
    );
    return [
      chain.id,
      httpClients.length === 1
        ? httpClients[0]!
        : fallback(httpClients, { rank: false }),
    ];
  }),
);

/** Wagmi config when Privy is enabled — connectors are injected by PrivyProvider. */
export const wagmiPrivyConfig = createConfig({
  chains: wagmiChains,
  transports,
  ssr: true,
});

