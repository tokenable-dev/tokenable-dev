import {
  HttpException,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CardhedgerMetricsService,
  UpstreamCallOutcome,
} from '../common/metrics/cardhedger-metrics.service';
import type { CardhedgerUpstreamOperation } from '../common/metrics/cardhedger-upstream.util';

/**
 * Card Hedge upstream (`https://api.cardhedger.com`) with server-side `X-API-Key`.
 * Used by explicit Swagger-documented controllers (JSON POST/GET).
 */
@Injectable()
export class CardhedgerService {
  private readonly logger = new Logger(CardhedgerService.name);

  constructor(
    private readonly config: ConfigService,
    /**
     * Optional so CardhedgerService can be used in test contexts without
     * the full metrics module wired. When present (production), all circuit
     * state transitions are forwarded for per-minute aggregation.
     */
    @Optional() private readonly metrics?: CardhedgerMetricsService,
  ) {}

  getUpstreamBase(): string {
    const raw =
      this.config.get<string>('CARDHEDGER_BASE_URL') ??
      'https://api.cardhedger.com';
    return raw.replace(/\/$/, '');
  }

  private getApiKey(): string | null {
    const k = this.config.get<string>('CARDHEDGER_API_KEY');
    const t = k?.trim();
    return t ? t : null;
  }

  assertConfigured(): void {
    if (!this.getApiKey()) {
      throw new ServiceUnavailableException(
        'CARDHEDGER_API_KEY is not configured',
      );
    }
  }

  // ─── Circuit breaker ──────────────────────────────────────────────────────
  // Tracks consecutive retryable failures (429 / 5xx / network).
  // CLOSED → OPEN after N failures; OPEN → HALF_OPEN after reset window;
  // HALF_OPEN → CLOSED on probe success, back to OPEN on probe failure.
  // Config keys: CARDHEDGER_CIRCUIT_BREAKER_THRESHOLD (default 5)
  //              CARDHEDGER_CIRCUIT_BREAKER_RESET_MS   (default 30 000)

  private cbState: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private cbConsecutiveFailures = 0;
  private cbOpenedAt = 0;

  private cbThreshold(): number {
    const raw = Number(
      this.config.get<string>('CARDHEDGER_CIRCUIT_BREAKER_THRESHOLD') ?? '5',
    );
    return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 5;
  }

  private cbResetMs(): number {
    const raw = Number(
      this.config.get<string>('CARDHEDGER_CIRCUIT_BREAKER_RESET_MS') ?? '30000',
    );
    return Number.isFinite(raw) && raw >= 5_000 ? Math.floor(raw) : 30_000;
  }

  /**
   * Per-attempt fetch timeout (ms).
   *
   * Relationship with circuit breaker (defaults):
   *   - 20 s timeout × 4 attempts (MAX_RETRIES=3) ≈ 80 s worst-case per forwardJson
   *   - threshold 5 consecutive forwardJson failures → OPEN
   *   - total hang-to-OPEN worst case ≈ 80 s × 5 ≈ 400 s (was ~480 s × 5 ≈ 40 min)
   *
   * Config: CARDHEDGER_HTTP_TIMEOUT_MS (min 3 000, max 120 000, default 20 000)
   */
  private httpTimeoutMs(): number {
    const raw = Number(
      this.config.get<string>('CARDHEDGER_HTTP_TIMEOUT_MS') ?? '20000',
    );
    if (!Number.isFinite(raw)) return 20_000;
    return Math.min(120_000, Math.max(3_000, Math.floor(raw)));
  }

  /** Returns true when the circuit is OPEN and the request should be skipped. */
  private isCircuitOpen(): boolean {
    if (this.cbState === 'CLOSED') return false;
    if (this.cbState === 'OPEN') {
      if (Date.now() - this.cbOpenedAt >= this.cbResetMs()) {
        this.cbState = 'HALF_OPEN';
        this.logger.log(
          '[circuit] state=HALF_OPEN endpoint=cardhedger — probe allowed',
        );
        this.metrics?.recordCircuitStateChange('HALF_OPEN');
        return false;
      }
      return true;
    }
    return false; // HALF_OPEN: allow the single probe
  }

  private recordCircuitSuccess(): void {
    if (this.cbState !== 'CLOSED') {
      this.logger.log(
        `[circuit] state=CLOSED endpoint=cardhedger — recovered after ${this.cbConsecutiveFailures} failures`,
      );
      this.metrics?.recordCircuitStateChange('CLOSED');
    }
    this.cbState = 'CLOSED';
    this.cbConsecutiveFailures = 0;
  }

