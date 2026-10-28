import { BadRequestException, HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  describePricechartingDownloadFailure,
  isRetryablePricechartingDownload,
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
const DOWNLOAD_ATTEMPTS = 2;

const CATALOG_HOSTS = new Set([
  'pricecharting.com',
  'www.pricecharting.com',
  'sportscardspro.com',
  'www.sportscardspro.com',
]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Seconds, or an HTTP-date. Unknown values do not extend the gap. */
function retryAfterMs(header: string | null, now: number): number {
  const raw = header?.trim() ?? '';
  if (!raw) return 0;
  if (/^\d+$/.test(raw)) return Number(raw) * 1000;
  const at = Date.parse(raw);
  if (Number.isNaN(at)) return 0;
  return Math.max(0, at - now);
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
  /** Shared by guide downloads and `GET /csv`. Next request may start at this time. */
  private nextCsvAt = 0;
  private csvGate: Promise<void> = Promise.resolve();

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

  /**
   * One CSV request at a time, at least 10 minutes from the previous request
   * start. The slot is reserved before `fetch`, including when that fetch fails.
   * `throw` is the HTTP proxy (do not block the handler). `wait` is a guide sync.
   */
  private async withCsvDownload<T>(
    mode: 'wait' | 'throw',
    fn: (startedAt: number) => Promise<T>,
  ): Promise<T> {
    let release!: () => void;
    const prev = this.csvGate;
    this.csvGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prev;
    try {
      const wait = Math.max(0, this.nextCsvAt - Date.now());
      if (wait > 0) {
        if (mode === 'throw') {
          throwPricechartingCsvCooldown(Math.ceil(wait / 1000));
        }
        await sleep(wait);
      }
      const startedAt = Date.now();
      this.lastCsvAt = startedAt;
      this.nextCsvAt = Math.max(this.nextCsvAt, startedAt + CSV_COOLDOWN_MS);
      return await fn(startedAt);
    } finally {
      release();
    }
  }

  /** 429 or Retry-After can push the next CSV start past the 10-minute floor. */
  private noteCsvPace(
    startedAt: number,
    upstream: { status: number; headers?: { get(name: string): string | null } },
  ): void {
    const header = upstream.headers?.get('retry-after') ?? null;
    if (upstream.status !== 429 && !header) return;
    const gap = Math.max(CSV_COOLDOWN_MS, retryAfterMs(header, Date.now()));
    this.nextCsvAt = Math.max(this.nextCsvAt, startedAt + gap);
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

    let url: URL;
    try {
      url = new URL(template);
    } catch {
      throwPricechartingCsvNotConfigured();
    }
    url.searchParams.set('t', token);

    const timeoutMs = CSV_HTTP_TIMEOUT_MS;
    return this.withCsvDownload('throw', async (startedAt) => {
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

      this.noteCsvPace(startedAt, upstream);
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

      this.logger.log(
        `PriceCharting CSV downloaded (${buf.length} bytes, content-type=${contentType})`,
      );
      return { buffer: buf, contentType, contentDisposition };
    });
  }

  /**
   * Guide CSV. Same 10-minute slot as `forwardCsv`. One request, then at most
   * one more after that slot when the failure is a connection reset or HTTP
   * 502/503/504. Import runs only after this returns.
   */
  async downloadPriceList(rawUrl: string): Promise<Buffer> {
    const token = this.getApiToken();
    if (!token) throwPricechartingNotConfigured();

    const url = buildCatalogDownloadUrl(rawUrl, token);
    const timeoutMs = CSV_HTTP_TIMEOUT_MS;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt += 1) {
      try {
        return await this.readPriceList(url, timeoutMs, attempt);
      } catch (err) {
        lastErr = err;
        if (attempt < DOWNLOAD_ATTEMPTS && isRetryablePricechartingDownload(err)) {
          continue;
        }
        if (err instanceof HttpException) throw err;
        throwPricechartingFetchFailed(err, timeoutMs);
      }
    }
    if (lastErr instanceof HttpException) throw lastErr;
    throwPricechartingFetchFailed(lastErr, timeoutMs);
  }

  private logDownloadFailure(
    attempt: number,
    phase: 'headers' | 'body' | 'http',
    err: unknown,
    startedAt: number,
  ): void {
    const described = describePricechartingDownloadFailure(err);
    this.logger.warn(
      JSON.stringify({
        msg: 'pricecharting_csv_download_failed',
        attempt,
        attempts: DOWNLOAD_ATTEMPTS,
        phase,
        kind: described.kind,
        status: described.status,
        durationMs: Date.now() - startedAt,
        reason: described.reason,
      }),
    );
  }

  private async readPriceList(url: URL, timeoutMs: number, attempt: number): Promise<Buffer> {
    return this.withCsvDownload('wait', async (startedAt) => {
      let upstream: Response;
      try {
        upstream = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'text/csv,*/*',
            'User-Agent': 'tokenable-pricecharting/1.0',
          },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        this.logDownloadFailure(attempt, 'headers', err, startedAt);
        throw err;
      }
      this.noteCsvPace(startedAt, upstream);
      let buf: Buffer;
      try {
        buf = Buffer.from(await upstream.arrayBuffer());
      } catch (err) {
        this.logDownloadFailure(attempt, 'body', err, startedAt);
        throw err;
      }
      if (!upstream.ok) {
        let payload: unknown = buf.toString('utf8').slice(0, 500);
        try {
          payload = JSON.parse(buf.toString('utf8'));
        } catch {
          /* keep text */
        }
        try {
          throwPricechartingUpstreamHttpError(upstream.status, payload);
        } catch (err) {
          this.logDownloadFailure(attempt, 'http', err, startedAt);
          throw err;
        }
      }
      this.logger.log(
        `PriceCharting price list downloaded (${buf.length} bytes, ${Date.now() - startedAt}ms, attempt ${attempt})`,
      );
      return buf;
    });
  }
}
