import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isPsaPublicApiUpstreamEnabled } from '../marketplace/utils/psa-upstream-policy.util';
import { perfNow, perfLog, elapsedMs } from '../common/perf/perf';
import type {
  PsaPublicApiDisabledResult,
} from './psa-disabled-response.util';
import type { PsaSpecPopSummary } from './psa-spec-population.util';
import {
  isCompletePsaPopByGradeMap,
  parsePsaSpecPopulationBody,
} from './psa-spec-population.util';
import { extractGrade, resolveCertHintForLookup, type ParsedPsaLabel } from './utils/psa-ocr.util';
import { psaVarietyIsCardNumberOnly } from './psa-variety-catalog.util';

/** Aligns with Swagger `PublicPSACert` (api.psacard.com/publicapi/swagger.json). */
export interface PsaCertRecord {
  CertNumber?: string | number;
  SpecID?: number;
  Subject?: string;
  /** Swagger: `Year` (some payloads may use YearIssued) */
  Year?: string | number;
  YearIssued?: string | number;
  Brand?: string;
  Variety?: string;
  CardNumber?: string;
  CardGrade?: string | number;
  GradeDescription?: string;
  LabelType?: string;
  Category?: string;
  ReverseBarCode?: boolean;
  IsDualCert?: boolean;
  AutographGrade?: string;
  TotalPopulation?: number;
  PopulationHigher?: number;
  TotalPopulationWithQualifier?: number;
  [key: string]: unknown;
}

export interface PsaUpstreamCallMeta {
  host: 'api.psacard.com';
  method: 'GET';
  path: string;
  url: string;
  httpStatus: number;
  /** Seconds from PSA HTTP `Retry-After` response header — not computed by Tokenable. */
  retryAfterSeconds: number | null;
  durationMs: number;
  /** `memory` only when `PSA_PUBLIC_API_CACHE_TTL_MS` > 0 and cache hit; otherwise live PSA HTTP. */
  servedFrom: 'none' | 'memory';
}

export type PsaPublicApiLookupResult =
  | PsaPublicApiDisabledResult
  | { status: 'skipped'; reason: 'no_cert' | 'invalid_cert' }
  | {
      status: 'success';
      certNumber: string;
      /** Full JSON body from PSA (includes PSACert, IsValidRequest, …) */
      raw: unknown;
      upstream?: PsaUpstreamCallMeta;
    }
  | {
      status: 'error';
      certNumber: string;
      message: string;
      httpStatus?: number;
      reason?: 'cert_mismatch';
      upstream?: PsaUpstreamCallMeta;
    };

/** GET /pop/GetPSASpecPopulation/{specID} — per-grade pop report for a PSA spec. */
export type { PsaSpecPopSummary } from './psa-spec-population.util';
export { parsePsaSpecPopulationBody } from './psa-spec-population.util';

export type PsaSpecPopulationLookupResult =
  | PsaPublicApiDisabledResult
  | { status: 'skipped'; reason: 'no_spec' | 'invalid_spec' }
  | {
      status: 'success';
      specId: string;
      pop: PsaSpecPopSummary;
      raw: unknown;
    }
  | {
      status: 'error';
      specId: string;
      message: string;
      httpStatus?: number;
    };

/** GET /cert/GetImagesByCertNumber/{cert} — 슬랩 사진 URL(ImageURL, IsFrontImage 배열). */
export type PsaGetImagesLookupResult =
  | PsaPublicApiDisabledResult
  | { status: 'skipped'; reason: 'no_cert' | 'invalid_cert' }
  | {
      status: 'success';
      certNumber: string;
      /** 보통 `{ ImageURL, IsFrontImage }[]` (Swagger는 object만 명시). */
      raw: unknown;
    }
  | {
      status: 'error';
      certNumber: string;
      message: string;
      httpStatus?: number;
      reason?: 'cert_mismatch';
    };

/** GET /order/GetProgress/{orderNumber} — PSA Swagger `OrderProgress`. */
export type PsaOrderProgressLookupResult =
  | PsaPublicApiDisabledResult
  | { status: 'skipped'; reason: 'no_number' }
  | {
      status: 'success';
      referenceNumber: string;
      psaPath: string;
      raw: unknown;
    }
  | {
      status: 'error';
      referenceNumber: string;
      message: string;
      httpStatus?: number;
    };

/** GET /order/GetSubmissionProgress/{submissionNumber} — same `OrderProgress` shape. */
export type PsaSubmissionProgressLookupResult = PsaOrderProgressLookupResult;

