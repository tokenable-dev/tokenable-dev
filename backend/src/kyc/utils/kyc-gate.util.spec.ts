import { ForbiddenException } from '@nestjs/common';
import type { User } from '../../user/entities/user.entity';
import {
  assertKycApprovedForCustody,
  isKycApprovedForCustody,
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

  it('allows internal staging bypass email', () => {
    expect(
      isKycApprovedForCustody(
        user({ email: 'tokenable.dev@gmail.com', kycStatus: 'none' }),
      ),
    ).toBe(true);
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
