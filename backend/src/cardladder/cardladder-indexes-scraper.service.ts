import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Browser, BrowserContext } from 'playwright-core';
import type { CardladderScrapedIndex } from './cardladder-indexes.types';

const CARDLADDER_INDEXES_URL = 'https://www.cardladder.com/indexes';

/**
 * Selector candidates in priority order.
 * Cardladder may update their DOM; we try multiple selectors for resilience.
 */
const CARD_SELECTORS = [
  'a.index-category-card',
  'a[href*="/indexes/"]',
  '[class*="index-category"]',
  '[class*="IndexCategory"]',
];

/** Stealth init script — patches common headless-browser fingerprints that Cloudflare inspects. */
const STEALTH_INIT_SCRIPT = `
(function () {
  // navigator.webdriver
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

  // navigator.plugins — headless Chrome has 0; real browsers have several
  const makeMimeType = (type, desc, suffixes) => {
    const mt = { type, description: desc, suffixes };
    Object.setPrototypeOf(mt, MimeType.prototype);
    return mt;
  };
  const pdfMime = makeMimeType('application/pdf', 'Portable Document Format', 'pdf');
  const makePlugin = (name, filename, desc, ...mimes) => {
    const p = { name, filename, description: desc, length: mimes.length };
    mimes.forEach((m, i) => { p[i] = m; });
    Object.setPrototypeOf(p, Plugin.prototype);
    return p;
  };
  const plugins = [
    makePlugin('Chrome PDF Plugin', 'internal-pdf-viewer', 'Portable Document Format', pdfMime),
    makePlugin('Chrome PDF Viewer', 'mhjfbmdgcfjbbpaeojofohoefgiehjai', '', pdfMime),
    makePlugin('Native Client', 'internal-nacl-plugin', '', pdfMime),
  ];
  const pluginArray = Object.create(PluginArray.prototype);
  plugins.forEach((p, i) => { pluginArray[i] = p; });
  Object.defineProperty(pluginArray, 'length', { get: () => plugins.length });
  Object.defineProperty(navigator, 'plugins', { get: () => pluginArray });

  // navigator.languages
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

  // navigator.hardwareConcurrency — headless often reports 2
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });

  // WebGL vendor/renderer — headless reveals SwiftShader, a known bot fingerprint
  const getParamOrig = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = function (param) {
    if (param === 37445) return 'Intel Inc.';             // UNMASKED_VENDOR_WEBGL
    if (param === 37446) return 'Intel Iris OpenGL Engine'; // UNMASKED_RENDERER_WEBGL
    return getParamOrig.call(this, param);
  };
  const get2ParamOrig = WebGL2RenderingContext.prototype.getParameter;
  WebGL2RenderingContext.prototype.getParameter = function (param) {
    if (param === 37445) return 'Intel Inc.';
    if (param === 37446) return 'Intel Iris OpenGL Engine';
    return get2ParamOrig.call(this, param);
  };

  // chrome object — required by some CF checks
  const chrome = {
    app: {
      isInstalled: false,
      InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
      RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
    },
    csi: () => ({}),
    loadTimes: () => ({}),
    runtime: {},
  };
  try { Object.defineProperty(window, 'chrome', { get: () => chrome }); } catch { window.chrome = chrome; }

  // outer dimensions
  if (window.outerWidth === 0)
    Object.defineProperty(window, 'outerWidth', { get: () => window.innerWidth });
  if (window.outerHeight === 0)
    Object.defineProperty(window, 'outerHeight', { get: () => window.innerHeight + 85 });

  // Notification.permission — headless exposes 'default' but real browsers may differ
  try {
    Object.defineProperty(Notification, 'permission', { get: () => 'default' });
  } catch { /* ignore */ }
})();
`;