function normalizePsaReferenceNumber(raw: string | undefined): string {
  return raw?.trim().replace(/\s+/g, '') ?? '';
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

@Injectable()
export class PsaPublicApiService implements OnModuleInit {
  private readonly logger = new Logger(PsaPublicApiService.name);
  private readonly baseUrl = 'https://api.psacard.com/publicapi';
  /** 성공 응답만 캐시 (동일 Cert 반복 호출·429 완화) */
  private readonly successCache = new Map<
    string,
    {
      expiresAt: number;
      result: Extract<PsaPublicApiLookupResult, { status: 'success' }>;
    }
  >();
  private readonly imagesSuccessCache = new Map<
    string,
    {
      expiresAt: number;
      result: Extract<PsaGetImagesLookupResult, { status: 'success' }>;
    }
  >();
  /**
   * 동일 cert에 대한 동시 요청을 한 번으로 합침 (포트폴리오 민트 N개 → PSA N중복 호출 방지).
   */
  private readonly inFlightGetByCert = new Map<
    string,
    Promise<PsaPublicApiLookupResult>
  >();
  private readonly inFlightGetImages = new Map<
    string,
    Promise<PsaGetImagesLookupResult>
  >();
  private readonly specPopSuccessCache = new Map<
    string,
    {
      expiresAt: number;
      result: Extract<PsaSpecPopulationLookupResult, { status: 'success' }>;
    }
  >();
  private readonly inFlightGetSpecPop = new Map<
    string,
    Promise<PsaSpecPopulationLookupResult>
  >();

  /**
   * Multi-token pool for round-robin rotation.
   * Populated from PSA_PUBLIC_API_TOKENS (comma-separated) at startup.
   * Backward-compatible: PSA_PUBLIC_API_TOKEN (single) still works.
   * 429 handling is left to PSA — Tokenable does not locally block tokens.
   */
  private tokenPool: string[] = [];
  private tokenPoolIndex = 0;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.tokenPool = this.buildTokenPool();
    if (this.tokenPool.length === 0) {
      this.logger.warn(
        'PSA_PUBLIC_API_TOKEN / PSA_PUBLIC_API_TOKENS not set — official cert lookup disabled',
      );
      return;
    }
    if (!isPsaPublicApiUpstreamEnabled(this.config)) {
      this.logger.warn(
        'PSA Public API upstream disabled (PSA_PUBLIC_API_UPSTREAM_ENABLED≠true) — live cert lookup blocked; vault uses Cardhedger + DB cache',
      );
      return;
    }
    const suffixes = this.tokenPool.map((t) =>
      t.length >= 4 ? `…${t.slice(-4)}` : '****',
    );
    this.logger.log(
      `PSA Public API enabled (${this.tokenPool.length} token(s): [${suffixes.join(', ')}], cacheTtlMs=${this.getCacheTtlMs()}, maxRetries=${this.getMaxRetries()})`,
    );
  }

  /** Build deduped token pool from PSA_PUBLIC_API_TOKENS + PSA_PUBLIC_API_TOKEN. */
  private buildTokenPool(): string[] {
    const multi = this.config.get<string>('PSA_PUBLIC_API_TOKENS') ?? '';
    const single = this.config.get<string>('PSA_PUBLIC_API_TOKEN') ?? '';
    const raw = [
      ...multi.split(','),
      ...single.split(','),
    ];
    const seen = new Set<string>();
    const pool: string[] = [];
    for (const t of raw) {
      const norm = this.normalizeToken(t);
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        pool.push(norm);
      }
    }
    return pool;
  }

  /** Pick next token via round-robin. Returns undefined when the pool is empty. */
  private getNextToken(): string | undefined {
    if (this.tokenPool.length === 0) return undefined;
    const token = this.tokenPool[this.tokenPoolIndex % this.tokenPool.length];
    this.tokenPoolIndex = (this.tokenPoolIndex + 1) % this.tokenPool.length;
    return token;
  }

  private upstreamBlocked(): boolean {
    return !isPsaPublicApiUpstreamEnabled(this.config);
  }

  private buildDisabledResult(): PsaPublicApiDisabledResult {
    if (this.upstreamBlocked()) {
      return { status: 'disabled', reason: 'upstream_disabled' };
    }
    return { status: 'disabled', reason: 'no_token' };
  }

  private getCacheTtlMs(): number {
    const n = this.config.get<string>('PSA_PUBLIC_API_CACHE_TTL_MS');
    const parsed = n ? parseInt(n, 10) : NaN;
    if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
    return 0;
  }

  private parseRetryAfterSeconds(
    retryAfterHeader: string | null | undefined,
  ): number | null {
    const raw = retryAfterHeader?.trim();
    if (!raw) return null;
    const sec = parseInt(raw, 10);
    return Number.isFinite(sec) && sec > 0 ? sec : null;
  }

  private buildUpstreamMeta(
    digits: string,
    url: string,
    httpStatus: number,
    retryAfterHeader: string | null,
    durationMs: number,
    servedFrom: PsaUpstreamCallMeta['servedFrom'],
  ): PsaUpstreamCallMeta {
    return {
      host: 'api.psacard.com',
      method: 'GET',
      path: `/cert/GetByCertNumber/${digits}`,
      url,
      httpStatus,
      retryAfterSeconds: this.parseRetryAfterSeconds(retryAfterHeader),
      durationMs,
      servedFrom,
    };
  }

  /** Strip whitespace/newlines accidentally pasted into .env token values. */
  private normalizeToken(raw: string | undefined): string | undefined {
    if (!raw) return undefined;
    const compact = raw.replace(/\s+/g, '');
    return compact.length > 0 ? compact : undefined;
  }

  /** @deprecated Use getNextToken() for round-robin pool. Kept for backward compat checks. */
  private getToken(): string | undefined {
    return this.tokenPool[0];
  }

  private getMaxRetries(): number {
    const n = this.config.get<string>('PSA_PUBLIC_API_MAX_RETRIES');
    const parsed = n ? parseInt(n, 10) : NaN;
    if (!Number.isNaN(parsed) && parsed >= 0) return Math.min(parsed, 3);
    return 0;
  }

  /** Minimal backoff when `PSA_PUBLIC_API_MAX_RETRIES` > 0. */
  private waitMsFrom429RetryAfter(
    retryAfterHeader: string | null,
    attempt: number,
  ): number {
    const raw = retryAfterHeader?.trim();
    const sec = raw ? parseInt(raw, 10) : NaN;
    if (Number.isFinite(sec) && sec > 0) {
      const capped = Math.min(sec, 5);
      return Math.max(capped, 1) * 1000;
    }
    return Math.min(400 * (attempt + 1), 1_500);
  }

  /**
   * GET /cert/GetByCertNumber/{cert}
   * Requires PSA account token from https://www.psacard.com/publicapi
   */
  async getByCertNumber(
    certRaw: string | undefined,
    opts?: { bypassCache?: boolean },
  ): Promise<PsaPublicApiLookupResult> {
    if (this.upstreamBlocked()) {
      return this.buildDisabledResult();
    }
    const token = this.getNextToken();
    if (!token) {
      return this.buildDisabledResult();
    }
    const digits = certRaw?.replace(/\D/g, '') ?? '';
    if (!digits) {
      return { status: 'skipped', reason: 'no_cert' };
    }
    if (digits.length < 7 || digits.length > 10) {
      return { status: 'skipped', reason: 'invalid_cert' };
    }

    const bypassCache = opts?.bypassCache === true;
    const ttl = bypassCache ? 0 : this.getCacheTtlMs();
    if (ttl > 0) {
      const hit = this.successCache.get(digits);
      if (hit && hit.expiresAt > Date.now()) {
        this.logger.debug(
          `PSA API memory cache hit cert=${digits} (set PSA_PUBLIC_API_CACHE_TTL_MS=0 or bypassCache to force live upstream)`,
        );
        return hit.result;
      }
    }

    const inflight = this.inFlightGetByCert.get(digits);
    if (inflight) {
      this.logger.debug(`PSA API coalesce in-flight GetByCert cert=${digits}`);
      return inflight;
    }

    const run = this.runGetByCertNumber(digits, token, { bypassCache }).finally(() => {
      this.inFlightGetByCert.delete(digits);
    });
    this.inFlightGetByCert.set(digits, run);
    return run;
  }

  private async runGetByCertNumber(
    digits: string,
    token: string,
    opts?: { bypassCache?: boolean },
  ): Promise<PsaPublicApiLookupResult> {
    const url = `${this.baseUrl}/cert/GetByCertNumber/${digits}`;
    const maxRetries = this.getMaxRetries();
    const _t0 = perfNow();
    const cacheTtlMs = opts?.bypassCache ? 0 : this.getCacheTtlMs();

    try {
      let lastRes: Response | null = null;
      let lastText = '';

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const res = await fetch(url, {
          method: 'GET',
          signal: AbortSignal.timeout(15_000),
          headers: {
            Authorization: `Bearer ${token}`,
            accept: 'application/json',
            'user-agent': 'TokenableBackend/1.0 (PSA Public API)',
          },
        });

        lastRes = res;
        lastText = await res.text();

        if (res.status === 429 && attempt < maxRetries) {
          const retryAfter = res.headers.get('retry-after');
          const waitMs = this.waitMsFrom429RetryAfter(retryAfter, attempt);
          this.logger.warn(
            `PSA API 429 cert=${digits} attempt=${attempt + 1}/${maxRetries + 1} waitMs=${waitMs} retry-after=${retryAfter ?? 'n/a'}`,
          );
          await sleep(waitMs);
          continue;
        }

        break;
      }

      const res = lastRes;
      if (!res) {
        return {
          status: 'error',
          certNumber: digits,
          message: 'PSA API: no response',
        };
      }

      let body: unknown;
      try {
        body = lastText ? JSON.parse(lastText) : null;
      } catch {
        body = { _parseError: true, rawText: lastText.slice(0, 500) };
      }

      if (!res.ok) {
        const retryAfter = res.headers.get('retry-after');
        const durationMs = elapsedMs(_t0);
        const upstream = this.buildUpstreamMeta(
          digits,
          url,
          res.status,
          retryAfter,
          durationMs,
          'none',
        );
        const errBody = body as { ServerMessage?: string; message?: string };
        let message =
          errBody?.ServerMessage ||
          errBody?.message ||
          `PSA API HTTP ${res.status}`;

        if (res.status === 429) {
          const retrySec = upstream.retryAfterSeconds;
          message =
            'PSA upstream(api.psacard.com) HTTP 429 — rate limit or daily quota from PSA, not Tokenable.';
          if (retrySec != null) {
            message += ` Retry-After=${retrySec}초는 PSA 응답 헤더 값입니다.`;
          }
          this.logger.warn(
            `PSA upstream 429 cert=${digits} http=${res.status} retry-after-header=${retryAfter ?? 'n/a'} durationMs=${durationMs}`,
          );
        } else if (res.status === 401 || res.status === 403) {
          message =
            'PSA API 인증 실패(토큰 만료·무효·공백 오염 가능). publicapi 에서 토큰을 재발급하고 .env 에 한 줄·공백 없이 넣었는지 확인하세요.';
        }

        return {
          status: 'error',
          certNumber: digits,
          message,
          httpStatus: res.status,
          upstream,
        };
      }

      const obj = body as {
        IsValidRequest?: boolean;
        ServerMessage?: string;
      };
      if (obj?.IsValidRequest === false) {
        return {
          status: 'error',
          certNumber: digits,
          message: obj.ServerMessage ?? 'Invalid request',
          httpStatus: res.status,
        };
      }
      if (
        obj?.ServerMessage === 'No data found' ||
        /no data found/i.test(String(obj?.ServerMessage ?? ''))
      ) {
        return {
          status: 'error',
          certNumber: digits,
          message: 'No data found for cert',
          httpStatus: res.status,
        };
      }

      const returnedCert = certNumberFromPsaCertBody(body);
      if (returnedCert && returnedCert !== digits) {
        this.logger.warn(
          `PSA GetByCertNumber cert mismatch requested=${digits} PSACert.CertNumber=${returnedCert}`,
        );
        return {
          status: 'error',
          certNumber: digits,
          message: `PSA API returned cert ${returnedCert} for lookup ${digits} — cert numbers do not match`,
          httpStatus: res.status,
          reason: 'cert_mismatch',
        };
      }

      const success: Extract<PsaPublicApiLookupResult, { status: 'success' }> =
        {
          status: 'success',
          certNumber: digits,
          raw: body,
          upstream: this.buildUpstreamMeta(
            digits,
            url,
            res.status,
            res.headers.get('retry-after'),
            elapsedMs(_t0),
            'none',
          ),
        };

      if (cacheTtlMs > 0) {
        this.successCache.set(digits, {
          expiresAt: Date.now() + cacheTtlMs,
          result: success,
        });
      }

      this.logger.log(
        `PSA upstream OK cert=${digits} http=${res.status} durationMs=${success.upstream?.durationMs ?? elapsedMs(_t0)}`,
      );

      return success;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`PSA Public API request failed: ${msg}`);
      return {
        status: 'error',
        certNumber: digits,
        message: msg,
      };
    } finally {
      perfLog('psa', 'GetByCertNumber', elapsedMs(_t0), { cert: digits });
    }
  }

  /**
   * GET /cert/GetByCertNumberForFileAppend/{cert}
   * Compact cert + population payload for file/label printing integrations.
   */
  async getByCertNumberForFileAppend(
    certRaw: string | undefined,
  ): Promise<PsaPublicApiLookupResult> {
    if (this.upstreamBlocked()) {
      return this.buildDisabledResult();
    }
    const token = this.getNextToken();
    if (!token) {
      return this.buildDisabledResult();
    }
    const digits = certRaw?.replace(/\D/g, '') ?? '';
    if (!digits) {
      return { status: 'skipped', reason: 'no_cert' };
    }
    if (digits.length < 7 || digits.length > 10) {
      return { status: 'skipped', reason: 'invalid_cert' };
    }

    const cacheKey = `file-append:${digits}`;
    const ttl = this.getCacheTtlMs();
    if (ttl > 0) {
      const hit = this.successCache.get(cacheKey);
      if (hit && hit.expiresAt > Date.now()) {
        this.logger.debug(`PSA file-append cache hit cert=${digits}`);
        return hit.result;
      }
    }

    const inflightKey = `file-append:${digits}`;
    const inflight = this.inFlightGetByCert.get(inflightKey);
    if (inflight) {
      this.logger.debug(
        `PSA API coalesce in-flight GetByCertForFileAppend cert=${digits}`,
      );
      return inflight;
    }

    const run = this.runGetByCertNumberForFileAppend(digits, token).finally(
      () => {
        this.inFlightGetByCert.delete(inflightKey);
      },
    );
    this.inFlightGetByCert.set(inflightKey, run);
    return run;
  }

  private async runGetByCertNumberForFileAppend(
    digits: string,
    token: string,
  ): Promise<PsaPublicApiLookupResult> {
    const url = `${this.baseUrl}/cert/GetByCertNumberForFileAppend/${digits}`;
    const cacheKey = `file-append:${digits}`;
    const maxRetries = this.getMaxRetries();
    const _t0 = perfNow();

    try {
      let lastRes: Response | null = null;
      let lastText = '';

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const res = await fetch(url, {
          method: 'GET',
          signal: AbortSignal.timeout(15_000),
          headers: {
            Authorization: `Bearer ${token}`,
            accept: 'application/json',
            'user-agent': 'TokenableBackend/1.0 (PSA Public API)',
          },
        });

        lastRes = res;
        lastText = await res.text();

        if (res.status === 429 && attempt < maxRetries) {
          const retryAfter = res.headers.get('retry-after');
          const waitMs = this.waitMsFrom429RetryAfter(retryAfter, attempt);
          this.logger.warn(
            `PSA file-append 429 cert=${digits} attempt=${attempt + 1}/${maxRetries + 1} waitMs=${waitMs}`,
          );
          await sleep(waitMs);
          continue;
        }

        break;
      }

      const res = lastRes;
      if (!res) {
        return {
          status: 'error',
          certNumber: digits,
          message: 'PSA API: no response',
        };
      }

      let body: unknown;
      try {
        body = lastText ? JSON.parse(lastText) : null;
      } catch {
        body = { _parseError: true, rawText: lastText.slice(0, 500) };
      }

      if (!res.ok) {
        const errBody = body as { ServerMessage?: string; message?: string };
        let message =
          errBody?.ServerMessage ||
          errBody?.message ||
          `PSA API HTTP ${res.status}`;

        if (res.status === 429) {
          message =
            'PSA API 요청 제한(HTTP 429). psacard.com/publicapi 일일 한도를 확인하세요.';
          this.logger.warn(
            `PSA file-append 429 cert=${digits} retry-after=${res.headers.get('retry-after') ?? 'n/a'}`,
          );
        } else if (res.status === 401 || res.status === 403) {
          message =
            'PSA API 인증 실패(토큰 만료·무효). publicapi 에서 토큰을 재발급하세요.';
        }

        return {
          status: 'error',
          certNumber: digits,
          message,
          httpStatus: res.status,
        };
      }

      const obj = body as {
        IsValidRequest?: boolean;
        ServerMessage?: string;
      };
      if (obj?.IsValidRequest === false) {
        return {
          status: 'error',
          certNumber: digits,
          message: obj.ServerMessage ?? 'Invalid request',
          httpStatus: res.status,
        };
      }
      if (
        obj?.ServerMessage === 'No data found' ||
        /no data found/i.test(String(obj?.ServerMessage ?? ''))
      ) {
        return {
          status: 'error',
          certNumber: digits,
          message: 'No data found for cert',
          httpStatus: res.status,
        };
      }

      const returnedCert = certNumberFromPsaCertBody(body);
      if (returnedCert && returnedCert !== digits) {
        return {
          status: 'error',
          certNumber: digits,
          message: `PSA API returned cert ${returnedCert} for lookup ${digits} — cert numbers do not match`,
          httpStatus: res.status,
          reason: 'cert_mismatch',
        };
      }

      const success: Extract<PsaPublicApiLookupResult, { status: 'success' }> =
        {
          status: 'success',
          certNumber: digits,
          raw: body,
        };

      const ttl = this.getCacheTtlMs();
      if (ttl > 0) {
        this.successCache.set(cacheKey, {
          expiresAt: Date.now() + ttl,
          result: success,
        });
      }

      return success;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`PSA file-append request failed: ${msg}`);
      return {
        status: 'error',
        certNumber: digits,
        message: msg,
      };
    } finally {
      perfLog('psa', 'GetByCertNumberForFileAppend', elapsedMs(_t0), {
        cert: digits,
      });
    }
  }

  /**
   * GET /pop/GetPSASpecPopulation/{specID}
   * Returns PSA 10 count and total graded population for the card spec.
   */
  async getSpecPopulation(
    specRaw: string | number | undefined,
  ): Promise<PsaSpecPopulationLookupResult> {
    if (this.upstreamBlocked()) {
      return this.buildDisabledResult();
    }
    const token = this.getNextToken();
    if (!token) {
      return this.buildDisabledResult();
    }
    const specId = normalizePsaSpecId(specRaw);
    if (!specId) {
      return { status: 'skipped', reason: 'no_spec' };
    }

    const ttl = this.getCacheTtlMs();
    if (ttl > 0) {
      const hit = this.specPopSuccessCache.get(specId);
      if (hit && hit.expiresAt > Date.now()) {
        this.logger.debug(`PSA spec pop cache hit specId=${specId}`);
        return this.normalizeSpecPopCacheResult(hit.result);
      }
    }

    const inflight = this.inFlightGetSpecPop.get(specId);
    if (inflight) {
      this.logger.debug(`PSA spec pop coalesce in-flight specId=${specId}`);
      return inflight;
    }

    const run = this.runGetSpecPopulation(specId, token).finally(() => {
      this.inFlightGetSpecPop.delete(specId);
    });
    this.inFlightGetSpecPop.set(specId, run);
    return run;
  }

  /**
   * In-memory cache may hold pre–Grade1–10 parses (`{ total, grade10 }` only).
   * Re-parse stored `raw` when the cached breakdown is incomplete.
   */
  private normalizeSpecPopCacheResult(
    result: Extract<PsaSpecPopulationLookupResult, { status: 'success' }>,
  ): Extract<PsaSpecPopulationLookupResult, { status: 'success' }> {
    if (isCompletePsaPopByGradeMap(result.pop.byGrade)) {
      return result;
    }
    const reparsed = parsePsaSpecPopulationBody(result.raw);
    const normalized = { ...result, pop: reparsed };
    const ttl = this.getCacheTtlMs();
    if (ttl > 0 && isCompletePsaPopByGradeMap(reparsed.byGrade)) {
      this.specPopSuccessCache.set(result.specId, {
        expiresAt: Date.now() + ttl,
        result: normalized,
      });
    }
    return normalized;
  }

  private async runGetSpecPopulation(
    specId: string,
    token: string,
  ): Promise<PsaSpecPopulationLookupResult> {
    const url = `${this.baseUrl}/pop/GetPSASpecPopulation/${specId}`;
    const maxRetries = this.getMaxRetries();
    const _t0 = perfNow();

    try {
      let lastRes: Response | null = null;
      let lastText = '';

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const res = await fetch(url, {
          method: 'GET',
          signal: AbortSignal.timeout(15_000),
          headers: {
            Authorization: `Bearer ${token}`,
            accept: 'application/json',
            'user-agent': 'TokenableBackend/1.0 (PSA Public API)',
          },
        });

        lastRes = res;
        lastText = await res.text();

        if (res.status === 429 && attempt < maxRetries) {
          const retryAfter = res.headers.get('retry-after');
          const waitMs = this.waitMsFrom429RetryAfter(retryAfter, attempt);
          this.logger.warn(
            `PSA spec pop 429 specId=${specId} attempt=${attempt + 1}/${maxRetries + 1} waitMs=${waitMs}`,
          );
          await sleep(waitMs);
          continue;
        }

        break;
      }

      const res = lastRes;
      if (!res) {
        return {
          status: 'error',
          specId,
          message: 'PSA API: no response',
        };
      }

      let body: unknown;
      try {
        body = lastText ? JSON.parse(lastText) : null;
      } catch {
        body = { _parseError: true, rawText: lastText.slice(0, 500) };
      }

      if (!res.ok) {
        const errBody = body as { ServerMessage?: string; message?: string };
        let message =
          errBody?.ServerMessage ||
          errBody?.message ||
          `PSA API HTTP ${res.status}`;
        if (res.status === 401 || res.status === 403) {
          message =
            'PSA API 인증 실패(토큰 만료·무효). publicapi 에서 토큰을 재발급하세요.';
        }
        return {
          status: 'error',
          specId,
          message,
          httpStatus: res.status,
        };
      }

      const pop = parsePsaSpecPopulationBody(body);
      const success: Extract<
        PsaSpecPopulationLookupResult,
        { status: 'success' }
      > = {
        status: 'success',
        specId,
        pop,
        raw: body,
      };

      const ttl = this.getCacheTtlMs();
      if (ttl > 0) {
        this.specPopSuccessCache.set(specId, {
          expiresAt: Date.now() + ttl,
          result: success,
        });
      }

      return success;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`PSA spec pop request failed specId=${specId}: ${msg}`);
      return {
        status: 'error',
        specId,
        message: msg,
      };
    } finally {
      perfLog('psa', 'GetSpecPopulation', elapsedMs(_t0), { specId });
    }
  }

  /**
   * GET /cert/GetImagesByCertNumber/{cert}
   * 응답은 보통 `[{ ImageURL, IsFrontImage }, …]` 형태 (공개 예시: brad-newman/fetch-psa-api).
   * `cert-images.psa.com` 호스트는 DNS에서 더 이상 존재하지 않으므로, 슬랩 이미지는 이 API로 가져온다.
   */
  async getImagesByCertNumber(
    certRaw: string | undefined,
  ): Promise<PsaGetImagesLookupResult> {
    if (this.upstreamBlocked()) {
      return this.buildDisabledResult();
    }
    const token = this.getNextToken();
    if (!token) {
      return this.buildDisabledResult();
    }
    const digits = certRaw?.replace(/\D/g, '') ?? '';
    if (!digits) {
      return { status: 'skipped', reason: 'no_cert' };
    }
    if (digits.length < 7 || digits.length > 10) {
      return { status: 'skipped', reason: 'invalid_cert' };
    }

    const ttl = this.getCacheTtlMs();
    if (ttl > 0) {
      const hit = this.imagesSuccessCache.get(digits);
      if (hit && hit.expiresAt > Date.now()) {
        this.logger.debug(`PSA GetImages cache hit cert=${digits}`);
        return hit.result;
      }
    }

    const inflight = this.inFlightGetImages.get(digits);
    if (inflight) {
      this.logger.debug(
        `PSA GetImages coalesce in-flight cert=${digits}`,
      );
      return inflight;
    }

    const run = this.runGetImagesByCertNumber(digits, token).finally(() => {
      this.inFlightGetImages.delete(digits);
    });
    this.inFlightGetImages.set(digits, run);
    return run;
  }

  private async runGetImagesByCertNumber(
    digits: string,
    token: string,
  ): Promise<PsaGetImagesLookupResult> {
    const url = `${this.baseUrl}/cert/GetImagesByCertNumber/${digits}`;
    const maxRetries = this.getMaxRetries();
    const _t0 = perfNow();

    try {
      let lastRes: Response | null = null;
      let lastText = '';

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const res = await fetch(url, {
          method: 'GET',
          signal: AbortSignal.timeout(15_000),
          headers: {
            Authorization: `Bearer ${token}`,
            accept: 'application/json',
            'user-agent': 'TokenableBackend/1.0 (PSA Public API)',
          },
        });

        lastRes = res;
        lastText = await res.text();

        if (res.status === 429 && attempt < maxRetries) {
          const retryAfter = res.headers.get('retry-after');
          const waitMs = this.waitMsFrom429RetryAfter(retryAfter, attempt);
          this.logger.warn(
            `PSA GetImages 429 cert=${digits} attempt=${attempt + 1}/${maxRetries + 1} waitMs=${waitMs} retry-after=${retryAfter ?? 'n/a'}`,
          );
          await sleep(waitMs);
          continue;
        }

        break;
      }

      const res = lastRes;
      if (!res) {
        return {
          status: 'error',
          certNumber: digits,
          message: 'PSA GetImages: no response',
        };
      }

      let body: unknown;
      try {
        body = lastText ? JSON.parse(lastText) : null;
      } catch {
        body = { _parseError: true, rawText: lastText.slice(0, 500) };
      }

      if (typeof body === 'string') {
        return {
          status: 'error',
          certNumber: digits,
          message: body,
          httpStatus: res.status,
        };
      }

      if (!res.ok) {
        const errBody = body as { ServerMessage?: string; message?: string };
        let message =
          errBody?.ServerMessage ||
          errBody?.message ||
          `PSA GetImages HTTP ${res.status}`;

        if (res.status === 429) {
          message =
            'PSA GetImages 요청 제한(HTTP 429). GetByCertNumber 본문에 이미지 URL이 있으면 GetImages를 건너뜁니다.';
          this.logger.warn(
            `PSA GetImages 429 final cert=${digits} retry-after=${res.headers.get('retry-after') ?? 'n/a'}`,
          );
        } else if (res.status === 401 || res.status === 403) {
          message =
            'PSA GetImages 인증 실패(토큰 만료·무효 가능). publicapi 토큰을 확인하세요.';
        }

        return {
          status: 'error',
          certNumber: digits,
          message,
          httpStatus: res.status,
        };
      }

      const obj = body as { IsValidRequest?: boolean; ServerMessage?: string };
      if (obj?.IsValidRequest === false) {
        return {
          status: 'error',
          certNumber: digits,
          message: obj.ServerMessage ?? 'Invalid request',
          httpStatus: res.status,
        };
      }
      if (
        obj?.ServerMessage === 'No data found' ||
        /no data found/i.test(String(obj?.ServerMessage ?? ''))
      ) {
        return {
          status: 'error',
          certNumber: digits,
          message: 'No data found for cert',
          httpStatus: res.status,
        };
      }

      const success: Extract<PsaGetImagesLookupResult, { status: 'success' }> =
        {
          status: 'success',
          certNumber: digits,
          raw: body,
        };

      const ttl = this.getCacheTtlMs();
      if (ttl > 0) {
        this.imagesSuccessCache.set(digits, {
          expiresAt: Date.now() + ttl,
          result: success,
        });
      }

      return success;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`PSA GetImages request failed: ${msg}`);
      return {
        status: 'error',
        certNumber: digits,
        message: msg,
      };
    } finally {
      perfLog('psa', 'GetImagesByCertNumber', elapsedMs(_t0), { cert: digits });
    }
  }

  /**
   * GET /order/GetProgress/{orderNumber}
   * PSA account order progress (no per-item cert list in public schema).
   */
  async getOrderProgress(
    orderNumberRaw: string | undefined,
  ): Promise<PsaOrderProgressLookupResult> {
    const referenceNumber = normalizePsaReferenceNumber(orderNumberRaw);
    if (!referenceNumber) {
      return { status: 'skipped', reason: 'no_number' };
    }
    const psaPath = `/order/GetProgress/${encodeURIComponent(referenceNumber)}`;
    return this.runOrderProgressLookup(referenceNumber, psaPath, 'order');
  }

  /**
   * GET /order/GetSubmissionProgress/{submissionNumber}
   */
  async getSubmissionProgress(
    submissionNumberRaw: string | undefined,
  ): Promise<PsaSubmissionProgressLookupResult> {
    const referenceNumber = normalizePsaReferenceNumber(submissionNumberRaw);
    if (!referenceNumber) {
      return { status: 'skipped', reason: 'no_number' };
    }
    const psaPath = `/order/GetSubmissionProgress/${encodeURIComponent(referenceNumber)}`;
    return this.runOrderProgressLookup(referenceNumber, psaPath, 'submission');
  }

  private async runOrderProgressLookup(
    referenceNumber: string,
    psaPath: string,
    kind: 'order' | 'submission',
  ): Promise<PsaOrderProgressLookupResult> {
    if (this.upstreamBlocked()) {
      return this.buildDisabledResult();
    }
    const token = this.getNextToken();
    if (!token) {
      return this.buildDisabledResult();
    }

    const url = `${this.baseUrl}${psaPath}`;
    const maxRetries = this.getMaxRetries();
    const _t0 = perfNow();

    try {
      let lastRes: Response | null = null;
      let lastText = '';

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const res = await fetch(url, {
          method: 'GET',
          signal: AbortSignal.timeout(15_000),
          headers: {
            Authorization: `Bearer ${token}`,
            accept: 'application/json',
            'user-agent': 'TokenableBackend/1.0 (PSA Public API)',
          },
        });

        lastRes = res;
        lastText = await res.text();

        if (res.status === 429 && attempt < maxRetries) {
          const retryAfter = res.headers.get('retry-after');
          const waitMs = this.waitMsFrom429RetryAfter(retryAfter, attempt);
          this.logger.warn(
            `PSA ${kind} progress 429 ref=${referenceNumber} attempt=${attempt + 1}/${maxRetries + 1} waitMs=${waitMs}`,
          );
          await sleep(waitMs);
          continue;
        }

        break;
      }

      const res = lastRes;
      if (!res) {
        return {
          status: 'error',
          referenceNumber,
          message: 'PSA API: no response',
        };
      }

      let body: unknown;
      try {
        body = lastText ? JSON.parse(lastText) : null;
      } catch {
        body = { _parseError: true, rawText: lastText.slice(0, 500) };
      }

      if (!res.ok) {
        const errBody = body as { ServerMessage?: string; message?: string };
        let message =
          errBody?.ServerMessage ||
          errBody?.message ||
          `PSA API HTTP ${res.status}`;

        if (res.status === 429) {
          message =
            'PSA API 요청 제한(HTTP 429). psacard.com/publicapi 일일 한도를 확인하세요.';
        } else if (res.status === 401 || res.status === 403) {
          message =
            'PSA API 인증 실패(토큰 만료·무효). publicapi 에서 토큰을 재발급하세요.';
        }

        return {
          status: 'error',
          referenceNumber,
          message,
          httpStatus: res.status,
        };
      }

      const obj = body as {
        IsValidRequest?: boolean;
        ServerMessage?: string;
      };
      if (obj?.IsValidRequest === false) {
        return {
          status: 'error',
          referenceNumber,
          message: obj.ServerMessage ?? 'Invalid request',
          httpStatus: res.status,
        };
      }
      if (
        obj?.ServerMessage === 'No data found' ||
        /no data found/i.test(String(obj?.ServerMessage ?? ''))
      ) {
        return {
          status: 'error',
          referenceNumber,
          message: 'No data found for order/submission number',
          httpStatus: res.status,
        };
      }

      return {
        status: 'success',
        referenceNumber,
        psaPath,
        raw: body,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`PSA ${kind} progress request failed: ${msg}`);
      return {
        status: 'error',
        referenceNumber,
        message: msg,
      };
    } finally {
      perfLog('psa', 'OrderProgressLookup', elapsedMs(_t0), { referenceNumber, kind });
    }
  }
}

