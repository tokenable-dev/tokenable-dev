import { mkdir } from 'node:fs/promises';
import type { Browser, BrowserContext, Page } from 'playwright-core';

const STEALTH_INIT_SCRIPT = `
(function () {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
  const chrome = { runtime: {}, csi: () => ({}), loadTimes: () => ({}) };
  try { Object.defineProperty(window, 'chrome', { get: () => chrome }); } catch { window.chrome = chrome; }
})();
`;

const LAUNCH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--window-size=1280,800',
] as const;

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export type PsaChromiumLaunchOptions = {
  userAgent?: string;
  channel?: string;
  userDataDir?: string;
  proxy?: string;
  headless?: boolean;
};

export function psaDefaultUserAgent(): string {
  return DEFAULT_USER_AGENT;
}

export function isCollectorsSignInUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('collectors.com')) return false;
    const p = u.pathname.toLowerCase();
    return (
      p.includes('/signin') ||
      p.includes('/sign-in') ||
      p.includes('/login')
    );
  } catch {
    return /collectors\.com\/(signin|sign-in|login)/i.test(url);
  }
}

export async function waitForCloudflare(
  page: Page,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const title = await page.title().catch(() => '');
    if (!/just a moment/i.test(title)) return;
    await page.waitForTimeout(1_500);
  }
}

export async function launchPsaChromiumContext(
  options: PsaChromiumLaunchOptions,
): Promise<{ context: BrowserContext; browser: Browser | null }> {
  const { chromium } = await import('playwright-core');
  const userAgent = options.userAgent?.trim() || DEFAULT_USER_AGENT;
  const launchBase = {
    headless: options.headless ?? true,
    channel: options.channel || undefined,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [...LAUNCH_ARGS],
    userAgent,
    viewport: { width: 1280, height: 800 } as const,
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
    extraHTTPHeaders: { 'accept-language': 'en-US,en;q=0.9' },
    ...(options.proxy ? { proxy: { server: options.proxy } } : {}),
  };

  const userDataDir = options.userDataDir?.trim();
  if (userDataDir) {
    await mkdir(userDataDir, { recursive: true });
    const context = await chromium.launchPersistentContext(
      userDataDir,
      launchBase,
    );
    await context.addInitScript(STEALTH_INIT_SCRIPT);
    return { context, browser: null };
  }

  const browser = await chromium.launch(launchBase);
  const context = await browser.newContext({
    userAgent: launchBase.userAgent,
    viewport: launchBase.viewport,
    locale: launchBase.locale,
    timezoneId: launchBase.timezoneId,
    extraHTTPHeaders: launchBase.extraHTTPHeaders,
    ...(options.proxy ? { proxy: { server: options.proxy } } : {}),
  });
  await context.addInitScript(STEALTH_INIT_SCRIPT);
  return { context, browser };
}

export async function closePsaChromiumContext(
  context: BrowserContext,
  browser: Browser | null,
): Promise<void> {
  await context.close().catch(() => undefined);
  await browser?.close().catch(() => undefined);
}
