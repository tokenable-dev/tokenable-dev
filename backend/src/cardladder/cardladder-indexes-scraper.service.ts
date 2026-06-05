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
    return this.config.get<number>('cardladder.indexesNavTimeoutMs') ?? 120_000;
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

        const deadline = Date.now() + this.navTimeoutMs();
        while (Date.now() < deadline) {
          const count = await page.locator('a.index-category-card').count();
          if (count > 0) break;
          await page.waitForTimeout(1_500);
        }

        const parsed = await page.evaluate(() => {
          return Array.from(
            document.querySelectorAll<HTMLAnchorElement>('a.index-category-card'),
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
        });

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
    if (this.context && !this.context.pages().every((p) => p.isClosed())) {
      return this.context;
    }
    if (this.launchPromise) return this.launchPromise;

    this.launchPromise = (async () => {
      const { chromium } = await import('playwright-core');
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
          '--no-sandbox',
          '--disable-dev-shm-usage',
        ],
      });

      const context = await this.browser.newContext({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        viewport: { width: 1400, height: 900 },
        locale: 'en-US',
        timezoneId: 'America/Los_Angeles',
        extraHTTPHeaders: { 'accept-language': 'en-US,en;q=0.9' },
        ...(this.scraperProxy() ?? {}),
      });

      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        const w = window as unknown as Record<string, unknown>;
        if (!w.chrome) w.chrome = { runtime: {} };
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
