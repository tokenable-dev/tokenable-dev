import { parsePrivyUserProfile } from './privy-user.parser';

const PRIVY_ID = 'did:privy:test-user-001';
const WALLET = '0x2925a6Fa34C2CF44B3d2857777D7a301077211f7';
const GOOGLE_SUB = '103036793357170009665';

function privyUser(linkedAccounts: Record<string, unknown>[]) {
  return {
    id: PRIVY_ID,
    linked_accounts: linkedAccounts,
  } as never;
}

describe('parsePrivyUserProfile', () => {
  it('parses email OTP login', () => {
    const profile = parsePrivyUserProfile(
      privyUser([
        { type: 'email', address: 'user@example.com', id: 'email-1' },
      ]),
    );
    expect(profile.email).toBe('user@example.com');
    expect(profile.emailVerified).toBe(true);
    expect(profile.authProviders.some((p) => p.providerType === 'email')).toBe(
      true,
    );
    expect(profile.authProviders.some((p) => p.providerType === 'privy')).toBe(
      true,
    );
  });

  it('parses Google OAuth login', () => {
    const profile = parsePrivyUserProfile(
      privyUser([
        {
          type: 'google_oauth',
          subject: GOOGLE_SUB,
          email: 'tokenable.dev@gmail.com',
          name: 'Tokenable Dev',
          profile_picture_url: 'https://example.com/p.jpg',
          id: 'google-1',
        },
      ]),
    );
    expect(profile.email).toBe('tokenable.dev@gmail.com');
    expect(profile.googleId).toBe(GOOGLE_SUB);
    expect(profile.name).toBe('Tokenable Dev');
    expect(
      profile.authProviders.some((p) => p.providerType === 'google_oauth'),
    ).toBe(true);
  });

  it('parses Apple OAuth login', () => {
    const profile = parsePrivyUserProfile(
      privyUser([
        {
          type: 'apple_oauth',
          subject: 'apple-sub-xyz',
          email: 'user@icloud.com',
          name: 'Apple User',
          id: 'apple-1',
        },
      ]),
    );
    expect(profile.email).toBe('user@icloud.com');
    expect(
      profile.authProviders.some((p) => p.providerType === 'apple_oauth'),
    ).toBe(true);
  });

  it('parses embedded + external Ethereum wallets', () => {
    const external = '0x2222222222222222222222222222222222222222';
    const profile = parsePrivyUserProfile(
      privyUser([
        {
          type: 'wallet',
          chain_type: 'ethereum',
          address: WALLET,
          wallet_client: 'privy',
          connector_type: 'embedded',
          id: 'w-embedded',
        },
        {
          type: 'wallet',
          chain_type: 'ethereum',
          address: external,
          wallet_client: 'metamask',
          connector_type: 'injected',
          id: 'w-external',
        },
      ]),
    );
    expect(profile.wallets).toHaveLength(2);
    expect(profile.wallets[0]?.address).toBe(external);
    expect(profile.wallets[0]?.walletKind).toBe('external');
    expect(profile.wallets[1]?.walletKind).toBe('embedded');
    expect(profile.authProviders.filter((p) => p.providerType === 'wallet')).toHaveLength(2);
  });

  it('uses wallet-only placeholder email when no inbox linked', () => {
    const profile = parsePrivyUserProfile(
      privyUser([
        {
          type: 'wallet',
          chain_type: 'ethereum',
          address: WALLET,
          wallet_client: 'metamask',
          connector_type: 'injected',
          id: 'w-only',
        },
      ]),
    );
    expect(profile.email).toContain('@privy.wallet');
    expect(profile.emailVerified).toBe(false);
  });

  it('dedupes email + google with same inbox', () => {
    const profile = parsePrivyUserProfile(
      privyUser([
        { type: 'email', address: 'tokenable.dev@gmail.com', id: 'e1' },
        {
          type: 'google_oauth',
          subject: GOOGLE_SUB,
          email: 'tokenable.dev@gmail.com',
          id: 'g1',
        },
      ]),
    );
    expect(profile.email).toBe('tokenable.dev@gmail.com');
    expect(profile.authProviders.filter((p) => p.providerType === 'email')).toHaveLength(1);
    expect(profile.authProviders.filter((p) => p.providerType === 'google_oauth')).toHaveLength(1);
  });
});
