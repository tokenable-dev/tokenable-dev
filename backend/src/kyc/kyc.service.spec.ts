import type { User } from '../user/entities/user.entity';
import type { UserService } from '../user/user.service';
import { KycService, sumsubEmailForUser } from './kyc.service';
import type { SumsubApiService } from './sumsub-api.service';

describe('sumsubEmailForUser', () => {
  it('returns real emails', () => {
    expect(sumsubEmailForUser('user@example.com')).toBe('user@example.com');
    expect(sumsubEmailForUser('  user@example.com  ')).toBe('user@example.com');
  });

  it('omits wallet-only placeholders', () => {
    expect(
      sumsubEmailForUser(
        '0xd5abdd307414718c59949ac5465930a1f8a52691@privy.wallet',
      ),
    ).toBeUndefined();
  });

  it('omits empty values', () => {
    expect(sumsubEmailForUser(undefined)).toBeUndefined();
    expect(sumsubEmailForUser(null)).toBeUndefined();
    expect(sumsubEmailForUser('')).toBeUndefined();
    expect(sumsubEmailForUser('   ')).toBeUndefined();
  });
});

describe('KycService.createAccessToken', () => {
  function makeUser(overrides: Partial<User>): User {
    return {
      id: 'user-1',
      email: 'user@example.com',
      kycStatus: 'none',
      kycExternalId: null,
      ...overrides,
    } as User;
  }

  it('does not forward @privy.wallet email to Sumsub', async () => {
    const createApplicant = jest.fn().mockResolvedValue({ id: 'app-1' });
    const createSdkAccessToken = jest
      .fn()
      .mockResolvedValue({ token: 'tok', userId: 'user-1' });
    const sumsub = {
      getApplicantByExternalUserId: jest.fn().mockResolvedValue(null),
      createApplicant,
      createSdkAccessToken,
      isConfigured: jest.fn().mockReturnValue(true),
    } as unknown as SumsubApiService;
    const users = {
      updateKycStatus: jest.fn().mockResolvedValue(undefined),
    } as unknown as UserService;

    const service = new KycService(users, sumsub);
    await service.createAccessToken(
      makeUser({
        email: '0xd5abdd307414718c59949ac5465930a1f8a52691@privy.wallet',
      }),
    );

    expect(createApplicant).toHaveBeenCalledWith({
      externalUserId: 'user-1',
      email: undefined,
    });
    expect(createSdkAccessToken).toHaveBeenCalledWith({
      externalUserId: 'user-1',
      email: undefined,
    });
  });

  it('forwards real emails to Sumsub', async () => {
    const createApplicant = jest.fn().mockResolvedValue({ id: 'app-2' });
    const createSdkAccessToken = jest
      .fn()
      .mockResolvedValue({ token: 'tok', userId: 'user-1' });
    const sumsub = {
      getApplicantByExternalUserId: jest.fn().mockResolvedValue(null),
      createApplicant,
      createSdkAccessToken,
      isConfigured: jest.fn().mockReturnValue(true),
    } as unknown as SumsubApiService;
    const users = {
      updateKycStatus: jest.fn().mockResolvedValue(undefined),
    } as unknown as UserService;

    const service = new KycService(users, sumsub);
    await service.createAccessToken(makeUser({ email: 'user@example.com' }));

    expect(createApplicant).toHaveBeenCalledWith({
      externalUserId: 'user-1',
      email: 'user@example.com',
    });
    expect(createSdkAccessToken).toHaveBeenCalledWith({
      externalUserId: 'user-1',
      email: 'user@example.com',
    });
  });
});
