import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { Browser, BrowserContext } from 'playwright-core';

/**
 * Scrapes the PSA spec page (e.g. https://www.psacard.com/spec/psa/9656727)
 * to extract the **card-only** CloudFront image URL
 * (e.g. https://d1htnxwo4o0jhw.cloudfront.net/spec/9656727/<hash>.jpg).
 *
 * Why a headless browser?
 *   PSA's spec pages sit behind Cloudflare's JavaScript "Just a moment..."
 *   challenge, so plain `fetch` always returns 403. The image hash is a
 *   random GUID that only appears inside the rendered HTML, and there is
 *   no public PSA endpoint that returns it (their public API only exposes
 *   `cert/Get*`). A real browser is the only reliable way to grab it.
 *
 * Operational characteristics:
 *   • Singleton persistent Chromium context (cookies survive across calls
 *     so the Cloudflare clearance issued for the first scrape is reused).
 *   • Per-process spec-id cache (24h positive / 1h negative) so we only
 *     scrape each spec once.
 *   • In-flight request dedupe — concurrent listings of the same card
 *     share a single scrape.
 *   • Always used for catalog covers when PSA `specId` is known; callers do
 *     not fall back to other image sources for that path.
 *
 * Setup (once per environment):
 *   pnpm exec playwright install chromium
 */
