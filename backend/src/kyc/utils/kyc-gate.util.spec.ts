import { ForbiddenException } from '@nestjs/common';
import type { User } from '../../user/entities/user.entity';
import {
  assertKycApprovedForCustody,
  assertKycApprovedFromDb,
  isInternalDevKycBypass,
  isKycApprovedForCustody,
  isKycApprovedFromDb,
} from './kyc-gate.util';

function user(partial: Partial<User>): User {
  return partial as User;
}

describe('kyc-gate.util', () => {
  it('allows approved users', () => {
    expect(isKycApprovedForCustody(user({ kycStatus: 'approved' }))).toBe(true);
    expect(() =>
      assertKycApprovedForCustody(user({ kycStatus: 'approved' })),
    ).not.toThrow();
  });

  it('allows internal staging bypass when Sumsub is not configured', () => {
    expect(
      isKycApprovedForCustody(
        user({ email: 'dev@tokenable.io', kycStatus: 'none' }),
      ),
    ).toBe(true);
    expect(isInternalDevKycBypass(user({ email: 'dev@tokenable.io' }))).toBe(
      true,
    );
  });

  it('strict db gate ignores bypass', () => {
    expect(
      isKycApprovedFromDb(user({ email: 'dev@tokenable.io', kycStatus: 'none' })),
    ).toBe(false);
    expect(() =>
      assertKycApprovedFromDb(
        user({ email: 'dev@tokenable.io', kycStatus: 'none' }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('blocks none / pending / rejected with distinct messages', () => {
    expect(() =>
      assertKycApprovedForCustody(user({ kycStatus: 'none', email: 'a@b.com' })),
    ).toThrow(ForbiddenException);

    try {
      assertKycApprovedForCustody(user({ kycStatus: 'pending', email: 'a@b.com' }));
      fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenException);
      expect((e as ForbiddenException).message).toMatch(/in progress/i);
    }

    try {
      assertKycApprovedForCustody(user({ kycStatus: 'rejected', email: 'a@b.com' }));
      fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenException);
      expect((e as ForbiddenException).message).toMatch(/not approved/i);
    }
  });
});
