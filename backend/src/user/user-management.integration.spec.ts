/**
 * User management E2E validation against local Postgres.
 * Skipped when POSTGRES_* env is unavailable.
 */

import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { parsePrivyUserProfile } from '../auth/privy/privy-user.parser';
import { UserAuthProvider } from './entities/user-auth-provider.entity';
import { UserKycEvent } from './entities/user-kyc-event.entity';
import { User } from './entities/user.entity';
import { UserWallet } from './entities/user-wallet.entity';
import { UserService } from './user.service';

const TEST_PRIVY_ID = 'did:privy:e2e-validation-user';
const TEST_EMAIL = 'e2e-user-mgmt@tokenable.test';
const EMBEDDED = '0x1111111111111111111111111111111111111111';
const EXTERNAL = '0x2222222222222222222222222222222222222222';

function buildFullPrivyProfile() {
  return parsePrivyUserProfile({
    id: TEST_PRIVY_ID,
    linked_accounts: [
      { type: 'email', address: TEST_EMAIL, id: 'email-e2e' },
      {
        type: 'google_oauth',
        subject: 'google-sub-e2e',
        email: TEST_EMAIL,
        name: 'E2E User',
        id: 'google-e2e',
      },
      {
        type: 'apple_oauth',
        subject: 'apple-sub-e2e',
        email: 'e2e-apple@icloud.com',
        id: 'apple-e2e',
      },
      {
        type: 'wallet',
        chain_type: 'ethereum',
        address: EMBEDDED,
        wallet_client: 'privy',
        connector_type: 'embedded',
        id: 'w-emb',
      },
      {
        type: 'wallet',
        chain_type: 'ethereum',
        address: EXTERNAL,
        wallet_client: 'metamask',
        connector_type: 'injected',
        id: 'w-ext',
      },
    ],
  } as never);
}