/** Normalized digits from `PSACert.CertNumber` when present. */
export function certNumberFromPsaCertBody(body: unknown): string | undefined {
  const root = body as { PSACert?: PsaCertRecord };
  const c = root?.PSACert;
  if (!c || typeof c !== 'object') return undefined;
  if (c.CertNumber == null) return undefined;
  const digits = String(c.CertNumber).replace(/\D/g, '');
  return digits.length > 0 ? digits : undefined;
}

/**
 * `GetByCertNumber` 등 응답 JSON에서 `PSACert.SpecID`만 뽑는다 (커버 이미지용).
 */
export function specIdStringFromPsaCertBody(body: unknown): string | undefined {
  const root = body as { PSACert?: Record<string, unknown> };
  const c = root?.PSACert;
  if (!c || typeof c !== 'object') return undefined;
  const raw = c.SpecID ?? c.specId ?? c.spec_id;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return String(Math.floor(raw));
  }
  if (typeof raw === 'string' && raw.trim()) {
    const n = parseInt(raw.trim(), 10);
    if (!Number.isNaN(n)) return String(Math.floor(n));
    return raw.trim();
  }
  return undefined;
}

/** PSA `PSACert.CardGrade` / `GradeDescription` → numeric grade for mint form. */
export function parseGradeFromPsaCertRecord(
  c: PsaCertRecord,
): { label?: string; score?: number } {
  const rawGrade =
    typeof c.CardGrade === 'string'
      ? c.CardGrade.trim()
      : typeof c.CardGrade === 'number' && Number.isFinite(c.CardGrade)
        ? String(c.CardGrade)
        : '';
  if (rawGrade) {
    const fromNumeric = rawGrade.match(/^(\d+(?:\.\d+)?)$/);
    if (fromNumeric) {
      const n = parseFloat(fromNumeric[1]);
      if (!Number.isNaN(n)) {
        return { label: rawGrade, score: n };
      }
    }
    const parsed = extractGrade(rawGrade);
    if (parsed.score != null || parsed.label) {
      return parsed;
    }
  }
  const desc =
    typeof c.GradeDescription === 'string' ? c.GradeDescription.trim() : '';
  if (desc) {
    return extractGrade(desc);
  }
  return {};
}

