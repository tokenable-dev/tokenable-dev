import { ForbiddenException } from '@nestjs/common';
import type { User } from '../../user/entities/user.entity';

/** Internal staging bypass — same email as frontend `accountAccess` (remove before mainnet). */
const KYC_DEV_BYPASS_EMAILS = new Set(['tokenable.dev@gmail.com']);

export function isKycApprovedForCustody(user: User): boolean {
  const email = user.email?.trim().toLowerCase() ?? '';
  if (email && KYC_DEV_BYPASS_EMAILS.has(email)) return true;
  return user.kycStatus === 'approved';
}

/** Vault mint / physical redeem — Level 2 custody actions. */
export function assertKycApprovedForCustody(user: User): void {
  if (isKycApprovedForCustody(user)) return;
  if (user.kycStatus === 'pending') {
    throw new ForbiddenException(
      'Identity verification is still in progress. Please wait for approval before continuing.',
    );
  }
  if (user.kycStatus === 'rejected') {
    throw new ForbiddenException(
      'Identity verification was not approved. Please retry KYC before continuing.',
    );
  }
  throw new ForbiddenException(
    'Identity verification is required before vault deposit or physical card redemption.',
  );
}
