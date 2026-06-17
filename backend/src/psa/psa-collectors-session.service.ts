import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import {
  collectorsAuthNeedsRefresh,
  findRefreshToken,
  loadPsaCollectorsCookies,
  resolvePsaCollectorsSessionCookies,
  syncPsaCollectorsCookiesFileFromEnv,
  type PsaCollectorsCookie,
} from './utils/psa-collectors-cookies.util';
import { refreshCollectorsSessionViaBrowser } from './utils/psa-collectors-session.util';
import { psaDefaultUserAgent } from './utils/psa-collectors-browser.util';

/**
 * Keeps Collectors DSR/refreshToken fresh via headless browser session refresh.
 *
 * Set `PSA_COLLECTORS_REFRESH_TOKEN` in `.env` (local and production). The login
 * script is only needed once to obtain that value. Cookies file + Chromium profile
 * are auto-managed runtime caches (gitignored).
 */
@Injectable()
export class PsaCollectorsSessionService implements OnModuleInit {
  private readonly logger = new Logger(PsaCollectorsSessionService.name);
  private refreshInFlight: Promise<boolean> | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    if (!this.cookiesFile() && !this.envRefreshToken()) return;
    await this.bootstrapCookiesFileFromEnv().catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`PSA Collectors cookies bootstrap skipped: ${msg}`);
    });
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
        'PSA Collectors session: no refreshToken — set PSA_COLLECTORS_REFRESH_TOKEN in .env (run psa-collectors-login.ts once to obtain it)',
      );
      return false;
    }

    const envOnlyBootstrap =
      Boolean(this.envRefreshToken()) && !(await this.hasCookiesFileOnDisk());
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

    const detail = result.error ? `: ${result.error}` : '';
    this.logger.warn(`PSA Collectors session refresh failed (${reason})${detail}`);
    return false;
  }

  private async bootstrapCookiesFileFromEnv(): Promise<void> {
    const file = this.cookiesFile();
    const rt = this.envRefreshToken();
    if (!file || !rt) return;
    const outcome = await syncPsaCollectorsCookiesFileFromEnv(file, rt);
    if (outcome === 'created') {
      this.logger.log(
        'PSA Collectors: seeded cookies file from PSA_COLLECTORS_REFRESH_TOKEN',
      );
    } else if (outcome === 'updated') {
      this.logger.log(
        'PSA Collectors: cookies file refreshToken synced from PSA_COLLECTORS_REFRESH_TOKEN',
      );
    }
  }

  private async hasCookiesFileOnDisk(): Promise<boolean> {
    const file = this.cookiesFile();
    if (!file) return false;
    const rows = await loadPsaCollectorsCookies({ cookiesFile: file });
    return rows.length > 0;
  }

  private async loadSessionCookies(): Promise<PsaCollectorsCookie[]> {
    return resolvePsaCollectorsSessionCookies({
      cookiesFile: this.cookiesFile(),
      refreshToken: this.envRefreshToken(),
    });
  }
}