/** Map PSA PSACert object into our ParsedPsaLabel fields (API overrides noisy OCR). */
export function mergePsaApiIntoParsed(
  ocr: ParsedPsaLabel,
  apiBody: unknown,
): ParsedPsaLabel {
  try {
    return mergePsaApiIntoParsedImpl(ocr, apiBody);
  } catch {
    return ocr;
  }
}

function mergePsaApiIntoParsedImpl(
  ocr: ParsedPsaLabel,
  apiBody: unknown,
): ParsedPsaLabel {
  const root = apiBody as { PSACert?: PsaCertRecord };
  const c = root?.PSACert;
  if (!c || typeof c !== 'object') {
    return ocr;
  }

  const fromApi = certNumberFromPsaCertBody(apiBody);
  const requestedCert = resolveCertHintForLookup(ocr.certNumber);
  const certNumber =
    requestedCert && fromApi && fromApi !== requestedCert
      ? requestedCert
      : fromApi ?? requestedCert ?? ocr.certNumber;

  let gradeLabel = ocr.gradeLabel;
  let gradeScore = ocr.gradeScore;
  const parsedGrade = parseGradeFromPsaCertRecord(c);
  if (parsedGrade.label) gradeLabel = parsedGrade.label;
  if (parsedGrade.score != null) gradeScore = parsedGrade.score;

  const yearRaw = c.Year ?? c.YearIssued;
  const year =
    yearRaw != null
      ? String(yearRaw).replace(/\D/g, '').slice(0, 4) || ocr.year
      : ocr.year;

  const cardNameHint =
    typeof c.Subject === 'string' && c.Subject.trim()
      ? c.Subject.trim()
      : ocr.cardNameHint;

  const brandRaw =
    typeof c.Brand === 'string' && c.Brand.trim() ? c.Brand.trim() : '';
  const brandIsGeneric = /^(pok[eé]mon|tcg|trading\s+card(s)?)$/i.test(
    brandRaw,
  );
  const setHint = brandRaw && !brandIsGeneric ? brandRaw : ocr.setHint;

  const cardNumberFromCert =
    typeof c.CardNumber === 'string' && c.CardNumber.trim()
      ? c.CardNumber.replace(/^#/, '').trim()
      : '';
  const varietyFromCert =
    typeof c.Variety === 'string' && c.Variety.trim()
      ? c.Variety.trim()
      : '';

  /** When CardNumber is empty, PSA sometimes puts the # only in Variety. */
  const varietyLooksLikeCardNumberOnly =
    varietyFromCert.length > 0 &&
    psaVarietyIsCardNumberOnly(varietyFromCert);

  const cardNumberHint = cardNumberFromCert
    ? cardNumberFromCert
    : varietyLooksLikeCardNumberOnly
      ? varietyFromCert.replace(/^#/, '').trim()
      : ocr.cardNumberHint;

  const varietyHint =
    varietyFromCert && !varietyLooksLikeCardNumberOnly
      ? varietyFromCert
      : ocr.varietyHint;

  const gradeDescription =
    typeof c.GradeDescription === 'string' && c.GradeDescription.trim()
      ? c.GradeDescription.trim()
      : ocr.gradeDescription;

  const labelType =
    typeof c.LabelType === 'string' && c.LabelType.trim()
      ? c.LabelType.trim()
      : ocr.labelType;

  const category =
    typeof c.Category === 'string' && c.Category.trim()
      ? c.Category.trim()
      : ocr.category;

  const autographGrade =
    typeof c.AutographGrade === 'string' && c.AutographGrade.trim()
      ? c.AutographGrade.trim()
      : ocr.autographGrade;

  const totalPopulation =
    typeof c.TotalPopulation === 'number'
      ? c.TotalPopulation
      : ocr.totalPopulation;

  const populationHigher =
    typeof c.PopulationHigher === 'number'
      ? c.PopulationHigher
      : ocr.populationHigher;

  const totalPopulationWithQualifier =
    typeof c.TotalPopulationWithQualifier === 'number'
      ? c.TotalPopulationWithQualifier
      : ocr.totalPopulationWithQualifier;

  const reverseBarcode =
    typeof c.ReverseBarCode === 'boolean'
      ? c.ReverseBarCode
      : ocr.reverseBarcode;

  const specId = typeof c.SpecID === 'number' ? c.SpecID : ocr.specId;

  return {
    ...ocr,
    certNumber: certNumber || ocr.certNumber,
    gradeLabel,
    gradeScore,
    gradeDescription,
    year,
    cardNameHint,
    cardNumberHint,
    setHint,
    labelType,
    category,
    autographGrade,
    totalPopulation,
    populationHigher,
    totalPopulationWithQualifier,
    reverseBarcode,
    specId,
    varietyHint,
  };
}

export function normalizePsaSpecId(raw: unknown): string | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return String(Math.floor(raw));
  }
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (/^\d+$/.test(t)) return t;
  }
  return null;
}
