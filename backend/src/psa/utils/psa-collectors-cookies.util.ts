import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

/** Cookie shape accepted by Playwright `context.addCookies`. */
export type PsaCollectorsCookie = {
  name: string;
  value: string;
  path?: string;
  domain?: string;
  url?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  expires?: number;
};

export const PSA_COLLECTORS_AUTH_COOKIE_NAMES = ['DSR', 'refreshToken'] as const;
/** Cookies safe to persist — `accessToken` breaks headless Collectors auth. */
export const PSA_PERSISTABLE_COOKIE_NAMES = [
  ...PSA_COLLECTORS_AUTH_COOKIE_NAMES,
  'cf_clearance',
  '__cf_bm',
] as const;
const EPHEMERAL_COOKIE_NAMES = new Set(['cf_clearance', '__cf_bm']);
const EXCLUDED_EXPORT_COOKIE_NAMES = new Set(['accessToken']);
const AUTH_DOMAINS = ['.collectors.com', '.psacard.com'] as const;

/** Playwright cookies JSON — supports duplicate names on different domains. */
export async function loadPsaCollectorsCookies(options: {
  cookiesFile?: string;
  cwd?: string;
}): Promise<PsaCollectorsCookie[]> {
  const file = options.cookiesFile?.trim();
  if (!file) return [];

  const abs = resolve(options.cwd ?? process.cwd(), file);
  let raw: string;
  try {
    raw = await readFile(abs, 'utf8');
  } catch (e: unknown) {
    if (isEnoentError(e)) return [];
    throw e;
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('PSA_COLLECTORS_COOKIES_FILE must be a JSON array');
  }

  const rows = parsed
    .map(normalizePlaywrightCookie)
    .filter((c): c is PsaCollectorsCookie => c != null);

  return preparePsaCollectorsCookies(rows).cookies;
}

export function preparePsaCollectorsCookies(
  raw: PsaCollectorsCookie[],
  options?: { nowMs?: number },
): { cookies: PsaCollectorsCookie[]; warnings: string[] } {
  const warnings: string[] = [];
  const nowMs = options?.nowMs ?? Date.now();
  const kept: PsaCollectorsCookie[] = [];

  for (const cookie of raw) {
    if (
      EPHEMERAL_COOKIE_NAMES.has(cookie.name) &&
      isPlaywrightCookieExpired(cookie, nowMs)
    ) {
      warnings.push(
        `Dropped expired ${cookie.name}; Chromium will obtain a fresh one during session warm-up.`,
      );
      continue;
    }
    kept.push(cookie);
  }

  const expanded = expandAuthCookieDomains(kept);
  const cookies = dedupeCookies(expanded);

  if (!hasCollectorsAuthCookies(cookies)) {
    warnings.push(
      'No DSR/refreshToken auth cookies — PSA spec pages will redirect to Collectors sign-in.',
    );
  }

  return { cookies, warnings };
}

export function hasCollectorsAuthCookies(
  cookies: PsaCollectorsCookie[],
): boolean {
  const names = new Set(cookies.map((c) => c.name));
  return names.has('DSR') && names.has('refreshToken');
}

export function isPlaywrightCookieExpired(
  cookie: PsaCollectorsCookie,
  nowMs = Date.now(),
): boolean {
  if (cookie.expires == null || cookie.expires === -1) return false;
  return cookie.expires * 1000 <= nowMs;
}

function expandAuthCookieDomains(
  cookies: PsaCollectorsCookie[],
): PsaCollectorsCookie[] {
  const out = [...cookies];
  const authValues = new Map<string, string>();

  for (const cookie of cookies) {
    if (
      (PSA_COLLECTORS_AUTH_COOKIE_NAMES as readonly string[]).includes(
        cookie.name,
      ) &&
      cookie.value.trim()
    ) {
      authValues.set(cookie.name, cookie.value.trim());
    }
  }

  const domainByName: Record<string, readonly string[]> = {
    DSR: AUTH_DOMAINS,
    refreshToken: ['.psacard.com', 'www.psacard.com'],
  };

  for (const [name, value] of authValues) {
    const domains = domainByName[name] ?? AUTH_DOMAINS;
    for (const domain of domains) {
      out.push({
        name,
        value,
        domain,
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
      });
    }
  }

  return out;
}

