import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import {
  collectorsAuthNeedsRefresh,
  cookiesFromRefreshTokenOnly,
  findRefreshToken,
  loadPsaCollectorsCookies,
  preparePsaCollectorsCookies,
  type PsaCollectorsCookie,
} from './utils/psa-collectors-cookies.util';
import { refreshCollectorsSessionViaBrowser } from './utils/psa-collectors-session.util';
import { psaDefaultUserAgent } from './utils/psa-scraper-browser.util';

/**
 * Keeps Collectors DSR/refreshToken fresh via headless browser session refresh.
 *
 * Bootstrap: set `PSA_COLLECTORS_REFRESH_TOKEN` once (from psa-collectors-login.ts).
 */
@Injectable()
export class PsaCollectorsSessionService implements OnModuleInit {
  private readonly logger = new Logger(PsaCollectorsSessionService.name);
  private refreshInFlight: Promise<boolean> | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    if (!this.cookiesFile() && !this.envRefreshToken()) return;
    await this.ensureFreshSession('boot').catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`PSA Collectors session boot refresh skipped: ${msg}`);
    });
  }

  async ensureFreshSession(reason: string): Promise<boolean> {
    if (this.refreshInFlight) return this.refreshInFlight;
    this.refreshInFlight = this.doEnsureFreshSession(reason).finally(() => {
      this.refreshInFlight = null;
    });
    return this.refreshInFlight;
  }

  @Cron('0 0 */6 * * *')
  async scheduledRefresh(): Promise<void> {
    if (!this.cronEnabled()) return;
    if (!this.cookiesFile() && !this.envRefreshToken()) return;
    await this.ensureFreshSession('cron').catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`PSA Collectors scheduled refresh failed: ${msg}`);
    });
  }

  private cookiesFile(): string {
    return this.config.get<string>('psa.collectorsCookiesFile')?.trim() ?? '';
  }

  private envRefreshToken(): string {
    return this.config.get<string>('psa.collectorsRefreshToken')?.trim() ?? '';
  }

  private refreshLeadMs(): number {
    return this.config.get<number>('psa.collectorsAuthRefreshLeadMs') ?? 172_800_000;
  }

  private cronEnabled(): boolean {
    return this.config.get<boolean>('psa.collectorsAuthRefreshCron') === true;
  }

  private browserOptions() {
    return {
      userAgent:
        this.config.get<string>('psa.specScraperUserAgent')?.trim() ||
        psaDefaultUserAgent(),
      channel: this.config.get<string>('psa.specScraperChannel')?.trim() || undefined,
      userDataDir: this.config.get<string>('psa.specScraperUserDataDir')?.trim() || undefined,
      proxy: this.config.get<string>('psa.specScraperProxy')?.trim() || undefined,
      cloudflareTimeoutMs:
        this.config.get<number>('psa.specCloudflareTimeoutMs') ?? 45_000,
      cookiesFile: this.cookiesFile() || undefined,
    };
  }

  private async doEnsureFreshSession(reason: string): Promise<boolean> {
    const cookies = await this.loadSessionCookies();
    if (!findRefreshToken(cookies)) {
      this.logger.warn(
        'PSA Collectors session: no refreshToken — set PSA_COLLECTORS_REFRESH_TOKEN or run psa-collectors-login.ts',
      );
      return false;
    }

    const envOnlyBootstrap =
      Boolean(this.envRefreshToken()) && !(await this.hasCookiesFile());
    const needsRefresh = collectorsAuthNeedsRefresh(
      cookies,
      this.refreshLeadMs(),
    );

    if (!envOnlyBootstrap && !needsRefresh) {
      this.logger.debug(
        `PSA Collectors session: DSR still fresh — skip refresh (${reason})`,
      );
      return false;
    }

    const result = await refreshCollectorsSessionViaBrowser(
      cookies,
      this.browserOptions(),
    );

    if (result.refreshed) {
      this.logger.log(`PSA Collectors session refreshed (${reason})`);
      return true;
    }

    this.logger.warn(`PSA Collectors session refresh failed (${reason})`);
    return false;
  }

  private async hasCookiesFile(): Promise<boolean> {
    const file = this.cookiesFile();
    if (!file) return false;
    const rows = await loadPsaCollectorsCookies({ cookiesFile: file }).catch(
      () => [],
    );
    return rows.length > 0;
  }

  private async loadSessionCookies(): Promise<PsaCollectorsCookie[]> {
    const file = this.cookiesFile();
    const fromFile = file
      ? await loadPsaCollectorsCookies({ cookiesFile: file }).catch(() => [])
      : [];

    if (fromFile.length > 0) {
      return preparePsaCollectorsCookies(fromFile).cookies;
    }

    const envRt = this.envRefreshToken();
    if (envRt) return cookiesFromRefreshTokenOnly(envRt);
    return [];
  }
}
