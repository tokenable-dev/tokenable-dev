import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { Browser, BrowserContext, Page } from 'playwright-core';

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
 *   • Per-process spec-id cache (24h positive / configurable negative TTL) so we only
 *     scrape each spec once per outcome.
 *   • In-flight request dedupe — concurrent listings of the same card
 *     share a single scrape.
 *   • Always used for catalog covers when PSA `specId` is known; callers do
 *     not fall back to other image sources for that path (unless
 *     `PSA_SPEC_COVER_ALLOW_FALLBACK` is set in CollectionService).
 *
 * Optional env (resilience):
 *   • `PSA_SPEC_SCRAPER_PROXY` — Playwright `proxy.server` URL for egress (DC/residential).
 *   • `PSA_SPEC_NAV_TIMEOUT_MS` / `PSA_SPEC_IMG_TIMEOUT_MS` — navigation / image wait (defaults 120s / 45s).
 *   • `PSA_SPEC_NEGATIVE_CACHE_MS` — cache TTL after failure (default 1h).
 *   • `PSA_SPEC_RETRY_EMPTY` — `1`/`true`: second full scrape if the first finds no image.
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
  private static readonly CDN_HOST = 'd1htnxwo4o0jhw.cloudfront.net';
  /** Cloudflare + EC2/datacenter latency — override via env if needed. */
  private static navTimeoutMs(): number {
    const raw = process.env.PSA_SPEC_NAV_TIMEOUT_MS;
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 120_000;
  }
  private static imgTimeoutMs(): number {
    const raw = process.env.PSA_SPEC_IMG_TIMEOUT_MS;
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 45_000;
  }
  /**
   * How long to cache a **failed** scrape (Cloudflare block, layout change, no asset on page).
   * Lower in staging if you want faster retry after fixing infra. Default 1h.
   */
  private static negativeCacheTtlMs(): number {
    const raw = process.env.PSA_SPEC_NEGATIVE_CACHE_MS;
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : 60 * 60 * 1000;
  }

  private static scraperProxy(): { proxy: { server: string } } | undefined {
    const s = process.env.PSA_SPEC_SCRAPER_PROXY?.trim();
    if (!s) return undefined;
    return { proxy: { server: s } };
  }

  constructor() {}

  onModuleInit(): void {
    const proxy = PsaSpecScraperService.scraperProxy();
    this.logger.log(
      proxy
        ? 'PSA spec scraper enabled — Chromium will use PSA_SPEC_SCRAPER_PROXY for egress; first scrape launches browser (lazy).'
        : 'PSA spec scraper enabled — first scrape will launch Chromium (lazy).',
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

    const job = this.doScrapeWithRetry(id)
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
          : PsaSpecScraperService.negativeCacheTtlMs()),
    });

    return url;
  }

  /** One navigation timeout retry; optional second full attempt if no image (PSA_SPEC_RETRY_EMPTY). */
  private async doScrapeWithRetry(specId: string): Promise<string | null> {
    const attempt = async (): Promise<string | null> => {
      try {
        return await this.doScrape(specId);
      } catch (first) {
        const msg = first instanceof Error ? first.message : String(first);
        if (!/timeout|Timeout/i.test(msg)) throw first;
        this.logger.warn(
          `PSA spec scrape navigation timeout, retrying once specId=${specId}`,
        );
        await new Promise((r) => setTimeout(r, 2_000));
        return this.doScrape(specId);
      }
    };

    let url = await attempt();
    if (url) return url;

    const retryEmpty =
      process.env.PSA_SPEC_RETRY_EMPTY === '1' ||
      process.env.PSA_SPEC_RETRY_EMPTY === 'true';
    if (retryEmpty) {
      this.logger.debug(
        `PSA spec scrape retry_empty specId=${specId} (second full attempt)`,
      );
      await new Promise((r) => setTimeout(r, 2_500));
      url = await attempt();
    }
    return url ?? null;
  }

  private async doScrape(specId: string): Promise<string | null> {
    const context = await this.ensureContext();
    const navTimeout = PsaSpecScraperService.navTimeoutMs();
    const imgTimeout = PsaSpecScraperService.imgTimeoutMs();

    const urls = [
      `https://www.psacard.com/spec/psa/${specId}?g=10&gt=SINGLE_GRADED`,
      `https://www.psacard.com/spec/psa/${specId}`,
    ];

    for (const targetUrl of urls) {
      const page = await context.newPage();
      page.setDefaultNavigationTimeout(navTimeout);
      page.setDefaultTimeout(Math.max(navTimeout, imgTimeout));

      try {
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
          waitUntil: 'commit',
          timeout: navTimeout,
        });
        await page
          .waitForLoadState('domcontentloaded', { timeout: navTimeout })
          .catch(() => {
            this.logger.debug(
              `PSA spec specId=${specId}: domcontentloaded wait skipped or slow — continuing`,
            );
          });

        const titleNow = await page.title().catch(() => '');
        if (/just a moment/i.test(titleNow)) {
          this.logger.debug('Cloudflare challenge detected — waiting…');
          await page
            .waitForFunction(() => !/just a moment/i.test(document.title), {
              timeout: navTimeout,
            })
            .catch(() => {});
        }

        const extracted = await this.extractSpecImageFromPage(
          page,
          specId,
          imgTimeout,
        );
        if (extracted) {
          this.logger.log(
            `PSA spec scrape OK specId=${specId} → ${extracted.slice(0, 100)}`,
          );
          return extracted;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.debug(
          `PSA spec specId=${specId} url=${targetUrl.slice(0, 72)}… err=${msg.slice(0, 120)}`,
        );
      } finally {
        await page.close().catch(() => {});
      }
    }

    this.logger.warn(
      `PSA spec scrape: no_image specId=${specId} (tried default + plain spec URL; see docs for fallbacks)`,
    );
    return null;
  }

  private normalizeScrapedImageSrc(src: string): string {
    const t = src.trim();
    if (t.startsWith('//')) return `https:${t}`;
    return t;
  }

  /**
   * Spec images are sometimes below the fold or hydrate after first paint — scroll + DOM scan
   * before giving up (still bounded by imgTimeout).
   */
  private async extractSpecImageFromPage(
    page: Page,
    specId: string,
    imgTimeout: number,
  ): Promise<string | null> {
    const host = PsaSpecScraperService.CDN_HOST;
    const imgSelector = `img[src*="${host}/spec/${specId}/"]`;
    const waitImg = (timeout: number) =>
      page
        .waitForSelector(imgSelector, { state: 'attached', timeout })
        .then((el) => el?.getAttribute('src') ?? null)
        .catch(() => null);

    let raw = await waitImg(imgTimeout);
    if (raw) return this.normalizeScrapedImageSrc(raw);

    await page
      .evaluate(() =>
        window.scrollTo({
          top: Math.min(1200, Math.max(400, document.body.scrollHeight * 0.35)),
          behavior: 'instant',
        }),
      )
      .catch(() => {});
    await new Promise((r) => setTimeout(r, 700));
    raw = await waitImg(Math.min(14_000, imgTimeout));
    if (raw) return this.normalizeScrapedImageSrc(raw);

    const fromDom = await page
      .evaluate((sid) => {
        const needle = `/spec/${sid}/`;
        for (const img of Array.from(document.querySelectorAll('img[src]'))) {
          const s = img.getAttribute('src') ?? '';
          if (!s.includes(needle)) continue;
          if (s.startsWith('https://') || s.startsWith('http://')) return s;
          if (s.startsWith('//')) return `https:${s}`;
        }
        return null;
      }, specId)
      .catch(() => null);
    if (fromDom) return this.normalizeScrapedImageSrc(fromDom);

    const html = await page.content();
    const re = new RegExp(
      `https?://${host.replace(/\./g, '\\.')}/spec/${specId}/[A-Za-z0-9_\\-]+\\.(?:jpg|jpeg|png|webp)`,
      'i',
    );
    const m = html.match(re);
    if (m?.[0]) {
      this.logger.debug(`PSA spec scrape regex hit specId=${specId}`);
      return m[0];
    }
    return null;
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

      const proxyOpts = PsaSpecScraperService.scraperProxy();
      const context = await this.browser.newContext({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 },
        locale: 'en-US',
        timezoneId: 'America/Los_Angeles',
        extraHTTPHeaders: {
          'accept-language': 'en-US,en;q=0.9',
        },
        ...(proxyOpts ?? {}),
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
