/** Normalized linked auth method from Privy linked_accounts. */
export type ParsedAuthProvider = {
  providerType: string;
  providerSubject: string;
  providerAccountId?: string | null;
  email?: string | null;
  phone?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  isVerified: boolean;
  metadata?: Record<string, unknown>;
};

/** Normalized wallet link from Privy linked_accounts. */
export type ParsedWalletLink = {
  address: string;
  chainType: string;
  walletKind: 'embedded' | 'external';
  walletClient?: string | null;
  connectorType?: string | null;
  providerAccountId?: string | null;
};

/** Normalized profile extracted from a Privy user object. */
export type ParsedPrivyProfile = {
  email: string;
  name: string | null;
  pictureUrl: string | null;
  emailVerified: boolean;
  googleId: string | null;
  authProviders: ParsedAuthProvider[];
  wallets: ParsedWalletLink[];
  /** @deprecated Use wallets[].address — kept for callers during migration */
  walletAddresses: string[];
};
