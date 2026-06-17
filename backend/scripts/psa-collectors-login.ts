/**
 * Export Collectors session after headed login at psacard.com.
 *
 * Usage:
 *   pnpm exec ts-node scripts/psa-collectors-login.ts
 */
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { resolve } from 'node:path';
import {
  findRefreshToken,
  playwrightCookiesFromContext,
  savePsaCollectorsCookiesFile,
  summarizeCollectorsCookies,
} from '../src/psa/utils/psa-collectors-cookies.util';
import {
  closePsaChromiumContext,
  launchPsaChromiumContext,
  psaDefaultUserAgent,
} from '../src/psa/utils/psa-collectors-browser.util';

async function main() {
  const cookiesFile =
    process.env.PSA_COLLECTORS_COOKIES_FILE?.trim() ||
    '.psa-collectors-cookies.json';
  const userDataDir =
    process.env.PSA_SPEC_SCRAPER_USER_DATA_DIR?.trim() ||
    '.psa-chromium-profile';

  const { context } = await launchPsaChromiumContext({
    headless: false,
    channel: process.env.PSA_SPEC_SCRAPER_CHANNEL?.trim() || 'chrome',
    userAgent:
      process.env.PSA_SPEC_SCRAPER_USER_AGENT?.trim() || psaDefaultUserAgent(),
    userDataDir: resolve(process.cwd(), userDataDir),
  });

  const page = await context.newPage();
  await page.goto('https://www.psacard.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 120_000,
  });

  console.log('');
  console.log(`Profile: ${resolve(process.cwd(), userDataDir)}`);
  console.log('Log into PSA / Collectors, open a spec page, then press Enter.');
  console.log('');

  const rl = createInterface({ input, output });
  await rl.question('Press Enter to save cookies… ');
  rl.close();

  const cookies = playwrightCookiesFromContext(await context.cookies());
  await savePsaCollectorsCookiesFile(cookiesFile, cookies);
  console.log(`Saved ${summarizeCollectorsCookies(cookies)} → ${cookiesFile}`);

  const refreshToken = findRefreshToken(cookies);
  if (refreshToken) {
    console.log('');
    console.log('Add to backend/.env (local) and ~/.env.production.backend (EC2):');
    console.log(`PSA_COLLECTORS_REFRESH_TOKEN=${refreshToken}`);
    console.log('');
    console.log(
      'Daily dev uses the env token only — cookies file + profile are auto-managed caches.',
    );
  }

  await closePsaChromiumContext(context, null);
}

main().catch((e) => {
  console.error('login export failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