function dedupeCookies(cookies: PsaCollectorsCookie[]): PsaCollectorsCookie[] {
  const seen = new Set<string>();
  const out: PsaCollectorsCookie[] = [];

  for (const cookie of cookies) {
    const domain =
      cookie.domain?.trim() ||
      (cookie.url ? new URL(cookie.url).hostname : '');
    const key = `${cookie.name}\0${domain}\0${cookie.path ?? '/'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cookie);
  }

  return out;
}

function normalizePlaywrightCookie(row: unknown): PsaCollectorsCookie | null {
  if (!row || typeof row !== 'object') return null;
  const c = row as Record<string, unknown>;
  if (c.name === '_note') return null;
  const name = typeof c.name === 'string' ? c.name.trim() : '';
  const value = typeof c.value === 'string' ? c.value : '';
  if (!name || !value) return null;

  const domain = typeof c.domain === 'string' ? c.domain.trim() : '';
  const path = typeof c.path === 'string' ? c.path.trim() || '/' : '/';
  const url = typeof c.url === 'string' ? c.url.trim() : '';

  const out: PsaCollectorsCookie = {
    name,
    value,
    path,
    ...(url
      ? { url }
      : domain
        ? { domain }
        : { url: 'https://www.psacard.com' }),
  };

  if (typeof c.secure === 'boolean') out.secure = c.secure;
  if (typeof c.httpOnly === 'boolean') out.httpOnly = c.httpOnly;
  if (c.sameSite === 'Strict' || c.sameSite === 'Lax' || c.sameSite === 'None') {
    out.sameSite = c.sameSite;
  }
  if (typeof c.expires === 'number' && Number.isFinite(c.expires)) {
    out.expires = c.expires;
  }

  return out;
}

/** Keep auth + Cloudflare cookies only (drop accessToken and unrelated rows). */
export function filterPersistableCollectorsCookies(
  cookies: PsaCollectorsCookie[],
): PsaCollectorsCookie[] {
  const names = new Set<string>(PSA_PERSISTABLE_COOKIE_NAMES);
  const kept = cookies.filter(
    (c) =>
      names.has(c.name) && !EXCLUDED_EXPORT_COOKIE_NAMES.has(c.name) && c.value.trim(),
  );
  return preparePsaCollectorsCookies(kept).cookies;
}

export function summarizeCollectorsCookies(
  cookies: PsaCollectorsCookie[],
): string {
  const names = cookies.map((c) => c.name);
  const auth = names.filter((n) =>
    (PSA_COLLECTORS_AUTH_COOKIE_NAMES as readonly string[]).includes(n),
  );
  return `${cookies.length} cookie(s) [${[...new Set(auth)].join(', ')}]`;
}

export function parseJwtPayload(
  token: string,
): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    return JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function jwtExpiresAtMs(token: string): number | null {
  const exp = parseJwtPayload(token)?.exp;
  if (typeof exp !== 'number' || !Number.isFinite(exp)) return null;
  return exp * 1000;
}

export function findRefreshToken(
  cookies: PsaCollectorsCookie[],
): string | null {
  for (const cookie of cookies) {
    if (cookie.name === 'refreshToken' && cookie.value.trim()) {
      return cookie.value.trim();
    }
  }
  return null;
}

export function findDsrToken(cookies: PsaCollectorsCookie[]): string | null {
  for (const cookie of cookies) {
    if (cookie.name === 'DSR' && cookie.value.trim()) {
      return cookie.value.trim();
    }
  }
  return null;
}

export function collectorsAuthNeedsRefresh(
  cookies: PsaCollectorsCookie[],
  leadMs: number,
  nowMs = Date.now(),
): boolean {
  if (!findRefreshToken(cookies)) return false;
  const dsr = findDsrToken(cookies);
  if (!dsr) return true;
  const expMs = jwtExpiresAtMs(dsr);
  if (expMs == null) return false;
  return expMs - nowMs <= leadMs;
}

/**
 * Session cookies for PSA spec scraper.
 *
 * When `PSA_COLLECTORS_REFRESH_TOKEN` is set (local + production), it is the
 * authoritative refresh credential. The cookies file only caches DSR / Cloudflare
 * cookies between restarts — same model on laptop and EC2.
 *
 * Without env token, falls back to cookies file only (legacy manual export).
 */
export async function resolvePsaCollectorsSessionCookies(options: {
  cookiesFile?: string;
  refreshToken?: string;
  cwd?: string;
}): Promise<PsaCollectorsCookie[]> {
  const file = options.cookiesFile?.trim();
  const fromFile = file
    ? await loadPsaCollectorsCookies({ cookiesFile: file, cwd: options.cwd })
    : [];
  const rt = options.refreshToken?.trim();

  if (rt) {
    const fromEnv = cookiesFromRefreshTokenOnly(rt);
    if (fromFile.length === 0) {
      return fromEnv;
    }
    const ephemeralFromFile = fromFile.filter((c) =>
      (['DSR', 'cf_clearance', '__cf_bm'] as const).includes(
        c.name as 'DSR' | 'cf_clearance' | '__cf_bm',
      ),
    );
    return preparePsaCollectorsCookies([
      ...fromEnv.filter((c) => c.name === 'refreshToken'),
      ...ephemeralFromFile,
    ]).cookies;
  }

  if (fromFile.length > 0) {
    return preparePsaCollectorsCookies(fromFile).cookies;
  }

  return [];
}

/** Sync cookies file with env refresh token (create or rotate refreshToken row). */
export async function syncPsaCollectorsCookiesFileFromEnv(
  cookiesFile: string,
  refreshToken: string,
  cwd = process.cwd(),
): Promise<'created' | 'updated' | 'unchanged'> {
  const file = cookiesFile.trim();
  const rt = refreshToken.trim();
  if (!file || !rt) return 'unchanged';

  const fromFile = await loadPsaCollectorsCookies({ cookiesFile: file, cwd });
  const fileRt = findRefreshToken(
    fromFile.length > 0 ? preparePsaCollectorsCookies(fromFile).cookies : [],
  );

  if (fromFile.length === 0) {
    await savePsaCollectorsCookiesFile(file, cookiesFromRefreshTokenOnly(rt), cwd);
    return 'created';
  }

  if (fileRt === rt) return 'unchanged';

  const ephemeral = fromFile.filter((c) =>
    (['DSR', 'cf_clearance', '__cf_bm'] as const).includes(
      c.name as 'DSR' | 'cf_clearance' | '__cf_bm',
    ),
  );
  await savePsaCollectorsCookiesFile(
    file,
    preparePsaCollectorsCookies([
      ...cookiesFromRefreshTokenOnly(rt),
      ...ephemeral,
    ]).cookies,
    cwd,
  );
  return 'updated';
}

/** @deprecated Use {@link syncPsaCollectorsCookiesFileFromEnv} */
export async function seedPsaCollectorsCookiesFileIfMissing(
  cookiesFile: string,
  refreshToken: string,
  cwd = process.cwd(),
): Promise<boolean> {
  return (await syncPsaCollectorsCookiesFileFromEnv(cookiesFile, refreshToken, cwd)) ===
    'created';
}

function isEnoentError(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e != null &&
    'code' in e &&
    (e as { code?: string }).code === 'ENOENT'
  );
}

export function cookiesFromRefreshTokenOnly(
  refreshToken: string,
): PsaCollectorsCookie[] {
  return preparePsaCollectorsCookies([
    {
      name: 'refreshToken',
      value: refreshToken.trim(),
      domain: '.psacard.com',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]).cookies;
}

export async function savePsaCollectorsCookiesFile(
  cookiesFile: string,
  cookies: PsaCollectorsCookie[],
  cwd = process.cwd(),
): Promise<void> {
  const abs = resolve(cwd, cookiesFile);
  await mkdir(dirname(abs), { recursive: true });
  const note = {
    _note:
      'Auto-updated by PSA Collectors session. Initial setup: scripts/psa-collectors-login.ts',
  };
  const serializable = filterPersistableCollectorsCookies(cookies)
    .filter((c) => c.name && c.value)
    .map((c) => ({
      name: c.name,
      value: c.value,
      ...(c.domain ? { domain: c.domain } : {}),
      ...(c.url ? { url: c.url } : {}),
      path: c.path ?? '/',
      secure: c.secure ?? true,
      httpOnly: c.httpOnly ?? true,
      sameSite: c.sameSite ?? 'Lax',
      ...(c.expires != null ? { expires: c.expires } : {}),
    }));

  await writeFile(
    abs,
    `${JSON.stringify([note, ...serializable], null, 2)}\n`,
    'utf8',
  );
}

export function playwrightCookiesFromContext(
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
  }>,
): PsaCollectorsCookie[] {
  return cookies
    .filter((c) =>
      /(?:^|\.)psacard\.com$/i.test(c.domain) ||
      /(?:^|\.)collectors\.com$/i.test(c.domain),
    )
    .map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      secure: c.secure,
      httpOnly: c.httpOnly,
      sameSite: c.sameSite,
      ...(c.expires >= 0 ? { expires: c.expires } : {}),
    }));
}
