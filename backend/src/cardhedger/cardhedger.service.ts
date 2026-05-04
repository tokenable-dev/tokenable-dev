import {
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Card Hedge upstream (`https://api.cardhedger.com`) with server-side `X-API-Key`.
 * Used by explicit Swagger-documented controllers (JSON POST/GET).
 */
@Injectable()
export class CardhedgerService {
  private readonly logger = new Logger(CardhedgerService.name);

  constructor(private readonly config: ConfigService) {}

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

  /**
   * @param upstreamPath absolute path starting with `/v1/…`
   */
  async forwardJson(
    method: 'GET' | 'POST',
    upstreamPath: string,
    opts?: {
      query?: Record<string, string | undefined>;
      body?: unknown;
    },
  ): Promise<unknown> {
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

    let upstream: globalThis.Response;
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 120_000);
    try {
      upstream = await fetch(url, { ...init, signal: ac.signal });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`Card Hedge fetch failed: ${msg}`);
      throw new ServiceUnavailableException(`Card Hedge unreachable: ${msg}`);
    } finally {
      clearTimeout(to);
    }

    const text = await upstream.text();
    if (!upstream.ok) {
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

  /** Binary GET (e.g. daily CSV export). */
  async forwardBinary(upstreamPath: string): Promise<{
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

    let upstream: globalThis.Response;
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 120_000);
    try {
      upstream = await fetch(url, {
        method: 'GET',
        headers: {
          'X-API-Key': key,
          Accept: '*/*',
        },
        signal: ac.signal,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new ServiceUnavailableException(`Card Hedge unreachable: ${msg}`);
    } finally {
      clearTimeout(to);
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    const contentType =
      upstream.headers.get('content-type') ?? 'application/octet-stream';

    if (!upstream.ok) {
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

    return { buffer: buf, contentType };
  }
}
