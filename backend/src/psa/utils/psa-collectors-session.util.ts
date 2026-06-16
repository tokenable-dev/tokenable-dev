import {
  findDsrToken,
  findRefreshToken,
  preparePsaCollectorsCookies,
  savePsaCollectorsCookiesFile,
  playwrightCookiesFromContext,
  type PsaCollectorsCookie,
} from './psa-collectors-cookies.util';
import {
  closePsaChromiumContext,
  isCollectorsSignInUrl,
  launchPsaChromiumContext,
  waitForCloudflare,
  type PsaChromiumLaunchOptions,
} from './psa-scraper-browser.util';

export type CollectorsSessionRefreshOptions = PsaChromiumLaunchOptions & {
  cloudflareTimeoutMs?: number;
  cookiesFile?: string;
};

const PERSISTABLE_FROM_BROWSER = new Set([
  'DSR',
  'refreshToken',
  'cf_clearance',
  '__cf_bm',
]);

/**
 * Renew Collectors session in a headless browser (refreshToken → DSR + cf_clearance).
 */
export async function refreshCollectorsSessionViaBrowser(
  existing: PsaCollectorsCookie[],
  options: CollectorsSessionRefreshOptions,
): Promise<{ cookies: PsaCollectorsCookie[]; refreshed: boolean }> {
  if (!findRefreshToken(existing)) {
    return { cookies: existing, refreshed: false };
  }

  const cfTimeout = options.cloudflareTimeoutMs ?? 45_000;
  const { context, browser } = await launchPsaChromiumContext(options);

  try {
    const seed = preparePsaCollectorsCookies(existing).cookies;
    for (const cookie of seed) {
      await context.addCookies([cookie]).catch(() => undefined);
    }

    const page = await context.newPage();
    await page.goto('https://www.psacard.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    });
    await waitForCloudflare(page, cfTimeout);
    if (isCollectorsSignInUrl(page.url())) {
      return { cookies: existing, refreshed: false };
    }

    const fromBrowser = playwrightCookiesFromContext(await context.cookies());
    if (!findDsrToken(fromBrowser)) {
      return { cookies: existing, refreshed: false };
    }

    const merged = preparePsaCollectorsCookies([
      ...existing.filter((c) => !PERSISTABLE_FROM_BROWSER.has(c.name)),
      ...fromBrowser.filter((c) => PERSISTABLE_FROM_BROWSER.has(c.name)),
    ]).cookies;

    if (options.cookiesFile) {
      await savePsaCollectorsCookiesFile(options.cookiesFile, merged);
    }

    return { cookies: merged, refreshed: true };
  } finally {
    await closePsaChromiumContext(context, browser);
  }
}
