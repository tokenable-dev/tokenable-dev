import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Browser, BrowserContext } from 'playwright-core';
import { PsaCollectorsSessionService } from './psa-collectors-session.service';
import {
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
import {
  parsePsaEstimateUsdFromHtml,
  parsePsaEstimateUsdFromJson,
  parsePsaEstimateUsdFromPageText,
} from './utils/psa-cert-estimate-parse.util';

const POSITIVE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Scrapes PSA cert pages for website-only PSA Estimate USD.
 * Requires Collectors session — same setup as {@link PsaSpecScraperService}.
 */
@Injectable()
export class PsaCertEstimateScraperService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PsaCertEstimateScraperService.name);

  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private launchPromise: Promise<BrowserContext> | null = null;

  private readonly cache = new Map<
    string,
    { usd: number | null; expiresAt: number }
  >();
  private readonly inFlight = new Map<
    string,
    Promise<{ usd: number | null; authBlocked: boolean; playwrightMissing: boolean }>
  >();

  constructor(
    private readonly config: ConfigService,
    private readonly collectorsSession: PsaCollectorsSessionService,
  ) {}

  onModuleInit(): void {
    this.logger.log('PSA cert estimate scraper ready (lazy Chromium launch).');
  }

  async onModuleDestroy(): Promise<void> {
    await this.resetContext();
  }

  scrapeEstimateUsd(certNumber: string): Promise<number | null> {
    const cert = String(certNumber).replace(/\D/g, '').trim();
    if (!/^\d{7,10}$/.test(cert)) return Promise.resolve(null);
    if (!this.enabled()) return Promise.resolve(null);

    const hit = this.cache.get(cert);
    if (hit && hit.expiresAt > Date.now()) return Promise.resolve(hit.usd);

    const existing = this.inFlight.get(cert);
    if (existing) return existing.then((r) => r.usd);

    const job = this.scrapeOnce(cert)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`PSA cert estimate scrape errored cert=${cert}: ${msg}`);
        const playwrightMissing = /Executable doesn't exist|browserType\.launch/i.test(
          msg,
        );
        if (playwrightMissing) {
          this.logger.warn(
            'PSA cert estimate scraper: run `cd backend && pnpm run install:browsers`',
          );
        }
        return { usd: null, authBlocked: false, playwrightMissing } as const;
      })
      .finally(() => {
        this.inFlight.delete(cert);
      });

    this.inFlight.set(cert, job);
    return job.then((result) => {
      this.cache.set(cert, {
        usd: result.usd,
        expiresAt:
          Date.now() +
          (result.usd != null
            ? POSITIVE_TTL_MS
            : result.playwrightMissing
              ? this.playwrightMissingCacheTtlMs()
              : result.authBlocked
                ? this.authBlockedCacheTtlMs()
                : this.negativeCacheTtlMs()),
      });
      return result.usd;
    });
  }

  private enabled(): boolean {
    const raw = this.config.get<string>('psa.certEstimateScrapeEnabled');
    return raw !== '0' && raw !== 'false';
  }

  private async scrapeOnce(
    cert: string,
  ): Promise<{ usd: number | null; authBlocked: boolean; playwrightMissing: boolean }> {
    let result = await this.doScrape(cert);
    if (result.authBlocked) {
      this.logger.warn(
        `PSA cert estimate auth_blocked cert=${cert} — resetting context and retrying once`,
      );
      await this.resetContext();
      await new Promise((r) => setTimeout(r, 2_500));
      result = await this.doScrape(cert);
    }
    return { ...result, playwrightMissing: false };
  }

  private async doScrape(
    cert: string,
  ): Promise<{ usd: number | null; authBlocked: boolean }> {
    const context = await this.ensureContext();
    const navTimeout = this.navTimeoutMs();
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(navTimeout);
    page.setDefaultTimeout(navTimeout);

    const jsonHits: unknown[] = [];
    page.on('response', async (response) => {
      const u = response.url();
      if (!/psacard|collectors|psa/i.test(u)) return;
      const ct = response.headers()['content-type'] ?? '';
      if (!ct.includes('json')) return;
      try {
        const body = await response.text();
        if (!/estimate|valuation|price/i.test(body)) return;
        jsonHits.push(JSON.parse(body));
      } catch {
        /* ignore */
      }
    });

    const targetUrl = `https://www.psacard.com/cert/${cert}`;
    let sawAuthBlock = false;

    try {
      await page.goto(targetUrl, { waitUntil: 'commit', timeout: navTimeout });
      await page
        .waitForLoadState('domcontentloaded', { timeout: navTimeout })
        .catch(() => undefined);
      await waitForCloudflare(page, this.cloudflareTimeoutMs());

      if (isCollectorsSignInUrl(page.url())) {
        sawAuthBlock = true;
        return { usd: null, authBlocked: true };
      }

      for (const payload of jsonHits) {
        const fromJson = parsePsaEstimateUsdFromJson(payload);
        if (fromJson != null) {
          this.logger.log(`PSA cert estimate scrape OK cert=${cert} usd=${fromJson} (xhr)`);
          await this.persistCookies();
          return { usd: fromJson, authBlocked: false };
        }
      }

      const bodyText = await page
        .evaluate(() => document.body?.innerText ?? '')
        .catch(() => '');
      const fromText = parsePsaEstimateUsdFromPageText(bodyText);
      if (fromText != null) {
        this.logger.log(`PSA cert estimate scrape OK cert=${cert} usd=${fromText} (text)`);
        await this.persistCookies();
        return { usd: fromText, authBlocked: false };
      }

      const html = await page.content();
      const fromHtml = parsePsaEstimateUsdFromHtml(html);
      if (fromHtml != null) {
        this.logger.log(`PSA cert estimate scrape OK cert=${cert} usd=${fromHtml} (html)`);
        await this.persistCookies();
        return { usd: fromHtml, authBlocked: false };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.debug(
        `PSA cert estimate scrape cert=${cert} err=${msg.slice(0, 120)}`,
      );
    } finally {
      await page.close().catch(() => undefined);
    }

    if (sawAuthBlock) return { usd: null, authBlocked: true };
    this.logger.warn(`PSA cert estimate scrape: no_estimate cert=${cert}`);
    return { usd: null, authBlocked: false };
  }

  private async ensureContext(): Promise<BrowserContext> {
    if (this.context) return this.context;
    if (this.launchPromise) return this.launchPromise;

    this.launchPromise = (async () => {
      await this.collectorsSession.ensureFreshSession('cert_estimate');

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
          `PSA cert estimate scraper cookies: ${summarizeCollectorsCookies(cookies)}`,
        );
      }

      await this.warmUp(context);
      this.context = context;
      return context;
    })().catch(async (e) => {
      this.launchPromise = null;
      throw e;
    });

    return this.launchPromise;
  }

  private async warmUp(context: BrowserContext): Promise<void> {
    const page = await context.newPage();
    try {
      await page.goto('https://www.psacard.com/', {
        waitUntil: 'domcontentloaded',
        timeout: this.navTimeoutMs(),
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
    for (const w of warnings) this.logger.warn(`PSA cert estimate cookies: ${w}`);
    return cookies;
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

  private cookiesFile(): string {
    return this.config.get<string>('psa.collectorsCookiesFile')?.trim() ?? '';
  }

  private envRefreshToken(): string {
    return this.config.get<string>('psa.collectorsRefreshToken')?.trim() ?? '';
  }

  private userAgent(): string {
    return (
      this.config.get<string>('psa.specScraperUserAgent')?.trim() ||
      psaDefaultUserAgent()
    );
  }

  private browserChannel(): string | undefined {
    return this.config.get<string>('psa.specScraperChannel')?.trim() || undefined;
  }

  private userDataDir(): string | undefined {
    return this.config.get<string>('psa.specScraperUserDataDir')?.trim() || undefined;
  }

  private proxy(): string | undefined {
    return this.config.get<string>('psa.specScraperProxy')?.trim() || undefined;
  }

  private navTimeoutMs(): number {
    return this.config.get<number>('psa.specNavTimeoutMs') ?? 120_000;
  }

  private cloudflareTimeoutMs(): number {
    return this.config.get<number>('psa.specCloudflareTimeoutMs') ?? 45_000;
  }

  private negativeCacheTtlMs(): number {
    return this.config.get<number>('psa.specNegativeCacheMs') ?? 86_400_000;
  }

  private authBlockedCacheTtlMs(): number {
    return this.config.get<number>('psa.specAuthBlockedCacheMs') ?? 300_000;
  }

  private playwrightMissingCacheTtlMs(): number {
    return 60_000;
  }
}
