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

  it('allows internal staging bypass emails', () => {
    for (const email of [
      'tokenable.dev@gmail.com',
      'ekvkd88@gmail.com',
      'giunssen@gmail.com',
      'dev@tokenable.io',
      'jongnam0309@gmail.com',
    ]) {
      expect(
        isKycApprovedForCustody(user({ email, kycStatus: 'none' })),
      ).toBe(true);
    }
  });

  it('allows internal staging bypass wallets', () => {
    expect(
      isKycApprovedForCustody(
        user({
          walletAddress: '0xD5abDD307414718C59949Ac5465930a1F8a52691',
          kycStatus: 'none',
          email: 'other@example.com',
        }),
      ),
    ).toBe(true);

    expect(
      isKycApprovedForCustody(
        user({
          email: '0xd5abdd307414718c59949ac5465930a1f8a52691@privy.wallet',
          kycStatus: 'none',
          walletAddress: null,
        }),
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