@Injectable()
export class PsaSpecScraperService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PsaSpecScraperService.name);

  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private launchPromise: Promise<BrowserContext> | null = null;

  /** specId → { url, expiresAt }. */
  private readonly cache = new Map<
    string,
    { url: string | null; expiresAt: number }
  >();
  /** Deduplicates concurrent scrapes of the same specId. */
  private readonly inFlight = new Map<string, Promise<string | null>>();

  private static readonly POSITIVE_TTL_MS = 24 * 60 * 60 * 1000;
  private static readonly NEGATIVE_TTL_MS = 60 * 60 * 1000;
  private static readonly CDN_HOST = 'd1htnxwo4o0jhw.cloudfront.net';
  /** No env — fixed timeouts for Cloudflare + spec image load. */
  private static readonly NAV_TIMEOUT_MS = 45_000;
  private static readonly IMG_TIMEOUT_MS = 30_000;

  constructor() {}

  onModuleInit(): void {
    this.logger.log(
      'PSA spec scraper enabled — first scrape will launch Chromium (lazy).',
    );
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.context?.close();
    } catch {
      /* ignore */
    }
    try {
      await this.browser?.close();
    } catch {
      /* ignore */
    }
    this.context = null;
    this.browser = null;
  }

  /** Present for DI compatibility; scraping always runs when invoked. */
  isEnabled(): boolean {
    return true;
  }

  /**
   * Returns the absolute CloudFront image URL for the given PSA specId,
   * or `null` when Chromium is unavailable or the page blocks.
   * Safe to call concurrently; failures never throw.
   */
  async scrapeSpecImageUrl(specId: string | number): Promise<string | null> {
    const id = String(specId).trim();
    if (!/^\d+$/.test(id)) return null;

    const hit = this.cache.get(id);
    if (hit && hit.expiresAt > Date.now()) return hit.url;

    const existing = this.inFlight.get(id);
    if (existing) return existing;

    const job = this.doScrape(id)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`PSA spec scrape errored for specId=${id}: ${msg}`);
        if (/Executable doesn't exist|browserType\.launch/i.test(msg)) {
          this.logger.warn(
            'PSA spec scraper: Chromium is not installed for playwright-core. From repo root: cd backend && pnpm run install:browsers',
          );
        }
        return null;
      })
      .finally(() => {
        this.inFlight.delete(id);
      });

    this.inFlight.set(id, job);
    const url = await job;

    this.cache.set(id, {
      url,
      expiresAt:
        Date.now() +
        (url
          ? PsaSpecScraperService.POSITIVE_TTL_MS
          : PsaSpecScraperService.NEGATIVE_TTL_MS),
    });

    return url;
  }

  private async doScrape(specId: string): Promise<string | null> {
    const context = await this.ensureContext();
    const page = await context.newPage();

    const navTimeout = PsaSpecScraperService.NAV_TIMEOUT_MS;
    const imgTimeout = PsaSpecScraperService.IMG_TIMEOUT_MS;

    try {
      const targetUrl = `https://www.psacard.com/spec/psa/${specId}?g=10&gt=SINGLE_GRADED`;

      // Block heavy assets we don't need (CSS/fonts still ok so the page renders).
      await page.route('**/*', (route) => {
        const type = route.request().resourceType();
        if (
          type === 'media' ||
          type === 'websocket' ||
          type === 'eventsource' ||
          type === 'manifest'
        ) {
          return route.abort();
        }
        return route.continue();
      });

      this.logger.debug(`Scraping PSA spec page ${targetUrl}`);
      await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: navTimeout,
      });

      // If we landed on a Cloudflare interstitial, give the JS challenge a moment.
      const titleNow = await page.title().catch(() => '');
      if (/just a moment/i.test(titleNow)) {
        this.logger.debug('Cloudflare challenge detected — waiting…');
        await page
          .waitForFunction(() => !/just a moment/i.test(document.title), {
            timeout: navTimeout,
          })
          .catch(() => {});
      }

      // Wait for the spec image to render. We accept either an <img> whose
      // src points at `/spec/{specId}/...` or any anchor href to the same path.
      const imgSelector = `img[src*="${PsaSpecScraperService.CDN_HOST}/spec/${specId}/"]`;
      const url = await page
        .waitForSelector(imgSelector, { timeout: imgTimeout })
        .then((el) => el?.getAttribute('src') ?? null)
        .catch(() => null);

      if (url) {
        this.logger.log(
          `PSA spec scrape OK specId=${specId} → ${url.slice(0, 100)}`,
        );
        return url;
      }

      // Fallback: regex-scan the rendered HTML for the cloudfront URL.
      const html = await page.content();
      const re = new RegExp(
        `https?://${PsaSpecScraperService.CDN_HOST.replace(/\./g, '\\.')}/spec/${specId}/[A-Za-z0-9_\\-]+\\.(?:jpg|jpeg|png|webp)`,
        'i',
      );
      const m = html.match(re);
      if (m && m[0]) {
        this.logger.log(
          `PSA spec scrape OK (regex) specId=${specId} → ${m[0].slice(0, 100)}`,
        );
        return m[0];
      }

      this.logger.warn(
        `PSA spec scrape: no image found on page for specId=${specId}`,
      );
      return null;
    } finally {
      await page.close().catch(() => {});
    }
  }

  /**
   * Launches Chromium once and reuses a single persistent BrowserContext so
   * Cloudflare cookies issued for the first scrape are reused on later ones.
   */
  private async ensureContext(): Promise<BrowserContext> {
    if (this.context && !this.context.pages().every((p) => p.isClosed())) {
      return this.context;
    }
    if (this.launchPromise) return this.launchPromise;

    this.launchPromise = (async () => {
      const { chromium } = await import('playwright-core');

      const launchArgs = [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-sandbox',
        '--disable-dev-shm-usage',
      ];

      this.browser = await chromium.launch({
        headless: true,
        args: launchArgs,
      });

      const context = await this.browser.newContext({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 },
        locale: 'en-US',
        timezoneId: 'America/Los_Angeles',
        extraHTTPHeaders: {
          'accept-language': 'en-US,en;q=0.9',
        },
      });

      // Mask `navigator.webdriver` so Cloudflare's headless heuristics
      // are less likely to fire on first load.
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        const w = window as unknown as Record<string, unknown>;
        if (!w.chrome) w.chrome = { runtime: {} };
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });
      });

      this.browser.on('disconnected', () => {
        this.browser = null;
        this.context = null;
        this.launchPromise = null;
      });

      this.context = context;
      return context;
    })().finally(() => {
      this.launchPromise = null;
    });

    return this.launchPromise;
  }
}
