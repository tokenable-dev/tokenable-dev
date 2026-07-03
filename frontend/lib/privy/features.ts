import type { PrivyClientConfig } from "@privy-io/react-auth";

type LoginMethod = NonNullable<PrivyClientConfig["loginMethods"]>[number];

function envTrue(name: string): boolean {
  return process.env[name] === "true";
}

/** Email-only gate (rare). Overrides the default Google + email surface. */
export function isPrivyLoginMinimal(): boolean {
  return envTrue("NEXT_PUBLIC_PRIVY_LOGIN_MINIMAL");
}

/** Dev / Privy lab — restore the full Privy login surface (More options, all socials). */
export function isPrivyFullLoginEnabled(): boolean {
  return envTrue("NEXT_PUBLIC_PRIVY_FULL_LOGIN");
}

export function isPrivyMoonpaySandboxEnabled(): boolean {
  return envTrue("NEXT_PUBLIC_PRIVY_MOONPAY_SANDBOX");
}

const ALL_LOGIN_METHODS: LoginMethod[] = [
  "email",
  "wallet",
  "google",
  "apple",
  "sms",
  "passkey",
  "farcaster",
  "telegram",
  "discord",
  "github",
  "twitter",
  "linkedin",
];

/**
 * Default production login surface.
 * Primary row: Google + email. "More options" shows wallet connectors (MetaMask, etc.).
 */
const DEFAULT_LOGIN_METHODS: LoginMethod[] = ["email", "google", "wallet"];

type LoginMethodOverflow = NonNullable<
  NonNullable<PrivyClientConfig["loginMethodsAndOrder"]>["overflow"]
>;

const FULL_LOGIN_OVERFLOW: LoginMethodOverflow = [
  "twitter",
  "discord",
  "github",
  "linkedin",
  "farcaster",
  "telegram",
  "sms",
];

/** Wallet options shown under "More options" in the default login surface. */
const DEFAULT_WALLET_OVERFLOW: LoginMethodOverflow = [
  "metamask",
  "coinbase_wallet",
  "wallet_connect",
];

/** Client-side login methods — intersected with Privy Dashboard enabled methods. */
export function resolvePrivyLoginMethods(): LoginMethod[] {
  if (isPrivyLoginMinimal()) {
    return ["email"];
  }
  if (isPrivyFullLoginEnabled()) {
    return [...ALL_LOGIN_METHODS];
  }
  return [...DEFAULT_LOGIN_METHODS];
}

/** Primary row + overflow — empty overflow hides Privy's "More options" button. */
export function resolvePrivyLoginMethodsOrder(): NonNullable<
  PrivyClientConfig["loginMethodsAndOrder"]
> {
  if (isPrivyLoginMinimal()) {
    return { primary: ["email"], overflow: [] };
  }
  if (isPrivyFullLoginEnabled()) {
    return {
      primary: ["google", "apple", "email"],
      overflow: [...FULL_LOGIN_OVERFLOW, ...DEFAULT_WALLET_OVERFLOW],
    };
  }
  // Default: Google + email in primary row; wallets (MetaMask, etc.) in "More options".
  return {
    primary: ["google", "email"],
    overflow: [...DEFAULT_WALLET_OVERFLOW],
  };
}

/** @deprecated Use resolvePrivyLoginMethodsOrder() — kept for older imports. */
export const PRIVY_LOGIN_METHODS_ORDER = resolvePrivyLoginMethodsOrder();

/** Human-readable matrix for dev UI + docs. */
export const PRIVY_CLIENT_FEATURE_MATRIX = [
  {
    id: "login",
    label: "Login modal",
    hook: "useLogin / UserPill",
    status: "enabled",
  },
  {
    id: "wallet-login",
    label: "Sign in / sign up with external wallet (MetaMask, Coinbase, WalletConnect)",
    hook: "useLogin / loginMethods wallet",
    status: "enabled",
    note: "Wallet-first users get an embedded wallet auto-created (createOnLogin). " +
      "Embedded stays signing primary for email/social users; " +
      "external wallet is signing primary for wallet-first users.",
  },
  {
    id: "wallet-link",
    label: "Link additional external wallet (MetaMask, …)",
    hook: "linkWallet / UserPill connectWallet",
    status: "enabled",
    note: "Post-login linking via Profile page. Single external wallet per account enforced by Dashboard.",
  },
  {
    id: "fiat-onramp",
    label: "Fiat on-ramp (MoonPay · card · Apple Pay · Google Pay)",
    hook: "useFiatOnramp",
    status: "polygon-mainnet-only",
    note: "Amoy testnet uses the official Amoy USDC faucet — MoonPay delivers mainnet USDC on Polygon only.",
  },
  {
    id: "fund-wallet",
    label: "Fund wallet (native / ERC-20)",
    hook: "useFundWallet",
    status: "mainnet-only",
  },
  {
    id: "bank-deposit",
    label: "Bank deposit (ACH / wire / SEPA)",
    hook: "useFundWalletWithBankDeposit",
    status: "mainnet-only",
  },
  {
    id: "mfa",
    label: "MFA enrollment",
    hook: "useMfaEnrollment",
    status: "dashboard-only",
  },
  {
    id: "export-wallet",
    label: "Export embedded wallet",
    hook: "useExportWallet",
    status: "dashboard-only",
  },
  {
    id: "sign-message",
    label: "Sign message",
    hook: "useSignMessage",
    status: "enabled",
  },
  {
    id: "wallets-dialog",
    label: "Wallets dialog",
    hook: "WalletsDialog",
    status: "enabled",
  },
] as const;
