import { ForbiddenException } from '@nestjs/common';
import { isWalletOnlyPlaceholderEmail } from '../../auth/privy/privy-user.parser';
import type { User } from '../../user/entities/user.entity';

/**
 * Internal staging bypass — keep in sync with
 * `frontend/lib/auth/accountAccess.ts` (remove before mainnet).
 */
const KYC_DEV_BYPASS_EMAILS = new Set([
  'tokenable.dev@gmail.com',
  'ekvkd88@gmail.com',
  'giunssen@gmail.com',
  'dev@tokenable.io',
  'jongnam0309@gmail.com',
]);

/** MetaMask / external wallets used by the team (wallet-only Privy accounts). */
const KYC_DEV_BYPASS_WALLETS = new Set([
  '0xd5abdd307414718c59949ac5465930a1f8a52691',
]);

const WALLET_ONLY_EMAIL_SUFFIX = '@privy.wallet';

function normalizeWallet(address: string | null | undefined): string {
  return address?.trim().toLowerCase() ?? '';
}

function isDevBypassWallet(user: User): boolean {
  const primary = normalizeWallet(user.walletAddress);
  if (primary && KYC_DEV_BYPASS_WALLETS.has(primary)) return true;

  const email = user.email?.trim().toLowerCase() ?? '';
  if (email && isWalletOnlyPlaceholderEmail(email)) {
    const addr = email.slice(0, -WALLET_ONLY_EMAIL_SUFFIX.length);
    if (KYC_DEV_BYPASS_WALLETS.has(addr)) return true;
  }
  return false;
}

export function isInternalDevKycBypass(user: User): boolean {
  const email = user.email?.trim().toLowerCase() ?? '';
  if (email && KYC_DEV_BYPASS_EMAILS.has(email)) return true;
  return isDevBypassWallet(user);
}

/** Local dev only — when Sumsub env is not configured. */
export function isKycApprovedForCustody(user: User): boolean {
  if (isInternalDevKycBypass(user)) return true;
  return user.kycStatus === 'approved';
}

/** Sumsub configured — trust reconciled `users.kyc_status` only (no email bypass). */
export function isKycApprovedFromDb(user: User): boolean {
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

/** After Sumsub reconcile — no internal dev bypass. */
export function assertKycApprovedFromDb(user: User): void {
  if (isKycApprovedFromDb(user)) return;
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
