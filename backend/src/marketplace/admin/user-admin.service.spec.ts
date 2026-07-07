import { privyAuthMethod } from './user-admin.service';
import type { User } from '../../user/entities/user.entity';

function mockUser(partial: Partial<User>): User {
  return partial as User;
}

describe('UserAdminService privyAuthMethod', () => {
  it('classifies wallet-first Privy users', () => {
    expect(
      privyAuthMethod(
        mockUser({ privyId: 'did:privy:abc', googleId: null }),
        ['privy', 'wallet'],
      ),
    ).toBe('wallet');
  });

  it('classifies Google + email OTP via Privy', () => {
    expect(
      privyAuthMethod(
        mockUser({ privyId: 'did:privy:abc', googleId: 'g123' }),
        ['privy', 'email', 'google_oauth'],
      ),
    ).toBe('google+email');
  });

  it('classifies pre-Privy accounts as legacy', () => {
    expect(
      privyAuthMethod(
        mockUser({ privyId: null, googleId: 'g123', passwordHash: 'hash' }),
        ['google_oauth'],
      ),
    ).toBe('legacy');
  });
});
