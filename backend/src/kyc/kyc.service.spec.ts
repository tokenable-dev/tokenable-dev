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
      fetchApplicantByExternalUserId: jest.fn().mockResolvedValue(null),
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
      fetchApplicantByExternalUserId: jest.fn().mockResolvedValue(null),
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

describe('KycService.reconcileUser', () => {
  function makeUser(overrides: Partial<User>): User {
    return {
      id: 'user-1',
      email: 'user@example.com',
      kycStatus: 'approved',
      kycExternalId: 'old-app-applicant',
      ...overrides,
    } as User;
  }

  it('clears stale approved when applicant missing in current Sumsub app', async () => {
    const updateKycStatus = jest.fn().mockResolvedValue(
      makeUser({ kycStatus: 'none', kycExternalId: null }),
    );
    const sumsub = {
      isConfigured: jest.fn().mockReturnValue(true),
      fetchApplicantByExternalUserId: jest.fn().mockResolvedValue(null),
    } as unknown as SumsubApiService;
    const users = { updateKycStatus } as unknown as UserService;

    const service = new KycService(users, sumsub);
    const result = await service.reconcileUser(makeUser({}));

    expect(updateKycStatus).toHaveBeenCalledWith('user-1', {
      status: 'none',
      provider: 'sumsub',
      externalId: null,
      payload: expect.objectContaining({ reason: 'applicant_not_found' }),
    });
    expect(result.kycStatus).toBe('none');
  });

  it('syncs approved from Sumsub GREEN review', async () => {
    const updateKycStatus = jest.fn().mockResolvedValue(
      makeUser({ kycStatus: 'approved', kycExternalId: 'app-new' }),
    );
    const sumsub = {
      isConfigured: jest.fn().mockReturnValue(true),
      fetchApplicantByExternalUserId: jest.fn().mockResolvedValue({
        id: 'app-new',
        review: {
          reviewStatus: 'completed',
          reviewResult: { reviewAnswer: 'GREEN' },
        },
      }),
    } as unknown as SumsubApiService;
    const users = { updateKycStatus } as unknown as UserService;

    const service = new KycService(users, sumsub);
    await service.reconcileUser(makeUser({ kycStatus: 'none', kycExternalId: null }));

    expect(updateKycStatus).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        status: 'approved',
        externalId: 'app-new',
      }),
    );
  });
});