describe('User management integration (Postgres)', () => {
  let dataSource: DataSource;
  let users: UserService;
  let available = false;

  beforeAll(async () => {
    try {
      const module = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({
            type: 'postgres',
            host: process.env.POSTGRES_HOST ?? 'localhost',
            port: Number(process.env.POSTGRES_PORT ?? 5432),
            username: process.env.POSTGRES_USER ?? 'tokenable',
            password: process.env.POSTGRES_PASSWORD ?? 'tokenable',
            database: process.env.POSTGRES_DB ?? 'tokenable',
            entities: [User, UserWallet, UserAuthProvider, UserKycEvent],
            synchronize: false,
          }),
          TypeOrmModule.forFeature([User, UserWallet, UserAuthProvider, UserKycEvent]),
        ],
        providers: [UserService],
      }).compile();

      dataSource = module.get(DataSource);
      users = module.get(UserService);
      await dataSource.query('SELECT 1');
      available = true;
    } catch {
      available = false;
    }
  }, 30_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  afterEach(async () => {
    if (!available || !dataSource) return;
    const rows = await dataSource.query(
      `SELECT id FROM users WHERE email = $1 OR privy_id = $2`,
      [TEST_EMAIL, TEST_PRIVY_ID],
    );
    for (const row of rows as { id: string }[]) {
      await dataSource.query(`DELETE FROM users WHERE id = $1`, [row.id]);
    }
  });

  const itIf = (name: string, fn: () => Promise<void>) => {
    it(name, async () => {
      if (!available) {
        // eslint-disable-next-line no-console
        console.warn('SKIP: Postgres unavailable for user-management integration');
        return;
      }
      await fn();
    });
  };

  itIf('creates user with all auth providers and wallets on first Privy sync', async () => {
    const profile = buildFullPrivyProfile();
    const user = await users.findOrCreateFromPrivy({
      privyId: TEST_PRIVY_ID,
      email: profile.email,
      name: profile.name,
      pictureUrl: profile.pictureUrl,
      emailVerified: profile.emailVerified,
      googleId: profile.googleId,
      authProviders: profile.authProviders,
      wallets: profile.wallets,
    });

    const providers = await users.listAuthProvidersForUser(user.id);
    const wallets = await users.listWalletsForUser(user.id);

    expect(providers.map((p) => p.providerType).sort()).toEqual(
      ['apple_oauth', 'email', 'google_oauth', 'privy', 'wallet', 'wallet'].sort(),
    );
    expect(wallets).toHaveLength(2);
    expect(wallets.find((w) => w.walletKind === 'embedded')?.source).toBe('privy_sync');
    expect(wallets.find((w) => w.walletKind === 'external')?.walletClient).toBe('metamask');
  });

  itIf('updates existing user on re-sync without duplicate rows', async () => {
    const profile = buildFullPrivyProfile();
    const first = await users.findOrCreateFromPrivy({
      privyId: TEST_PRIVY_ID,
      email: profile.email,
      name: profile.name,
      pictureUrl: profile.pictureUrl,
      emailVerified: profile.emailVerified,
      googleId: profile.googleId,
      authProviders: profile.authProviders,
      wallets: profile.wallets,
    });

    const second = await users.findOrCreateFromPrivy({
      privyId: TEST_PRIVY_ID,
      email: profile.email,
      name: 'E2E User Updated',
      pictureUrl: profile.pictureUrl,
      emailVerified: profile.emailVerified,
      googleId: profile.googleId,
      authProviders: profile.authProviders,
      wallets: profile.wallets,
    });

    expect(second.id).toBe(first.id);
    expect(second.name).toBe('E2E User Updated');

    const dupUsers = await dataSource.query(
      `SELECT COUNT(*)::int AS cnt FROM users WHERE privy_id = $1`,
      [TEST_PRIVY_ID],
    );
    expect((dupUsers[0] as { cnt: number }).cnt).toBe(1);

    const dupProviders = await dataSource.query(
      `SELECT COUNT(*)::int AS cnt FROM user_auth_providers
       WHERE user_id = $1 AND unlinked_at IS NULL`,
      [first.id],
    );
    expect((dupProviders[0] as { cnt: number }).cnt).toBe(6);

    const dupWallets = await dataSource.query(
      `SELECT COUNT(*)::int AS cnt FROM user_wallets WHERE user_id = $1`,
      [first.id],
    );
    expect((dupWallets[0] as { cnt: number }).cnt).toBe(2);
  });

  itIf('merges Privy account onto existing email user without duplicate users', async () => {
    const legacy = await dataSource.getRepository(User).save(
      dataSource.getRepository(User).create({
        email: TEST_EMAIL,
        passwordHash: 'hash',
        name: 'Legacy',
        googleId: null,
        emailVerified: false,
      }),
    );

    const profile = buildFullPrivyProfile();
    const merged = await users.findOrCreateFromPrivy({
      privyId: TEST_PRIVY_ID,
      email: profile.email,
      name: profile.name,
      pictureUrl: profile.pictureUrl,
      emailVerified: profile.emailVerified,
      googleId: profile.googleId,
      authProviders: profile.authProviders,
      wallets: profile.wallets,
    });

    expect(merged.id).toBe(legacy.id);
    expect(merged.privyId).toBe(TEST_PRIVY_ID);

    const cnt = await dataSource.query(
      `SELECT COUNT(*)::int AS cnt FROM users WHERE lower(email) = lower($1)`,
      [TEST_EMAIL],
    );
    expect((cnt[0] as { cnt: number }).cnt).toBe(1);
  });

  itIf('soft-unlinks removed auth providers on sync', async () => {
    const profile = buildFullPrivyProfile();
    const user = await users.findOrCreateFromPrivy({
      privyId: TEST_PRIVY_ID,
      email: profile.email,
      authProviders: profile.authProviders,
      wallets: profile.wallets,
    });

    const trimmed = profile.authProviders.filter((p) => p.providerType !== 'apple_oauth');
    await users.syncPrivyIdentity(user.id, trimmed, profile.wallets);

    const active = await users.listAuthProvidersForUser(user.id);
    expect(active.some((p) => p.providerType === 'apple_oauth')).toBe(false);

    const unlinked = await dataSource.query(
      `SELECT COUNT(*)::int AS cnt FROM user_auth_providers
       WHERE user_id = $1 AND provider_type = 'apple_oauth' AND unlinked_at IS NOT NULL`,
      [user.id],
    );
    expect((unlinked[0] as { cnt: number }).cnt).toBe(1);
  });
});
