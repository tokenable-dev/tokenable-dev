import { createHmac, timingSafeEqual } from 'crypto';

export const MARKETPLACE_ADMIN_COOKIE = 'marketplace_admin';

export type MarketplaceAdminAuthConfig = {
  username: string;
  password: string;
  sessionSecret: string;
  sessionSeconds: number;
};

export function readMarketplaceAdminAuthConfig(
  env: NodeJS.ProcessEnv,
): MarketplaceAdminAuthConfig {
  const username = env.MARKETPLACE_ADMIN_USERNAME?.trim() || 'skyand';
  const password = env.MARKETPLACE_ADMIN_PASSWORD?.trim() || '071725';
  const sessionSecret =
    env.MARKETPLACE_ADMIN_SESSION_SECRET?.trim() ||
    env.SITE_ACCESS_SECRET?.trim() ||
    (env.NODE_ENV === 'production' ? '' : 'dev-marketplace-admin-secret');
  const sessionSeconds = clampInt(
    env.MARKETPLACE_ADMIN_SESSION_SECONDS,
    28_800,
    300,
    86_400,
  );

  return { username, password, sessionSecret, sessionSeconds };
}

export function assertMarketplaceAdminAuthConfig(
  cfg: MarketplaceAdminAuthConfig,
): void {
  if (!cfg.sessionSecret || cfg.sessionSecret.length < 16) {
    throw new Error(
      'MARKETPLACE_ADMIN_SESSION_SECRET (min 16 chars) or SITE_ACCESS_SECRET is required',
    );
  }
  if (!cfg.username) {
    throw new Error('MARKETPLACE_ADMIN_USERNAME is required');
  }
  if (!cfg.password) {
    throw new Error('MARKETPLACE_ADMIN_PASSWORD is required');
  }
}

export function issueMarketplaceAdminToken(
  secret: string,
  sessionSeconds: number,
): string {
  const exp = Math.floor(Date.now() / 1000) + sessionSeconds;
  const sig = signMarketplaceAdminExp(secret, exp);
  return `${exp}.${sig}`;
}

export function verifyMarketplaceAdminToken(
  token: string | undefined,
  secret: string,
): boolean {
  if (!token?.trim() || !secret) return false;
  const [expRaw, sig] = token.split('.');
  if (!expRaw || !sig) return false;

  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) return false;

  const expected = signMarketplaceAdminExp(secret, exp);
  return safeEqualHex(sig, expected);
}

function signMarketplaceAdminExp(secret: string, exp: number): string {
  return createHmac('sha256', secret).update(String(exp)).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ab = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ab.length !== bb.length || ab.length === 0) return false;
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

function clampInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}