  /** Call with the HTTP status when a retryable failure escapes the retry loop. */
  private recordCircuitFailure(status?: number): void {
    this.cbConsecutiveFailures++;
    const descriptor = status != null ? `http_${status}` : 'network';
    if (this.cbState === 'HALF_OPEN') {
      this.cbState = 'OPEN';
      this.cbOpenedAt = Date.now();
      this.logger.warn(
        `[circuit] state=OPEN endpoint=cardhedger — probe_failed ${descriptor}`,
      );
      this.metrics?.recordCircuitStateChange('OPEN');
      return;
    }
    if (
      this.cbState === 'CLOSED' &&
      this.cbConsecutiveFailures >= this.cbThreshold()
    ) {
      this.cbState = 'OPEN';
      this.cbOpenedAt = Date.now();
      this.logger.warn(
        `[circuit] state=OPEN endpoint=cardhedger consecutive_failures=${this.cbConsecutiveFailures} trigger=${descriptor}`,
      );
      this.metrics?.recordCircuitStateChange('OPEN');
    }
  }

  /** Current circuit state — used by health checks or admin endpoints. */
  getCircuitState(): { state: string; consecutiveFailures: number } {
    return {
      state: this.cbState,
      consecutiveFailures: this.cbConsecutiveFailures,
    };
  }

  /**
   * Low-level fetch with retry.
   *
   * Retries up to MAX_RETRIES times on:
   *   - Network / timeout errors (fetch throws)
   *   - HTTP 429 Too Many Requests
   *   - HTTP 5xx Server Errors
   *
   * Non-retryable responses (2xx, 3xx, 4xx except 429) are returned
   * immediately so callers can handle them as-is.
   *
   * The response body is NOT consumed here — callers read it themselves.
   */
  private async attemptFetch(
    url: URL,
    init: RequestInit,
    timeoutMs?: number,
  ): Promise<globalThis.Response> {
    const MAX_RETRIES = 3;
    const BASE_DELAY_MS = 500;
    const effectiveTimeout = timeoutMs ?? this.httpTimeoutMs();

    let lastNetworkError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        // Exponential backoff with ±300 ms jitter
        const backoff = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 300;
        await new Promise<void>((r) => setTimeout(r, backoff + jitter));
      }

      const ac = new AbortController();
      const to = setTimeout(() => ac.abort(), effectiveTimeout);

