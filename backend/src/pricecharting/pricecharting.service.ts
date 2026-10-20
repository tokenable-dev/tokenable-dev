import { BadRequestException, HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  isPricechartingConnectionReset,
  throwPricechartingCsvCooldown,
  throwPricechartingCsvNotConfigured,
  throwPricechartingFetchFailed,
  throwPricechartingNotConfigured,
  throwPricechartingUpstreamHttpError,
} from './pricecharting-errors';

const DEFAULT_BASE = 'https://www.pricecharting.com';
const JSON_MIN_INTERVAL_MS = 1_000;
const CSV_COOLDOWN_MS = 10 * 60 * 1_000;
const DEFAULT_HTTP_TIMEOUT_MS = 30_000;
const CSV_HTTP_TIMEOUT_MS = 120_000;

const CATALOG_HOSTS = new Set([
  'pricecharting.com',
  'www.pricecharting.com',
  'sportscardspro.com',
  'www.sportscardspro.com',
]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseAllowedCatalogUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new BadRequestException(
      'CSV URL must be an https link on pricecharting.com or sportscardspro.com',
    );
  }
  if (url.protocol !== 'https:' || !CATALOG_HOSTS.has(url.hostname.toLowerCase())) {
    throw new BadRequestException(
      'CSV URL must be an https link on pricecharting.com or sportscardspro.com',
    );
  }
  return url;
}

/** Stored form: same link the admin pasted, with any `t` token removed. */
export function normalizeCatalogSourceUrl(raw: string): string {
  const url = parseAllowedCatalogUrl(raw);
  url.searchParams.delete('t');
  url.hash = '';
  return url.toString();
}

/** Fetch form: server token overwrites `t`. */
export function buildCatalogDownloadUrl(raw: string, token: string): URL {
  const url = parseAllowedCatalogUrl(raw);
  url.searchParams.set('t', token);
  return url;
}

/**
 * PriceCharting Prices upstream (`/api/product`, `/api/products`) + Legendary CSV.
 * Server injects `t`; Marketplace APIs are intentionally not proxied.
 */
@Injectable()
export class PricechartingService {
  private readonly logger = new Logger(PricechartingService.name);

  /** Serializes JSON calls and enforces ≤1 req/sec (upstream hard limit). */
  private jsonGate: Promise<void> = Promise.resolve();
  private lastJsonAt = 0;

  private lastCsvAt = 0;

  constructor(private readonly config: ConfigService) {}

  getUpstreamBase(): string {
    const raw =
      this.config.get<string>('PRICECHARTING_BASE_URL') ?? DEFAULT_BASE;
    return raw.replace(/\/$/, '');
  }

  private getApiToken(): string | null {
    const t = this.config.get<string>('PRICECHARTING_API_TOKEN')?.trim();
    return t ? t : null;
  }

  private getCsvUrlTemplate(): string | null {
    const u = this.config.get<string>('PRICECHARTING_CSV_URL')?.trim();
    return u ? u : null;
  }

  assertConfigured(): void {
    if (!this.getApiToken()) throwPricechartingNotConfigured();
  }

  private httpTimeoutMs(): number {
    const raw = Number(
      this.config.get<string>('PRICECHARTING_HTTP_TIMEOUT_MS') ??
        String(DEFAULT_HTTP_TIMEOUT_MS),
    );
    if (!Number.isFinite(raw)) return DEFAULT_HTTP_TIMEOUT_MS;
    return Math.min(120_000, Math.max(3_000, Math.floor(raw)));
  }

  /**
   * Queue JSON upstream calls so we never exceed 1 call/second globally
   * in this process (PriceCharting revokes accounts that hammer the API).
   */
  private async withJsonRateLimit<T>(fn: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const prev = this.jsonGate;
    this.jsonGate = new Promise<void>((r) => {
      release = r;
    });
    await prev;
    try {
      const wait = Math.max(0, JSON_MIN_INTERVAL_MS - (Date.now() - this.lastJsonAt));
      if (wait > 0) await sleep(wait);
      this.lastJsonAt = Date.now();
      return await fn();
    } finally {
      release();
    }
  }

  private assertCsvCooldown(): void {
    if (this.lastCsvAt <= 0) return;
    const elapsed = Date.now() - this.lastCsvAt;
    if (elapsed >= CSV_COOLDOWN_MS) return;
    const retryAfterSec = Math.ceil((CSV_COOLDOWN_MS - elapsed) / 1000);
    throwPricechartingCsvCooldown(retryAfterSec);
  }