@Injectable()
export class CardladderIndexesScraperService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(CardladderIndexesScraperService.name);

  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private launchPromise: Promise<BrowserContext> | null = null;

  constructor(private readonly config: ConfigService) {}

  private navTimeoutMs(): number {
    return this.config.get<number>('cardladder.indexesNavTimeoutMs') ?? 60_000;
  }

  private cardsWaitMs(): number {
    return this.config.get<number>('cardladder.indexesCardsWaitMs') ?? 30_000;
  }

  private scraperProxy(): { proxy: { server: string } } | undefined {
    const s = this.config.get<string>('cardladder.indexesScraperProxy')?.trim();
    if (!s) return undefined;
    return { proxy: { server: s } };
  }

  onModuleInit(): void {
    const proxy = this.scraperProxy();
    this.logger.log(
      proxy
        ? 'Card Ladder indexes scraper ready — Chromium will use CARDLADDER_INDEXES_SCRAPER_PROXY on first scrape.'
        : 'Card Ladder indexes scraper ready — first scrape launches Chromium (lazy).',
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

  /**
   * Scrapes Card Ladder's public indexes grid. Never throws — returns [] on failure.
   */
  async scrapeIndexes(): Promise<CardladderScrapedIndex[]> {
    try {
      const context = await this.ensureContext();
      const page = await context.newPage();
      try {
        await page.goto(CARDLADDER_INDEXES_URL, {
          waitUntil: 'domcontentloaded',
          timeout: this.navTimeoutMs(),
        });

        // Wait for load state to complete JS execution
        await page.waitForLoadState('load', {
          timeout: this.navTimeoutMs(),
        }).catch(() => undefined);

        // Try each selector in priority order
        let workingSelector: string | null = null;
        const deadline = Date.now() + this.cardsWaitMs();

        while (Date.now() < deadline) {
          for (const sel of CARD_SELECTORS) {
            const count = await page.locator(sel).count();
            if (count > 0) {
              workingSelector = sel;
              break;
            }
          }
          if (workingSelector) break;
          await page.waitForTimeout(1_500);
        }

        if (!workingSelector) {
          const title = await page.title().catch(() => '');
          const isCfChallenge =
            title.toLowerCase().includes('just a moment') ||
            (await page.locator('#challenge-error-text').count()) > 0;
          this.logger.warn(
            isCfChallenge
              ? 'Card Ladder indexes blocked by Cloudflare challenge — set CARDLADDER_INDEXES_SCRAPER_PROXY to a residential proxy'
              : `Card Ladder indexes page loaded but no card selector matched (page title: "${title}")`,
          );
          return [];
        }

        if (workingSelector !== CARD_SELECTORS[0]) {
          this.logger.warn(
            `Card Ladder indexes: primary selector "${CARD_SELECTORS[0]}" not found; using fallback "${workingSelector}"`,
          );
        }

        const parsed = await page.evaluate((sel: string) => {
          return Array.from(
            document.querySelectorAll<HTMLAnchorElement>(sel),
          ).map((a) => {
            const href = a.getAttribute('href') || '';
            const slug = href.split('/').filter(Boolean).pop() || '';
            const name = (a.querySelector('h6')?.textContent || '').trim();
            const pctText = (
              a.querySelector('.trending span')?.textContent || ''
            ).trim();
            const changePct = parseFloat(pctText.replace(/[^0-9.+-]/g, ''));
            const trending = a.querySelector('.trending');
            const direction = trending?.classList.contains('success')
              ? 'up'
              : trending?.classList.contains('danger')
                ? 'down'
                : pctText.startsWith('-')
                  ? 'down'
                  : 'up';
            return {
              slug,
              name,
              changePct,
              direction,
              href,
            };
          });
        }, workingSelector);

        const rows = parsed.filter(
          (row) =>
            row.slug &&
            row.name &&
            Number.isFinite(row.changePct) &&
            (row.direction === 'up' || row.direction === 'down'),
        ) as CardladderScrapedIndex[];

        this.logger.log(`Card Ladder indexes scrape ok — ${rows.length} rows`);
        return rows;
      } finally {
        await page.close().catch(() => undefined);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/Executable doesn't exist|playwright-core install/i.test(msg)) {
        this.logger.warn(
          'Card Ladder indexes scrape skipped — Chromium missing. Run: cd backend && pnpm run install:browsers',
        );
      } else {
        this.logger.warn(`Card Ladder indexes scrape failed: ${msg}`);
      }
      return [];
    }
  }

  private async ensureContext(): Promise<BrowserContext> {
    // Reuse the existing context as long as the browser is still connected.
    // The 'disconnected' event handler below nullifies both when the browser exits.
    if (this.context) {
      return this.context;
    }
    if (this.launchPromise) return this.launchPromise;

    this.launchPromise = (async () => {
      // Close any stale browser before launching a fresh one
      try {
        await this.browser?.close();
      } catch {
        /* ignore */
      }

      const { chromium } = await import('playwright-core');
      this.browser = await chromium.launch({
        headless: true,
        // Remove --enable-automation which Cloudflare specifically checks for
        ignoreDefaultArgs: ['--enable-automation'],
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-infobars',
          '--disable-background-networking',
          '--disable-default-apps',
          '--no-first-run',
          '--disable-extensions',
          '--window-size=1400,900',
        ],
      });

      const context = await this.browser.newContext({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        viewport: { width: 1400, height: 900 },
        locale: 'en-US',
        timezoneId: 'America/Los_Angeles',
        extraHTTPHeaders: {
          'accept-language': 'en-US,en;q=0.9',
          'accept':
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
        },
        ...(this.scraperProxy() ?? {}),
      });

      await context.addInitScript(STEALTH_INIT_SCRIPT);

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
