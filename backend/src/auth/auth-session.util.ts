import type { Response } from 'express';
import type { ConfigService } from '@nestjs/config';
import type { User } from '../user/entities/user.entity';
import type { UserWallet } from '../user/entities/user-wallet.entity';

export function resolveCookieSecure(
  config: ConfigService,
  frontUrl: string,
): boolean {
  const explicit = config.get<string>('COOKIE_SECURE');
  if (explicit === 'true') return true;
  if (explicit === 'false') return false;
  return frontUrl.startsWith('https:');
}

export function setAccessTokenCookie(
  res: Response,
  token: string,
  config: ConfigService,
): void {
  const frontBase = config.getOrThrow<string>('FRONTEND_URL').replace(/\/$/, '');
  const maxAge = 7 * 24 * 60 * 60 * 1000;
  res.cookie('access_token', token, {
    httpOnly: true,
    secure: resolveCookieSecure(config, frontBase),
    sameSite: 'lax',
    maxAge,
    path: '/',
  });
}

export function clearAccessTokenCookie(
  res: Response,
  config: ConfigService,
): void {
  const frontBase = config.getOrThrow<string>('FRONTEND_URL').replace(/\/$/, '');
  res.clearCookie('access_token', {
    httpOnly: true,
    secure: resolveCookieSecure(config, frontBase),
    sameSite: 'lax',
    path: '/',
  });
}

/** Email/password accounts must verify inbox before a session is valid. */
export function userMayAuthenticate(user: User): boolean {
  if (!user.passwordHash) return true;
  return user.emailVerified;
}

export type SerializedLinkedWallet = {
  address: string;
  linkedAt: string;
  isPrimary: boolean;
};

export function serializeAuthUser(user: User, wallets: UserWallet[] = []) {
  const primary =
    wallets.find((w) => w.isPrimary) ??
    wallets[0] ??
    (user.walletAddress
      ? ({
          walletAddress: user.walletAddress,
          linkedAt: user.walletLinkedAt ?? new Date(),
          isPrimary: true,
        } as Pick<UserWallet, 'walletAddress' | 'linkedAt' | 'isPrimary'>)
      : null);

  const serializedWallets: SerializedLinkedWallet[] = wallets.map((w) => ({
    address: w.walletAddress,
    linkedAt: w.linkedAt.toISOString(),
    isPrimary: w.isPrimary,
  }));

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    pictureUrl: user.pictureUrl,
    emailVerified: user.emailVerified,
    hasPassword: !!user.passwordHash,
    walletAddress: primary?.walletAddress ?? user.walletAddress ?? null,
    walletLinkedAt: primary?.linkedAt
      ? new Date(primary.linkedAt).toISOString()
      : user.walletLinkedAt
        ? new Date(user.walletLinkedAt).toISOString()
        : null,
    wallets: serializedWallets,
  };
}