      try {
        const res = await fetch(url, { ...init, signal: ac.signal });

        // Retryable HTTP status codes: 429 and 5xx
        const retryable = res.status === 429 || res.status >= 500;
        if (!retryable || attempt === MAX_RETRIES) {
          // Success, or a non-retryable error, or exhausted retries — hand off
          return res;
        }

        const retryAfterSec = Number(res.headers.get('Retry-After') ?? 0);
        const waitMs = retryAfterSec > 0
          ? Math.min(retryAfterSec * 1000, 10_000)
          : BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 300;

        this.logger.warn(
          `Card Hedge HTTP ${res.status} on attempt ${attempt + 1}/${MAX_RETRIES + 1} — retrying in ${Math.round(waitMs)}ms`,
        );
        await new Promise<void>((r) => setTimeout(r, waitMs));
        continue;
      } catch (e) {
        lastNetworkError = e;
        if (attempt < MAX_RETRIES) {
          this.logger.warn(
            `Card Hedge network error on attempt ${attempt + 1}/${MAX_RETRIES + 1}: ${e instanceof Error ? e.message : String(e)}`,
          );
          continue;
        }
      } finally {
        clearTimeout(to);
      }
    }

    const msg =
      lastNetworkError instanceof Error
        ? lastNetworkError.message
        : String(lastNetworkError);
    throw new ServiceUnavailableException(`Card Hedge unreachable: ${msg}`);
  }

  /**
   * @param upstreamPath absolute path starting with `/v1/…`
   */
  async forwardJson(
    method: 'GET' | 'POST',
    upstreamPath: string,
    opts?: {
      query?: Record<string, string | undefined>;
      body?: unknown;
      /** Optional logical operation for per-flow upstream metrics (Phase 0+). */
      metricsOperation?: CardhedgerUpstreamOperation;
    },
  ): Promise<unknown> {
    if (this.isCircuitOpen()) {
      throw new ServiceUnavailableException(
        'Cardhedger circuit breaker open — request skipped',
      );
    }

    const key = this.getApiKey();
    if (!key) {
      throw new ServiceUnavailableException(
        'CARDHEDGER_API_KEY is not configured',
      );
    }

    const base = this.getUpstreamBase();
    const url = new URL(upstreamPath.replace(/^\//, ''), `${base}/`);
    if (opts?.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined && v !== '') {
          url.searchParams.set(k, v);
        }
      }
    }

    const headers: Record<string, string> = {
      'X-API-Key': key,
      Accept: 'application/json',
    };

    const init: RequestInit = { method, headers };
    if (method === 'POST' && opts?.body !== undefined) {
      headers['Content-Type'] = 'application/json; charset=utf-8';
      init.body = JSON.stringify(opts.body);
    }

    const startedAt = Date.now();
    let outcome: UpstreamCallOutcome = 'error';

    let upstream: globalThis.Response;
    try {
      upstream = await this.attemptFetch(url, init);
    } catch (e) {
      // Network failure after all retries — counts as infrastructure failure.
      this.recordCircuitFailure();
      this.recordUpstreamMetric(
        upstreamPath,
        method,
        'error',
        Date.now() - startedAt,
        opts?.metricsOperation,
      );
      throw e;
    }

    const text = await upstream.text();
    if (!upstream.ok) {
      // 429 and 5xx that survived all retries are infrastructure failures.
      // 4xx application errors (400, 403, 404 …) are NOT infrastructure failures.
      if (upstream.status === 429 || upstream.status >= 500) {
        this.recordCircuitFailure(upstream.status);
      } else {
        this.recordCircuitSuccess();
      }
      this.recordUpstreamMetric(
        upstreamPath,
        method,
        'error',
        Date.now() - startedAt,
        opts?.metricsOperation,
      );
      let payload: unknown = text;
      try {
        payload = text ? JSON.parse(text) : { detail: text };
      } catch {
        /* keep text */
      }
      throw new HttpException(
        payload as string | Record<string, unknown>,
        upstream.status,
      );
    }

    this.recordCircuitSuccess();
    outcome = 'success';
    this.recordUpstreamMetric(
      upstreamPath,
      method,
      outcome,
      Date.now() - startedAt,
      opts?.metricsOperation,
    );
    const ct = upstream.headers.get('content-type') ?? '';
    if (ct.includes('application/json') && text) {
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return text;
      }
    }
    return text;
  }

  private recordUpstreamMetric(
    upstreamPath: string,
    method: 'GET' | 'POST',
    outcome: UpstreamCallOutcome,
    durationMs: number,
    operation?: CardhedgerUpstreamOperation,
  ): void {
    this.metrics?.recordUpstreamCall({
      upstreamPath,
      method,
      outcome,
      durationMs,
      operation,
    });
  }

  /** Binary GET (e.g. daily CSV export). */
  async forwardBinary(
    upstreamPath: string,
    opts?: { metricsOperation?: CardhedgerUpstreamOperation },
  ): Promise<{
    buffer: Buffer;
    contentType: string;
  }> {
    const key = this.getApiKey();
    if (!key) {
      throw new ServiceUnavailableException(
        'CARDHEDGER_API_KEY is not configured',
      );
    }

    const base = this.getUpstreamBase();
    const url = new URL(upstreamPath.replace(/^\//, ''), `${base}/`);

    const startedAt = Date.now();
    const upstream = await this.attemptFetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': key,
        Accept: '*/*',
      },
    });

    const buf = Buffer.from(await upstream.arrayBuffer());
    const contentType =
      upstream.headers.get('content-type') ?? 'application/octet-stream';

    if (!upstream.ok) {
      this.recordUpstreamMetric(
        upstreamPath,
        'GET',
        'error',
        Date.now() - startedAt,
        opts?.metricsOperation,
      );
      let payload: unknown = buf.toString('utf8');
      try {
        payload = JSON.parse(buf.toString('utf8'));
      } catch {
        /* */
      }
      throw new HttpException(
        payload as string | Record<string, unknown>,
        upstream.status,
      );
    }

    this.recordUpstreamMetric(
      upstreamPath,
      'GET',
      'success',
      Date.now() - startedAt,
      opts?.metricsOperation,
    );

    return { buffer: buf, contentType };
  }
}
