/**
 * POC: PSA cert page "PSA Estimate" via headless Chromium (same stack as Card Ladder).
 *
 * Usage (from backend/):
 *   pnpm run install:browsers   # once
 *   pnpm exec ts-node scripts/psa-cert-estimate-scrape-poc.ts 175195783
 *   pnpm exec ts-node scripts/psa-cert-estimate-scrape-poc.ts 176301923
 *
 * Optional: CARDLADDER_INDEXES_SCRAPER_PROXY=http://host:port (residential if CF blocks)
 */
import type { Browser, BrowserContext } from 'playwright-core';

const STEALTH_INIT_SCRIPT = `
(function () {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
  const chrome = { runtime: {} };
  Object.defineProperty(window, 'chrome', { get: () => chrome });
})();
`;

function proxyFromEnv(): { proxy: { server: string } } | undefined {
  const s =
    process.env.PSA_WEBSITE_ESTIMATE_SCRAPER_PROXY?.trim() ||
    process.env.CARDLADDER_INDEXES_SCRAPER_PROXY?.trim();
  if (!s) return undefined;
  return { proxy: { server: s } };
}

function parseUsdFromText(raw: string): number | null {
  const m = raw.replace(/,/g, '').match(/\$?\s*(\d+(?:\.\d{2})?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function launchContext(): Promise<{ browser: Browser; context: BrowserContext }> {
  const { chromium } = await import('playwright-core');
  const headed = process.argv.includes('--headed');
  const useChromeChannel = !process.argv.includes('--bundled-chromium');
  const launchOpts = {
    headless: !headed,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1400,900',
    ],
  } as Parameters<typeof chromium.launch>[0];
  if (useChromeChannel) {
    (launchOpts as { channel?: string }).channel = 'chrome';
  }
  const browser = await chromium.launch(launchOpts);
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1400, height: 900 },
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
    extraHTTPHeaders: {
      'accept-language': 'en-US,en;q=0.9',
    },
    ...(proxyFromEnv() ?? {}),
  });
  await context.addInitScript(STEALTH_INIT_SCRIPT);
  return { browser, context };
}

async function extractEstimate(page: import('playwright-core').Page): Promise<{
  estimateUsd: number | null;
  method: string;
  snippet: string;
}> {
  const fromEvaluate = await page.evaluate(() => {
    const bodyText = document.body?.innerText ?? '';
    const idx = bodyText.toLowerCase().indexOf('psa estimate');
    if (idx >= 0) {
      const slice = bodyText.slice(idx, idx + 120);
      return { slice, ok: true };
    }
    const labels = Array.from(document.querySelectorAll('*')).filter((el) => {
      const t = (el.textContent ?? '').trim();
      return /^PSA Estimate$/i.test(t);
    });
    for (const el of labels.slice(0, 5)) {
      const parent = el.parentElement;
      const sib = el.nextElementSibling;
      const blob = [sib?.textContent, parent?.textContent].filter(Boolean).join(' ');
      if (blob) return { slice: blob.slice(0, 200), ok: true };
    }
    return { slice: bodyText.slice(0, 400), ok: false };
  });

  if (fromEvaluate.ok) {
    const usd = parseUsdFromText(fromEvaluate.slice);
    if (usd != null) {
      return { estimateUsd: usd, method: 'innerText_near_label', snippet: fromEvaluate.slice };
    }
  }

  const dollarLoc = page.locator('text=/\\$[\\d,]+(?:\\.\\d{2})?/').first();
  if (await dollarLoc.count()) {
    const t = (await dollarLoc.textContent())?.trim() ?? '';
    const usd = parseUsdFromText(t);
    if (usd != null && usd >= 10) {
      return { estimateUsd: usd, method: 'first_dollar_locator', snippet: t };
    }
  }

  return {
    estimateUsd: null,
    method: 'not_found',
    snippet: fromEvaluate.slice,
  };
}

async function main(): Promise<void> {
  const cert = (process.argv[2] ?? '').replace(/\D/g, '');
  if (cert.length < 7) {
    console.error('Usage: ts-node scripts/psa-cert-estimate-scrape-poc.ts <certNumber>');
    process.exit(1);
  }

  const url = `https://www.psacard.com/cert/${cert}/psa`;
  const navTimeout = 90_000;
  const proxy = proxyFromEnv();

  console.log(JSON.stringify({ step: 'start', cert, url, proxy: proxy ? 'yes' : 'no' }));

  const { browser, context } = await launchContext();
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: navTimeout });
    await page.waitForLoadState('networkidle', { timeout: navTimeout }).catch(() => undefined);

    const title = await page.title();
    const isCf =
      title.toLowerCase().includes('just a moment') ||
      (await page.locator('#challenge-error-text').count()) > 0;

    if (isCf) {
      console.log(JSON.stringify({ step: 'cloudflare_wait', title }));
      await page.waitForTimeout(12_000);
      await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined);
    }

    const title2 = await page.title();
    const stillCf =
      title2.toLowerCase().includes('just a moment') ||
      (await page.locator('#challenge-error-text').count()) > 0;

    const extracted = await extractEstimate(page);
    const screenshotPath = `/tmp/psa-cert-${cert}-poc.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => undefined);

    console.log(
      JSON.stringify(
        {
          step: 'done',
          cert,
          finalTitle: title2,
          cloudflareBlocked: stillCf,
          screenshotPath,
          ...extracted,
        },
        null,
        2,
      ),
    );

    if (extracted.estimateUsd == null) {
      process.exitCode = 2;
    }
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  if (/Executable doesn't exist|playwright-core install/i.test(msg)) {
    console.error('Chromium missing — run: cd backend && pnpm run install:browsers');
  } else {
    console.error(msg);
  }
  process.exit(1);
});
