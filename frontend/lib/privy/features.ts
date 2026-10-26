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
 * Primary: Binance / Coinbase / MetaMask / OKX. Google + email under "More options".
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

/**
 * Privy expands one `binance` entry into two buttons (Binance Wallet and
 * Binance DeFi Wallet). Keep a single Binance Wallet button.
 * Returns true for each label that should be hidden.
 */
export function binanceWalletButtonsToHide(labels: readonly string[]): boolean[] {
  const isBinance = labels.map((label) => /binance/i.test(label));
  const indexes = isBinance.flatMap((match, index) => (match ? [index] : []));
  const hide = labels.map(() => false);
  if (indexes.length <= 1) return hide;
  const keep =
    indexes.find((index) => !/defi/i.test(labels[index] ?? "")) ?? indexes[0]!;
  for (const index of indexes) {
    if (index !== keep) hide[index] = true;
  }
  return hide;
}

/** Primary login row — Privy shows at most four methods on the landing screen. */
const DEFAULT_LOGIN_PRIMARY = [
  "binance",
  "coinbase_wallet",
  "metamask",
  "okx_wallet",
] as const;

/**
 * Popular wallets on the login primary / walletList top row.
 * Trust / Rabby have no first-class Privy ids (Trust → WC More; Rabby deprecated).
 */
export const PRIVY_FEATURED_WALLETS = [
  "binance",
  "coinbase_wallet",
  "metamask",
  "okx_wallet",
  "rainbow",
] as const;

/**
 * Login "More options": Google + email first, then Rainbow / WalletConnect registry.
 */
const DEFAULT_LOGIN_OVERFLOW: LoginMethodOverflow = [
  "google",
  "email",
  "rainbow",
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
      primary: [...DEFAULT_LOGIN_PRIMARY],
      overflow: [
        ...DEFAULT_LOGIN_OVERFLOW,
        ...FULL_LOGIN_OVERFLOW,
      ],
    };
  }
  return {
    primary: [...DEFAULT_LOGIN_PRIMARY],
    overflow: [...DEFAULT_LOGIN_OVERFLOW],
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
    label: "Sign in / sign up with external wallet (featured + More → WC)",
    hook: "useLogin / loginMethods wallet",
    status: "enabled",
    note: "Primary: Binance, Coinbase, MetaMask, OKX. More: Google, email, Rainbow, wallet_connect. " +
      "Wallet-first users get an embedded wallet auto-created (createOnLogin). " +
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
    hook: "useFiatOnramp / usePrivyFiatOnramp",
    status: "enabled",
    note: "Header wallet menu → Add funds. Mainnet: Privy useFiatOnramp (KRW + Meld/MoonPay by region). Sepolia QA: MoonPay embed only.",
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
