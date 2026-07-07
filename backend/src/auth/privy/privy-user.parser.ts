import { getAddress } from 'ethers';
import type { User as PrivyUser } from '@privy-io/node';
import type {
  ParsedAuthProvider,
  ParsedPrivyProfile,
  ParsedWalletLink,
} from './privy.types';

const WALLET_ONLY_EMAIL_SUFFIX = '@privy.wallet';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

/** Synthetic email for wallet-only Privy accounts (no inbox — identity is the wallet). */
export function walletOnlyPlaceholderEmail(address: string): string {
  return `${getAddress(address).toLowerCase()}${WALLET_ONLY_EMAIL_SUFFIX}`;
}

export function isWalletOnlyPlaceholderEmail(email: string): boolean {
  return email.toLowerCase().endsWith(WALLET_ONLY_EMAIL_SUFFIX);
}

function pushAuthProvider(
  providers: ParsedAuthProvider[],
  seen: Set<string>,
  row: ParsedAuthProvider,
): void {
  const key = `${row.providerType}:${row.providerSubject.toLowerCase()}`;
  if (seen.has(key)) return;
  seen.add(key);
  providers.push(row);
}

function parseWalletAccount(
  account: Record<string, unknown>,
): ParsedWalletLink | null {
  const chainType = readString(account.chain_type) ?? 'ethereum';
  if (chainType !== 'ethereum') return null;

  const addressRaw = readString(account.address);
  if (!addressRaw) return null;

  const walletClient = readString(account.wallet_client);
  const connectorType = readString(account.connector_type);
  const isEmbedded =
    walletClient === 'privy' || connectorType === 'embedded';

  return {
    address: getAddress(addressRaw),
    chainType,
    walletKind: isEmbedded ? 'embedded' : 'external',
    walletClient,
    connectorType,
    providerAccountId: readString(account.id),
  };
}

/** Map Privy `linked_accounts` → normalized profile for local user storage. */
export function parsePrivyUserProfile(privyUser: PrivyUser): ParsedPrivyProfile {
  const emails = new Set<string>();
  let name: string | null = null;
  let pictureUrl: string | null = null;
  let googleId: string | null = null;
  let emailVerified = false;

  const authProviders: ParsedAuthProvider[] = [];
  const providerSeen = new Set<string>();
  const wallets: ParsedWalletLink[] = [];
  const walletSeen = new Set<string>();

  // Root Privy identity — always stored for lookup and admin visibility.
  pushAuthProvider(authProviders, providerSeen, {
    providerType: 'privy',
    providerSubject: privyUser.id,
    providerAccountId: privyUser.id,
    isVerified: true,
    metadata: { privy_user_id: privyUser.id },
  });

  for (const account of privyUser.linked_accounts ?? []) {
    if (!isRecord(account)) continue;
    const type = readString(account.type);
    if (!type) continue;

    const accountId = readString(account.id);

    if (type === 'email') {
      const address = readString(account.address);
      if (address) {
        const normalized = address.toLowerCase();
        emails.add(normalized);
        emailVerified = true;
        pushAuthProvider(authProviders, providerSeen, {
          providerType: 'email',
          providerSubject: normalized,
          providerAccountId: accountId,
          email: normalized,
          isVerified: true,
        });
      }
      continue;
    }

    if (type === 'google_oauth') {
      const email = readString(account.email);
      const subject = readString(account.subject);
      if (email) emails.add(email.toLowerCase());
      googleId = subject ?? googleId;
      name = readString(account.name) ?? name;
      pictureUrl = readString(account.profile_picture_url) ?? pictureUrl;
      emailVerified = true;
      if (subject) {
        pushAuthProvider(authProviders, providerSeen, {
          providerType: 'google_oauth',
          providerSubject: subject,
          providerAccountId: accountId,
          email: email?.toLowerCase() ?? null,
          displayName: readString(account.name),
          avatarUrl: readString(account.profile_picture_url),
          isVerified: true,
          metadata: { google_subject: subject },
        });
      }
      continue;
    }

    if (type === 'apple_oauth') {
      const email = readString(account.email);
      const subject = readString(account.subject);
      if (email) emails.add(email.toLowerCase());
      name = readString(account.name) ?? name;
      emailVerified = Boolean(email);
      if (subject) {
        pushAuthProvider(authProviders, providerSeen, {
          providerType: 'apple_oauth',
          providerSubject: subject,
          providerAccountId: accountId,
          email: email?.toLowerCase() ?? null,
          displayName: readString(account.name),
          isVerified: Boolean(email),
        });
      }
      continue;
    }

    if (type === 'sms') {
      const phone = readString(account.phone_number);
      if (phone) {
        pushAuthProvider(authProviders, providerSeen, {
          providerType: 'sms',
          providerSubject: phone,
          providerAccountId: accountId,
          phone,
          isVerified: true,
        });
      }
      continue;
    }

    if (type === 'passkey') {
      const subject = readString(account.credential_id) ?? accountId;
      if (subject) {
        pushAuthProvider(authProviders, providerSeen, {
          providerType: 'passkey',
          providerSubject: subject,
          providerAccountId: accountId,
          isVerified: true,
        });
      }
      continue;
    }

    if (type === 'wallet') {
      const wallet = parseWalletAccount(account);
      if (!wallet) continue;

      const addrKey = wallet.address.toLowerCase();
      if (!walletSeen.has(addrKey)) {
        walletSeen.add(addrKey);
        wallets.push(wallet);
      }

      pushAuthProvider(authProviders, providerSeen, {
        providerType: 'wallet',
        providerSubject: addrKey,
        providerAccountId: accountId,
        isVerified: true,
        metadata: {
          chain_type: wallet.chainType,
          wallet_kind: wallet.walletKind,
          wallet_client: wallet.walletClient,
          connector_type: wallet.connectorType,
        },
      });
      continue;
    }

    // Future OAuth providers (twitter, discord, github, etc.)
    const subject =
      readString(account.subject) ??
      readString(account.username) ??
      accountId;
    if (subject) {
      pushAuthProvider(authProviders, providerSeen, {
        providerType: type,
        providerSubject: subject,
        providerAccountId: accountId,
        email: readString(account.email)?.toLowerCase() ?? null,
        displayName: readString(account.name) ?? readString(account.username),
        avatarUrl: readString(account.profile_picture_url),
        isVerified: Boolean(readString(account.email)),
        metadata: { raw_type: type },
      });
    }
  }

  // External wallets first — wallet-first identity for vault/KYC.
  const external = wallets.filter((w) => w.walletKind === 'external');
  const embedded = wallets.filter((w) => w.walletKind === 'embedded');
  const orderedWallets = [...external, ...embedded];
  const walletAddresses = orderedWallets.map((w) => w.address);

  let email = emails.values().next().value as string | undefined;
  if (!email) {
    const primaryWallet = external[0] ?? embedded[0];
    if (!primaryWallet) {
      throw new Error('Privy user has no linked email or wallet');
    }
    email = walletOnlyPlaceholderEmail(primaryWallet.address);
    emailVerified = false;
  }

  return {
    email,
    name,
    pictureUrl,
    emailVerified,
    googleId,
    authProviders,
    wallets: orderedWallets,
    walletAddresses,
  };
}
