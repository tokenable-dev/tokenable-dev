import { createHmac, timingSafeEqual } from 'crypto';

export const SITE_ACCESS_COOKIE = 'site_access';

export type SiteAccessConfig = {
  enabled: boolean;
  password: string;
  secret: string;
  sessionSeconds: number;
};

export function readSiteAccessConfig(env: NodeJS.ProcessEnv): SiteAccessConfig {
  const enabled = parseTruthy(env.SITE_ACCESS_ENABLED);
  const password = env.SITE_ACCESS_PASSWORD?.trim() ?? '';
  const secret = env.SITE_ACCESS_SECRET?.trim() ?? '';
  const sessionSeconds = clampInt(env.SITE_ACCESS_SESSION_SECONDS, 3600, 60, 86_400);

  return { enabled, password, secret, sessionSeconds };
}

export function assertSiteAccessConfig(cfg: SiteAccessConfig): void {
  if (!cfg.enabled) return;
  if (!cfg.password) {
    throw new Error('SITE_ACCESS_PASSWORD is required when SITE_ACCESS_ENABLED=true');
  }
  if (!cfg.secret || cfg.secret.length < 16) {
    throw new Error(
      'SITE_ACCESS_SECRET (min 16 chars) is required when SITE_ACCESS_ENABLED=true',
    );
  }
}

export function issueSiteAccessToken(secret: string, sessionSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + sessionSeconds;
  const sig = signSiteAccessExp(secret, exp);
  return `${exp}.${sig}`;
}

export function verifySiteAccessToken(
  token: string | undefined,
  secret: string,
): boolean {
  if (!token?.trim() || !secret) return false;
  const [expRaw, sig] = token.split('.');
  if (!expRaw || !sig) return false;

  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) return false;

  const expected = signSiteAccessExp(secret, exp);
  return safeEqualHex(sig, expected);
}

/** Re-issue site-access cookie after successful sign-in (OAuth redirect may drop the prior gate cookie). */
export function maybeRefreshSiteAccessCookie(
  res: import('express').Response,
  env: NodeJS.ProcessEnv,
  cookieSecure: boolean,
): void {
  const cfg = readSiteAccessConfig(env);
  if (!cfg.enabled || !cfg.secret) return;

  const token = issueSiteAccessToken(cfg.secret, cfg.sessionSeconds);
  res.cookie(SITE_ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: cfg.sessionSeconds * 1000,
  });
}

function signSiteAccessExp(secret: string, exp: number): string {
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

function parseTruthy(raw: string | undefined): boolean {
  const v = raw?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
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
