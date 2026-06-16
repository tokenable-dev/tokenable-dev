/**
 * Verify Collectors browser session refresh.
 *
 * Usage:
 *   pnpm exec ts-node scripts/test-psa-collectors-refresh.ts
 *   pnpm exec ts-node scripts/test-psa-collectors-refresh.ts --force
 */
import {
  collectorsAuthNeedsRefresh,
  findDsrToken,
  jwtExpiresAtMs,
  loadPsaCollectorsCookies,
  preparePsaCollectorsCookies,
} from '../src/psa/utils/psa-collectors-cookies.util';
import { refreshCollectorsSessionViaBrowser } from '../src/psa/utils/psa-collectors-session.util';
import { psaDefaultUserAgent } from '../src/psa/utils/psa-scraper-browser.util';

const LEAD_MS = Number(process.env.PSA_COLLECTORS_AUTH_REFRESH_LEAD_MS) || 172_800_000;

async function main() {
  const force = process.argv.includes('--force');
  const file =
    process.env.PSA_COLLECTORS_COOKIES_FILE?.trim() ||
    '.psa-collectors-cookies.json';
  const envRt = process.env.PSA_COLLECTORS_REFRESH_TOKEN?.trim() || '';

  const cookies = envRt
    ? preparePsaCollectorsCookies([
        {
          name: 'refreshToken',
          value: envRt,
          domain: '.psacard.com',
          path: '/',
        },
      ]).cookies
    : preparePsaCollectorsCookies(
        await loadPsaCollectorsCookies({ cookiesFile: file }),
      ).cookies;

  const dsr = findDsrToken(cookies);
  const dsrExp = dsr ? jwtExpiresAtMs(dsr) : null;
  const needs = collectorsAuthNeedsRefresh(cookies, LEAD_MS);

  console.log(
    `[refresh-test] cookies=${cookies.length} needsRefresh=${needs} dsrExp=${dsrExp ? new Date(dsrExp).toISOString() : 'n/a'}`,
  );

  if (!force && !needs && !envRt) {
    console.log('[refresh-test] SKIP — DSR still fresh (use --force to test anyway).');
    return;
  }

  const result = await refreshCollectorsSessionViaBrowser(cookies, {
    userAgent: process.env.PSA_SPEC_SCRAPER_USER_AGENT?.trim() || psaDefaultUserAgent(),
    channel: process.env.PSA_SPEC_SCRAPER_CHANNEL?.trim() || undefined,
    userDataDir:
      process.env.PSA_SPEC_SCRAPER_USER_DATA_DIR?.trim() ||
      '.psa-chromium-profile',
    proxy: process.env.PSA_SPEC_SCRAPER_PROXY?.trim() || undefined,
    cloudflareTimeoutMs:
      Number(process.env.PSA_SPEC_CLOUDFLARE_TIMEOUT_MS) || 45_000,
    cookiesFile: file,
  });

  console.log(`[refresh-test] refreshed=${result.refreshed}`);
  if (!result.refreshed) {
    console.error('[refresh-test] FAIL');
    process.exit(1);
  }

  const nextExp = jwtExpiresAtMs(findDsrToken(result.cookies) ?? '');
  console.log(
    `[refresh-test] OK — DSR exp=${nextExp ? new Date(nextExp).toISOString() : 'n/a'}`,
  );
}

main().catch((e) => {
  console.error('[refresh-test] error:', e instanceof Error ? e.message : e);
  process.exit(1);
});
