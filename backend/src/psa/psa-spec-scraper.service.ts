import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Browser, BrowserContext, Page } from 'playwright-core';
import { PsaCollectorsSessionService } from './psa-collectors-session.service';
import {
  hasCollectorsAuthCookies,
  playwrightCookiesFromContext,
  preparePsaCollectorsCookies,
  resolvePsaCollectorsSessionCookies,
  savePsaCollectorsCookiesFile,
  summarizeCollectorsCookies,
  type PsaCollectorsCookie,
} from './utils/psa-collectors-cookies.util';
import {
  closePsaChromiumContext,
  isCollectorsSignInUrl,
  launchPsaChromiumContext,
  psaDefaultUserAgent,
  waitForCloudflare,
} from './utils/psa-collectors-browser.util';

const CDN_HOST = 'd1htnxwo4o0jhw.cloudfront.net';
const POSITIVE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Scrapes PSA spec pages for card-only CloudFront image URLs.
 * Requires Collectors session — see `PsaCollectorsSessionService` and
 * `scripts/psa-collectors-login.ts`.
 */
@Injectable()
export class PsaSpecScraperService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PsaSpecScraperService.name);

  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private launchPromise: Promise<BrowserContext> | null = null;

  private readonly cache = new Map<
    string,
    { url: string | null; expiresAt: number }
  >();
  private readonly inFlight = new Map<
    string,
    Promise<{ url: string | null; authBlocked: boolean; playwrightMissing: boolean }>
  >();

  /** Drop cached null so the next cover retry can hit Playwright again (e.g. after install:browsers). */
  bustCache(specId: string | number): void {
    const id = String(specId).trim();
    if (!/^\d+$/.test(id)) return;
    this.cache.delete(id);
    this.inFlight.delete(id);
  }

  constructor(
    private readonly config: ConfigService,
    private readonly collectorsSession: PsaCollectorsSessionService,
  ) {}

  onModuleInit(): void {
    this.logger.log('PSA spec scraper ready (lazy Chromium launch).');
  }

  async onModuleDestroy(): Promise<void> {
    await this.resetContext();
  }

  async scrapeSpecImageUrl(specId: string | number): Promise<string | null> {
    const id = String(specId).trim();
    if (!/^\d+$/.test(id)) return null;

    const hit = this.cache.get(id);
    if (hit && hit.expiresAt > Date.now()) return hit.url;

    const existing = this.inFlight.get(id);
    if (existing) return (await existing).url;

    const job = this.scrapeOnce(id)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`PSA spec scrape errored specId=${id}: ${msg}`);
        const playwrightMissing = this.isPlaywrightMissingError(msg);
        if (playwrightMissing) {
          this.logger.warn(
            'PSA spec scraper: run `cd backend && pnpm run install:browsers`',
          );
        }
        return { url: null, authBlocked: false, playwrightMissing } as const;
      })
      .finally(() => {
        this.inFlight.delete(id);
      });

    this.inFlight.set(id, job);
    const result = await job;

    this.cache.set(id, {
      url: result.url,
      expiresAt:
        Date.now() +
        (result.url
          ? POSITIVE_TTL_MS
          : result.playwrightMissing
            ? this.playwrightMissingCacheTtlMs()
            : result.authBlocked
              ? this.authBlockedCacheTtlMs()
              : this.negativeCacheTtlMs()),
    });

    return result.url;
  }

  private isPlaywrightMissingError(msg: string): boolean {
    return /Executable doesn't exist|browserType\.launch/i.test(msg);
  }

  private async scrapeOnce(
    specId: string,
  ): Promise<{ url: string | null; authBlocked: boolean; playwrightMissing: boolean }> {
    let result = await this.doScrape(specId);

    if (result.authBlocked) {
      this.logger.warn(
        `PSA spec auth_blocked specId=${specId} — resetting context and retrying once`,
      );
      await this.resetContext();
      await new Promise((r) => setTimeout(r, 2_500));
      result = await this.doScrape(specId);
    }

    return { ...result, playwrightMissing: false };
  }

  private async doScrape(
    specId: string,
  ): Promise<{ url: string | null; authBlocked: boolean }> {
    const context = await this.ensureContext();
    const navTimeout = this.navTimeoutMs();
    const imgTimeout = this.imgTimeoutMs();
    const urls = [
      `https://www.psacard.com/spec/psa/${specId}?g=10&gt=SINGLE_GRADED`,
      `https://www.psacard.com/spec/psa/${specId}`,
    ];

    let sawAuthBlock = false;

    for (const targetUrl of urls) {
      const page = await context.newPage();
      page.setDefaultNavigationTimeout(navTimeout);
      page.setDefaultTimeout(Math.max(navTimeout, imgTimeout));
      const networkHits: string[] = [];

      page.on('response', (response) => {
        const u = response.url();
        if (u.includes(`/spec/${specId}/`) && u.includes('cloudfront')) {
          networkHits.push(u);
        }
      });

      try {
        await page.goto(targetUrl, { waitUntil: 'commit', timeout: navTimeout });
        await page
          .waitForLoadState('domcontentloaded', { timeout: navTimeout })
          .catch(() => undefined);
        await waitForCloudflare(page, this.cloudflareTimeoutMs());

        if (isCollectorsSignInUrl(page.url())) {
          sawAuthBlock = true;
          continue;
        }

        const fromNetwork = networkHits.find((u) =>
          this.specImageFromText(u, specId),
        );
        if (fromNetwork) {
          const img = this.normalizeImageUrl(fromNetwork);
          this.logger.log(
            `PSA spec scrape OK specId=${specId} → ${img.slice(0, 100)}`,
          );
          await this.persistCookies();
          return { url: img, authBlocked: false };
        }

        const extracted = await this.extractImageFromPage(
          page,
          specId,
          imgTimeout,
        );
        if (extracted) {
          this.logger.log(
            `PSA spec scrape OK specId=${specId} → ${extracted.slice(0, 100)}`,
          );
          await this.persistCookies();
          return { url: extracted, authBlocked: false };
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.debug(`PSA spec scrape specId=${specId} err=${msg.slice(0, 120)}`);
      } finally {
        await page.close().catch(() => undefined);
      }
    }

    if (sawAuthBlock) return { url: null, authBlocked: true };
    this.logger.warn(`PSA spec scrape: no_image specId=${specId}`);
    return { url: null, authBlocked: false };
  }

  private specImageFromText(text: string, specId: string): string | null {
    const host = CDN_HOST.replace(/\./g, '\\.');
    const re = new RegExp(
      `https?://${host}/spec/${specId}/[A-Za-z0-9_\\-]+\\.(?:jpg|jpeg|png|webp)`,
      'i',
    );
    return text.match(re)?.[0] ?? null;
  }

  private normalizeImageUrl(src: string): string {
    const t = src.trim();
    return t.startsWith('//') ? `https:${t}` : t;
  }

  private async extractImageFromPage(
    page: Page,
    specId: string,
    imgTimeout: number,
  ): Promise<string | null> {
    const selector = `img[src*="${CDN_HOST}/spec/${specId}/"]`;
    const readSrc = async (timeout: number) =>
      page
        .waitForSelector(selector, { state: 'attached', timeout })
        .then((el) => el?.getAttribute('src') ?? null)
        .catch(() => null);

    let raw = await readSrc(imgTimeout);
    if (raw) return this.normalizeImageUrl(raw);

    const html = await page.content();
    return this.specImageFromText(html, specId);
  }

  private async ensureContext(): Promise<BrowserContext> {
    if (this.context) return this.context;
    if (this.launchPromise) return this.launchPromise;

    this.launchPromise = (async () => {
      await this.collectorsSession.ensureFreshSession('scrape');

      const { context, browser } = await launchPsaChromiumContext({
        userAgent: this.userAgent(),
        channel: this.browserChannel(),
        userDataDir: this.userDataDir(),
        proxy: this.proxy(),
      });
      this.browser = browser;

      const cookies = await this.loadCookies();
      for (const cookie of cookies) {
        await context.addCookies([cookie]).catch(() => undefined);
      }
      if (cookies.length > 0) {
        this.logger.log(
          `PSA spec scraper: injected ${summarizeCollectorsCookies(cookies)}`,
        );
      }

      if (hasCollectorsAuthCookies(cookies) || this.userDataDir()) {
        await this.warmUp(context);
        await this.persistCookies();
      }

      if (browser) {
        browser.on('disconnected', () => {
          this.browser = null;
          this.context = null;
          this.launchPromise = null;
        });
      } else {
        context.on('close', () => {
          this.context = null;
          this.launchPromise = null;
        });
      }

      this.context = context;
      return context;
    })().finally(() => {
      this.launchPromise = null;
    });

    return this.launchPromise;
  }

  private async warmUp(context: BrowserContext): Promise<void> {
    const page = await context.newPage();
    try {
      await page.goto('https://www.psacard.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      });
      await waitForCloudflare(page, this.cloudflareTimeoutMs());
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  private async loadCookies(): Promise<PsaCollectorsCookie[]> {
    const cookies = await resolvePsaCollectorsSessionCookies({
      cookiesFile: this.cookiesFile(),
      refreshToken: this.envRefreshToken(),
    });
    const { warnings } = preparePsaCollectorsCookies(cookies);
    for (const w of warnings) this.logger.warn(`PSA spec cookies: ${w}`);
    return cookies;
  }

  private envRefreshToken(): string {
    return this.config.get<string>('psa.collectorsRefreshToken')?.trim() ?? '';
  }

  private async persistCookies(): Promise<void> {
    const file = this.cookiesFile();
    if (!file || !this.context) return;
    const cookies = playwrightCookiesFromContext(await this.context.cookies());
    if (cookies.length === 0) return;
    await savePsaCollectorsCookiesFile(file, cookies).catch(() => undefined);
  }

  private async resetContext(): Promise<void> {
    if (this.context) {
      await closePsaChromiumContext(this.context, this.browser);
    }
    this.context = null;
    this.browser = null;
    this.launchPromise = null;
  }

  private navTimeoutMs(): number {
    return this.config.get<number>('psa.specNavTimeoutMs') ?? 120_000;
  }

  private imgTimeoutMs(): number {
    return this.config.get<number>('psa.specImgTimeoutMs') ?? 45_000;
  }

  private cloudflareTimeoutMs(): number {
    return this.config.get<number>('psa.specCloudflareTimeoutMs') ?? 45_000;
  }

  private negativeCacheTtlMs(): number {
    return this.config.get<number>('psa.specNegativeCacheMs') ?? 3_600_000;
  }

  private authBlockedCacheTtlMs(): number {
    return this.config.get<number>('psa.specAuthBlockedCacheMs') ?? 300_000;
  }

  /** Short TTL when Chromium is missing — retries succeed right after install:browsers. */
  private playwrightMissingCacheTtlMs(): number {
    return this.config.get<number>('psa.specPlaywrightMissingCacheMs') ?? 30_000;
  }

  private cookiesFile(): string {
    return this.config.get<string>('psa.collectorsCookiesFile')?.trim() ?? '';
  }

  private userDataDir(): string {
    return this.config.get<string>('psa.specScraperUserDataDir')?.trim() ?? '';
  }

  private browserChannel(): string | undefined {
    const ch = this.config.get<string>('psa.specScraperChannel')?.trim();
    return ch || undefined;
  }

  private userAgent(): string {
    return (
      this.config.get<string>('psa.specScraperUserAgent')?.trim() ||
      psaDefaultUserAgent()
    );
  }

  private proxy(): string | undefined {
    const s = this.config.get<string>('psa.specScraperProxy')?.trim();
    return s || undefined;
  }
}