  /**
   * GET JSON Prices API. Client must not pass `t` — we overwrite it.
   */
  async forwardJsonGet(
    upstreamPath: string,
    query?: Record<string, string | undefined>,
  ): Promise<unknown> {
    const token = this.getApiToken();
    if (!token) throwPricechartingNotConfigured();

    return this.withJsonRateLimit(async () => {
      const base = this.getUpstreamBase();
      const url = new URL(upstreamPath.replace(/^\//, ''), `${base}/`);
      if (query) {
        for (const [k, v] of Object.entries(query)) {
          if (k === 't') continue;
          if (v !== undefined && v !== '') url.searchParams.set(k, v);
        }
      }
      url.searchParams.set('t', token);

      const timeoutMs = this.httpTimeoutMs();
      let upstream: Response;
      try {
        upstream = await fetch(url, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (e) {
        throwPricechartingFetchFailed(e, timeoutMs);
      }

      const text = await upstream.text();
      let payload: unknown = text;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        /* keep text */
      }

      if (!upstream.ok) {
        throwPricechartingUpstreamHttpError(upstream.status, payload);
      }

      if (
        payload &&
        typeof payload === 'object' &&
        (payload as { status?: string }).status === 'error'
      ) {
        throwPricechartingUpstreamHttpError(
          upstream.status >= 400 ? upstream.status : 400,
          payload,
        );
      }

      return payload;
    });
  }

  /**
   * Legendary CSV download. URL comes from Subscription → API/Download
   * (`PRICECHARTING_CSV_URL`); we rewrite `t` with the server token.
   */
  async forwardCsv(): Promise<{
    buffer: Buffer;
    contentType: string;
    contentDisposition: string | null;
  }> {
    const token = this.getApiToken();
    if (!token) throwPricechartingNotConfigured();

    const template = this.getCsvUrlTemplate();
    if (!template) throwPricechartingCsvNotConfigured();

    this.assertCsvCooldown();

    let url: URL;
    try {
      url = new URL(template);
    } catch {
      throwPricechartingCsvNotConfigured();
    }
    url.searchParams.set('t', token);

    const timeoutMs = CSV_HTTP_TIMEOUT_MS;
    let upstream: Response;
    try {
      upstream = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'text/csv,*/*' },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      throwPricechartingFetchFailed(e, timeoutMs);
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    const contentType =
      upstream.headers.get('content-type') ?? 'text/csv; charset=utf-8';
    const contentDisposition = upstream.headers.get('content-disposition');

    if (!upstream.ok) {
      let payload: unknown = buf.toString('utf8');
      try {
        payload = JSON.parse(buf.toString('utf8'));
      } catch {
        /* keep text */
      }
      throwPricechartingUpstreamHttpError(upstream.status, payload);
    }

    this.lastCsvAt = Date.now();
    this.logger.log(
      `PriceCharting CSV downloaded (${buf.length} bytes, content-type=${contentType})`,
    );
    return { buffer: buf, contentType, contentDisposition };
  }

  /**
   * Admin catalog fetch. Separate from the single-URL `/csv` proxy so a list
   * of guides is not blocked by that route's 10-minute cooldown.
   */
  async downloadPriceList(rawUrl: string): Promise<Buffer> {
    const token = this.getApiToken();
    if (!token) throwPricechartingNotConfigured();

    const url = buildCatalogDownloadUrl(rawUrl, token);
    const timeoutMs = CSV_HTTP_TIMEOUT_MS;
    const attempts = 3;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await this.readPriceList(url, timeoutMs);
      } catch (err) {
        if (err instanceof HttpException) throw err;
        const again = attempt < attempts && isPricechartingConnectionReset(err);
        if (!again) throwPricechartingFetchFailed(err, timeoutMs);
        this.logger.warn(
          `PriceCharting download connection reset (attempt ${attempt} of ${attempts})`,
        );
        await sleep(4_000 * attempt);
      }
    }
    throwPricechartingFetchFailed(new Error('terminated'), timeoutMs);
  }

  private async readPriceList(url: URL, timeoutMs: number): Promise<Buffer> {
    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'text/csv,*/*',
        'User-Agent': 'tokenable-pricecharting/1.0',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const buf = Buffer.from(await upstream.arrayBuffer());
    if (!upstream.ok) {
      let payload: unknown = buf.toString('utf8').slice(0, 500);
      try {
        payload = JSON.parse(buf.toString('utf8'));
      } catch {
        /* keep text */
      }
      throwPricechartingUpstreamHttpError(upstream.status, payload);
    }
    this.logger.log(`PriceCharting price list downloaded (${buf.length} bytes)`);
    return buf;
  }
}
