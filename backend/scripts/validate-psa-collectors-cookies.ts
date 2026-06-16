/**
 * Validate PSA Collectors cookie file before running the spec scraper.
 *
 * Usage:
 *   pnpm exec ts-node scripts/validate-psa-collectors-cookies.ts
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseJwtPayload } from '../src/psa/utils/psa-collectors-cookies.util';
import {
  hasCollectorsAuthCookies,
  isPlaywrightCookieExpired,
  preparePsaCollectorsCookies,
  type PsaCollectorsCookie,
} from '../src/psa/utils/psa-collectors-cookies.util';

function jwtExpiresAt(cookie: PsaCollectorsCookie): Date | null {
  const payload = parseJwtPayload(cookie.value);
  const exp = payload?.exp;
  if (typeof exp !== 'number' || !Number.isFinite(exp)) return null;
  return new Date(exp * 1000);
}

async function main() {
  const file =
    process.env.PSA_COLLECTORS_COOKIES_FILE?.trim() ||
    '.psa-collectors-cookies.json';
  const abs = resolve(process.cwd(), file);
  const raw = JSON.parse(await readFile(abs, 'utf8')) as unknown;
  if (!Array.isArray(raw)) {
    throw new Error(`${file} must be a JSON array`);
  }

  const rows = raw.filter(
    (row) => row && typeof row === 'object' && (row as { name?: string }).name !== '_note',
  ) as PsaCollectorsCookie[];

  const { cookies, warnings } = preparePsaCollectorsCookies(rows);
  const authOk = hasCollectorsAuthCookies(cookies);

  console.log(`[validate] file=${abs}`);
  console.log(`[validate] raw=${rows.length} prepared=${cookies.length} auth=${authOk}`);
  for (const warning of warnings) {
    console.warn(`[validate] warn: ${warning}`);
  }

  for (const name of ['DSR', 'refreshToken', 'cf_clearance'] as const) {
    const matches = rows.filter((c) => c.name === name);
    if (matches.length === 0) {
      console.warn(`[validate] missing cookie: ${name}`);
      continue;
    }
    for (const cookie of matches) {
      const jwtExp = name === 'DSR' || name === 'refreshToken' ? jwtExpiresAt(cookie) : null;
      const exp =
        jwtExp?.toISOString() ??
        (cookie.expires != null
          ? new Date(cookie.expires * 1000).toISOString()
          : 'session');
      const expired =
        jwtExp != null
          ? jwtExp.getTime() <= Date.now()
          : isPlaywrightCookieExpired(cookie);
      console.log(
        `[validate] ${name} domain=${cookie.domain ?? cookie.url ?? '?'} expires=${exp} expired=${expired}`,
      );
    }
  }

  if (!authOk) {
    console.error(
      '[validate] FAIL — export cookies from a logged-in psacard.com browser session.',
    );
    console.error(
      '[validate] Run: pnpm exec ts-node scripts/psa-collectors-login.ts',
    );
    process.exit(1);
  }

  const dsr = rows.find((c) => c.name === 'DSR');
  const dsrExp = dsr ? jwtExpiresAt(dsr) : null;
  if (dsrExp && dsrExp.getTime() <= Date.now()) {
    console.error('[validate] FAIL — DSR JWT expired. Re-run psa-collectors-login.ts');
    process.exit(1);
  }

  console.log('[validate] OK — auth cookies present.');
  console.log(
    '[validate] If scraper hits sign-in, run: pnpm exec ts-node scripts/psa-collectors-login.ts',
  );
}

main().catch((e) => {
  console.error('[validate] error:', e instanceof Error ? e.message : e);
  process.exit(1);
});
