/** Privy capability surface for Swagger catalog + frontend feature matrix. */
export type PrivyFeatureSurface = 'client-sdk' | 'server-api' | 'both' | 'dashboard';

export type PrivyFeatureStatus =
  | 'enabled'
  | 'tokenable-wired'
  | 'swagger-proxy'
  | 'dashboard-only'
  | 'mainnet-only'
  | 'planned';

export type PrivyFeatureEntry = {
  id: string;
  category: string;
  name: string;
  description?: string;
  surface: PrivyFeatureSurface;
  status: PrivyFeatureStatus;
  /** Tokenable Swagger path to try (if any). */
  swaggerTryPath?: string;
  /** Privy React hook (if client). */
  clientHook?: string;
  /** Privy REST path (if server). */
  privyApiPath?: string;
  docsUrl?: string;
  notes?: string;
};

/** Full Privy feature matrix — browse via `GET /api/privy/catalog`. */
export const PRIVY_FEATURE_CATALOG: PrivyFeatureEntry[] = [
  // ── Tokenable session (Privy → JWT cookie) ──
  {
    id: 'auth.session',
    category: 'Tokenable session',
    name: 'Get session',
    description: 'Read Tokenable user from `access_token` cookie or Bearer JWT.',
    surface: 'both',
    status: 'tokenable-wired',
    swaggerTryPath: 'GET /api/auth/session',
    docsUrl: 'https://docs.privy.io/authentication/user-authentication/access-tokens',
  },
  {
    id: 'auth.privy-session',
    category: 'Tokenable session',
    name: 'Sync Privy session',
    description:
      'Exchange Privy access token (`Authorization: Bearer`) for Tokenable session cookie.',
    surface: 'both',
    status: 'tokenable-wired',
    swaggerTryPath: 'POST /api/auth/privy/session',
    clientHook: 'usePrivy → getAccessToken',
    docsUrl: 'https://docs.privy.io/authentication/user-authentication/access-tokens',
  },
  {
    id: 'auth.logout',
    category: 'Tokenable session',
    name: 'Logout',
    description: 'Clear Tokenable session cookie. Also call Privy `logout` on the client.',
    surface: 'both',
    status: 'tokenable-wired',
    swaggerTryPath: 'POST /api/auth/logout',
    clientHook: 'useLogout',
  },
  {
    id: 'auth.verify-access-token',
    category: 'Tokenable session',
    name: 'Verify Privy access token',
    description: 'Dev: verify Privy JWT and return `user_id` claims.',
    surface: 'server-api',
    status: 'swagger-proxy',
    swaggerTryPath: 'POST /api/privy/verify-access-token',
    privyApiPath: 'utils().auth().verifyAccessToken',
  },

  // ── Login methods ──
  {
    id: 'login.email',
    category: 'Authentication',
    name: 'Email OTP',
    description: 'Passwordless email login via Privy modal.',
    surface: 'client-sdk',
    status: 'tokenable-wired',
    clientHook: 'useLogin / useLoginWithEmail',
    docsUrl: 'https://docs.privy.io/authentication/user-authentication/login-methods/email',
  },
  {
    id: 'login.sms',
    category: 'Authentication',
    name: 'SMS OTP',
    description: 'Phone number login — enable in Privy Dashboard first.',
    surface: 'client-sdk',
    status: 'dashboard-only',
    clientHook: 'useLoginWithSms',
    docsUrl: 'https://docs.privy.io/authentication/user-authentication/login-methods/sms',
  },
  {
    id: 'login.google',
    category: 'Authentication',
    name: 'Google OAuth',
    description: 'Google social login.',
    surface: 'client-sdk',
    status: 'tokenable-wired',
    clientHook: 'useLoginWithOAuth',
    docsUrl: 'https://docs.privy.io/authentication/user-authentication/login-methods/oauth',
  },
  {
    id: 'login.apple',
    category: 'Authentication',
    name: 'Apple OAuth',
    description: 'Sign in with Apple.',
    surface: 'client-sdk',
    status: 'dashboard-only',
    clientHook: 'useLoginWithOAuth',
  },
  {
    id: 'login.wallet',
    category: 'Authentication',
    name: 'External wallet (SIWE)',
    description: 'MetaMask and detected wallets via Privy modal.',
    surface: 'client-sdk',
    status: 'tokenable-wired',
    clientHook: 'useLoginWithSiwe / linkWallet',
    docsUrl: 'https://docs.privy.io/wallets/connectors/usage/authenticate',
  },
  {
    id: 'login.passkey',
    category: 'Authentication',
    name: 'Passkey',
    description: 'WebAuthn passkey login.',
    surface: 'client-sdk',
    status: 'dashboard-only',
    clientHook: 'useLoginWithPasskey',
  },
  {
    id: 'login.telegram',
    category: 'Authentication',
    name: 'Telegram',
    surface: 'client-sdk',
    status: 'dashboard-only',
    clientHook: 'useLoginWithTelegram',
  },
  {
    id: 'login.farcaster',
    category: 'Authentication',
    name: 'Farcaster',
    surface: 'client-sdk',
    status: 'dashboard-only',
    clientHook: 'useLoginWithFarcasterV2',
  },

  // ── MFA ──
  {
    id: 'mfa.totp',
    category: 'MFA',
    name: 'TOTP MFA',
    description: 'Authenticator app second factor.',
    surface: 'client-sdk',
    status: 'planned',
    clientHook: 'useMfaEnrollment',
    docsUrl: 'https://docs.privy.io/authentication/user-authentication/mfa/overview',
  },
  {
    id: 'mfa.sms',
    category: 'MFA',
    name: 'SMS MFA',
    surface: 'client-sdk',
    status: 'planned',
    clientHook: 'useMfaEnrollment',
  },
  {
    id: 'mfa.passkey',
    category: 'MFA',
    name: 'Passkey MFA',
    surface: 'client-sdk',
    status: 'planned',
    clientHook: 'useMfaEnrollment',
  },

  // ── User management (server) ──
  {
    id: 'users.get',
    category: 'User management',
    name: 'Get user by ID',
    surface: 'server-api',
    status: 'swagger-proxy',
    swaggerTryPath: 'GET /api/privy/users/{privyUserId}',
    privyApiPath: 'GET /v1/users/{user_id}',
    docsUrl: 'https://docs.privy.io/user-management/users/managing-users/querying-users',
  },
  {
    id: 'users.list',
    category: 'User management',
    name: 'List users',
    surface: 'server-api',
    status: 'swagger-proxy',
    swaggerTryPath: 'GET /api/privy/users',
    privyApiPath: 'GET /v1/users',
  },
  {
    id: 'users.search',
    category: 'User management',
    name: 'Search users',
    surface: 'server-api',
    status: 'swagger-proxy',
    swaggerTryPath: 'POST /api/privy/users/search',
    privyApiPath: 'POST /v1/users/search',
  },
  {
    id: 'users.lookup-email',
    category: 'User management',
    name: 'Lookup by email',
    surface: 'server-api',
    status: 'swagger-proxy',
    swaggerTryPath: 'POST /api/privy/users/lookup/email',
  },
  {
    id: 'users.lookup-wallet',
    category: 'User management',
    name: 'Lookup by wallet address',
    surface: 'server-api',
    status: 'swagger-proxy',
    swaggerTryPath: 'POST /api/privy/users/lookup/wallet',
  },
  {
    id: 'users.create',
    category: 'User management',
    name: 'Create user',
    surface: 'server-api',
    status: 'swagger-proxy',
    swaggerTryPath: 'POST /api/privy/users',
    privyApiPath: 'POST /v1/users',
  },
  {
    id: 'users.delete',
    category: 'User management',
    name: 'Delete user',
    surface: 'server-api',
    status: 'swagger-proxy',
    swaggerTryPath: 'DELETE /api/privy/users/{privyUserId}',
  },
  {
    id: 'users.metadata',
    category: 'User management',
    name: 'Custom metadata',
    surface: 'server-api',
    status: 'swagger-proxy',
    swaggerTryPath: 'PATCH /api/privy/users/{privyUserId}/metadata',
    docsUrl: 'https://docs.privy.io/user-management/users/custom-metadata',
  },
  {
    id: 'users.link',
    category: 'User management',
    name: 'Link / unlink accounts',
    description: 'Client: useLinkAccount hooks. Server: unlinkLinkedAccount.',
    surface: 'both',
    status: 'tokenable-wired',
    clientHook: 'useLinkWallet / useUnlinkWallet',
    docsUrl: 'https://docs.privy.io/user-management/users/linking-accounts',
  },

  // ── Wallets ──
  {
    id: 'wallets.embedded',
    category: 'Wallets',
    name: 'Embedded wallets',
    description: 'Auto-create on login; sign via Privy SDK (Seaport orders).',
    surface: 'both',
    status: 'tokenable-wired',
    clientHook: 'useWallets / useCreateWallet',
    docsUrl: 'https://docs.privy.io/wallets/overview/embedded',
  },
  {
    id: 'wallets.external',
    category: 'Wallets',
    name: 'External wallets',
    description: 'MetaMask via Privy connectors + wagmi.',
    surface: 'client-sdk',
    status: 'tokenable-wired',
    clientHook: 'linkWallet / UserPill connectWallet',
    docsUrl: 'https://docs.privy.io/wallets/connectors/overview',
  },
  {
    id: 'wallets.sign-typed-data',
    category: 'Wallets',
    name: 'Sign typed data (EIP-712)',
    description: 'Seaport order signing.',
    surface: 'client-sdk',
    status: 'tokenable-wired',
    clientHook: 'useSignTypedData',
  },
  {
    id: 'wallets.send-tx',
    category: 'Wallets',
    name: 'Send transaction',
    surface: 'client-sdk',
    status: 'tokenable-wired',
    clientHook: 'useSendTransaction',
  },
  {
    id: 'wallets.export',
    category: 'Wallets',
    name: 'Export private key',
    surface: 'client-sdk',
    status: 'dashboard-only',
    clientHook: 'useExportWallet',
    docsUrl: 'https://docs.privy.io/wallets/wallets/export',
  },
  {
    id: 'wallets.smart',
    category: 'Wallets',
    name: 'Smart wallets (ERC-4337)',
    surface: 'both',
    status: 'planned',
    docsUrl: 'https://docs.privy.io/wallets/using-wallets/evm-smart-wallets/overview',
  },
  {
    id: 'wallets.server',
    category: 'Wallets',
    name: 'Server wallets',
    surface: 'server-api',
    status: 'planned',
    privyApiPath: 'POST /v1/wallets',
    docsUrl: 'https://docs.privy.io/wallets/wallets/server-side-access',
  },

  // ── Funding (Apple Pay, Google Pay, cards) ──
  {
    id: 'funding.fiat-onramp',
    category: 'Funding',
    name: 'Fiat on-ramp (card modal)',
    description:
      'Buy crypto with debit/credit card, **Apple Pay**, and **Google Pay** via Privy modal. Mainnet only.',
    surface: 'client-sdk',
    status: 'mainnet-only',
    clientHook: 'useFiatOnramp',
    docsUrl: 'https://docs.privy.io/wallets/funding/fiat-onramp',
    notes: 'Providers: Meld, MoonPay, Coinbase. Stripe Embedded supports Apple Pay & Google Pay.',
  },
  {
    id: 'funding.fund-wallet',
    category: 'Funding',
    name: 'Fund wallet (native/crypto)',
    description: 'Transfer native token or ERC-20 into embedded wallet.',
    surface: 'client-sdk',
    status: 'mainnet-only',
    clientHook: 'useFundWallet',
    docsUrl: 'https://docs.privy.io/wallets/funding/overview',
  },
  {
    id: 'funding.bank-deposit',
    category: 'Funding',
    name: 'Bank deposit (ACH / wire / SEPA)',
    description: 'Bridge bank transfer on-ramp.',
    surface: 'both',
    status: 'mainnet-only',
    clientHook: 'useFundWalletWithBankDeposit',
    privyApiPath: 'POST /v1/users/{user_id}/fiat/onramp',
    docsUrl: 'https://docs.privy.io/wallets/funding/bank-deposits',
  },
  {
    id: 'funding.crypto-deposit',
    category: 'Funding',
    name: 'Crypto deposit address',
    surface: 'client-sdk',
    status: 'mainnet-only',
    clientHook: 'useDepositAddress',
    docsUrl: 'https://docs.privy.io/wallets/funding/crypto-deposit-addresses',
  },
  {
    id: 'funding.moonpay',
    category: 'Funding',
    name: 'MoonPay on-ramp',
    surface: 'both',
    status: 'mainnet-only',
    clientHook: 'useFundWallet (moonpay)',
    privyApiPath: 'funding moonpay sign',
  },
  {
    id: 'funding.coinbase',
    category: 'Funding',
    name: 'Coinbase on-ramp',
    surface: 'server-api',
    status: 'mainnet-only',
    privyApiPath: 'funding coinbase init',
  },
  {
    id: 'funding.app-config',
    category: 'Funding',
    name: 'App funding config',
    description: 'Which on-ramp methods are enabled for this Privy app.',
    surface: 'server-api',
    status: 'swagger-proxy',
    swaggerTryPath: 'GET /api/privy/apps/settings',
  },

  // ── Controls ──
  {
    id: 'controls.policies',
    category: 'Controls',
    name: 'Wallet policies',
    surface: 'server-api',
    status: 'planned',
    privyApiPath: 'POST /v1/policies',
    docsUrl: 'https://docs.privy.io/controls/policies/overview',
  },
  {
    id: 'controls.signers',
    category: 'Controls',
    name: 'Session signers',
    surface: 'both',
    status: 'planned',
    clientHook: 'useSessionSigners',
    docsUrl: 'https://docs.privy.io/wallets/using-wallets/signers/overview',
  },
  {
    id: 'controls.gas-sponsor',
    category: 'Controls',
    name: 'Gas sponsorship',
    surface: 'server-api',
    status: 'planned',
    docsUrl: 'https://docs.privy.io/wallets/gas-and-asset-management/gas/ethereum',
  },

  // ── UI ──
  {
    id: 'ui.user-pill',
    category: 'UI components',
    name: 'UserPill',
    description: 'Login, account menu, wallet indicator.',
    surface: 'client-sdk',
    status: 'tokenable-wired',
    clientHook: 'UserPill (@privy-io/react-auth/ui)',
    docsUrl: 'https://docs.privy.io/user-management/users/ui-components',
  },
  {
    id: 'ui.wallets-dialog',
    category: 'UI components',
    name: 'WalletsDialog',
    surface: 'client-sdk',
    status: 'tokenable-wired',
    clientHook: 'WalletsDialog',
  },
  {
    id: 'ui.login-modal',
    category: 'UI components',
    name: 'Login modal',
    surface: 'client-sdk',
    status: 'tokenable-wired',
    clientHook: 'useLogin',
  },
];

export function groupPrivyCatalogByCategory(
  entries: PrivyFeatureEntry[] = PRIVY_FEATURE_CATALOG,
): Record<string, PrivyFeatureEntry[]> {
  return entries.reduce<Record<string, PrivyFeatureEntry[]>>((acc, entry) => {
    (acc[entry.category] ??= []).push(entry);
    return acc;
  }, {});
}

export function listSwaggerTryPaths(): string[] {
  return PRIVY_FEATURE_CATALOG.filter((e) => e.swaggerTryPath).map(
    (e) => e.swaggerTryPath!,
  );
}
