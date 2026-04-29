import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ParsedPsaLabel } from './utils/psa-ocr.util';

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
  CardGrade?: string;
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

export type PsaPublicApiLookupResult =
  | { status: 'disabled'; reason: 'no_token' }
  | { status: 'skipped'; reason: 'no_cert' | 'invalid_cert' }
  | {
      status: 'success';
      certNumber: string;
      /** Full JSON body from PSA (includes PSACert, IsValidRequest, …) */
      raw: unknown;
    }
  | {
      status: 'error';
      certNumber: string;
      message: string;
      httpStatus?: number;
    };

/** GET /cert/GetImagesByCertNumber/{cert} — 슬랩 사진 URL(ImageURL, IsFrontImage 배열). */
export type PsaGetImagesLookupResult =
  | { status: 'disabled'; reason: 'no_token' }
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
    };

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

@Injectable()
export class PsaPublicApiService {
  private readonly logger = new Logger(PsaPublicApiService.name);
  private readonly baseUrl = 'https://api.psacard.com/publicapi';
  /** 성공 응답만 캐시 (동일 Cert 반복 호출·429 완화) */
  private readonly successCache = new Map<
    string,
    { expiresAt: number; result: Extract<PsaPublicApiLookupResult, { status: 'success' }> }
  >();

  constructor(private readonly config: ConfigService) {}

  /**
   * .env 에 토큰을 붙여넣을 때 줄바꿈·스페이스가 끼면 인증 실패/이상 응답이 날 수 있음 → 전부 제거
   */
  private normalizeToken(raw: string | undefined): string | undefined {
    if (!raw) return undefined;
    const compact = raw.replace(/\s+/g, '');
    return compact.length > 0 ? compact : undefined;
  }

  private getToken(): string | undefined {
    return this.normalizeToken(this.config.get<string>('PSA_PUBLIC_API_TOKEN'));
  }

  private getCacheTtlMs(): number {
    const n = this.config.get<string>('PSA_PUBLIC_API_CACHE_TTL_MS');
    const parsed = n ? parseInt(n, 10) : NaN;
    if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
    return 10 * 60 * 1000; // 10분
  }

  /** 429일 때 추가 시도 횟수 (총 호출 = 1 + 이 값). 기본 2 → 최대 3회. */
  private getMaxRetries(): number {
    const n = this.config.get<string>('PSA_PUBLIC_API_MAX_RETRIES');
    const parsed = n ? parseInt(n, 10) : NaN;
    if (!Number.isNaN(parsed) && parsed >= 0) return Math.min(parsed, 8);
    return 2;
  }

  /**
   * GET /cert/GetByCertNumber/{cert}
   * Requires PSA account token from https://www.psacard.com/publicapi
   */
  async getByCertNumber(certRaw: string | undefined): Promise<PsaPublicApiLookupResult> {
    const token = this.getToken();
    if (!token) {
      return { status: 'disabled', reason: 'no_token' };
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
      const hit = this.successCache.get(digits);
      if (hit && hit.expiresAt > Date.now()) {
        this.logger.debug(`PSA API cache hit cert=${digits}`);
        return hit.result;
      }
    }

    const url = `${this.baseUrl}/cert/GetByCertNumber/${digits}`;
    const maxRetries = this.getMaxRetries();

    try {
      let lastRes: Response | null = null;
      let lastText = '';

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            // PSA 문서 예시는 소문자 bearer
            authorization: `bearer ${token}`,
            accept: 'application/json',
            'user-agent': 'TokenableBackend/1.0 (PSA Public API)',
          },
        });

        lastRes = res;
        lastText = await res.text();

        if (res.status === 429 && attempt < maxRetries) {
          const retryAfter = res.headers.get('retry-after');
          const waitSec = retryAfter ? parseInt(retryAfter, 10) : NaN;
          const waitMs = Number.isFinite(waitSec)
            ? Math.min(Math.max(waitSec, 1), 120) * 1000
            : Math.min(1500 * 2 ** attempt, 30_000);
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
        const errBody = body as { ServerMessage?: string; message?: string };
        let message =
          errBody?.ServerMessage ||
          errBody?.message ||
          `PSA API HTTP ${res.status}`;

        if (res.status === 429) {
          message =
            'PSA API 요청 제한(HTTP 429). 재시도 후에도 실패하면 일일 한도·IP 제한일 수 있습니다. 잠시 뒤에 다시 시도하거나 psacard.com/publicapi 에서 한도를 확인하세요.';
          if (retryAfter) {
            message += ` (Retry-After: ${retryAfter}초)`;
          }
          this.logger.warn(
            `PSA API 429 final cert=${digits} retry-after=${retryAfter ?? 'n/a'}`,
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

      const success: Extract<PsaPublicApiLookupResult, { status: 'success' }> = {
        status: 'success',
        certNumber: digits,
        raw: body,
      };

      if (ttl > 0) {
        this.successCache.set(digits, {
          expiresAt: Date.now() + ttl,
          result: success,
        });
      }

      return success;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`PSA Public API request failed: ${msg}`);
      return {
        status: 'error',
        certNumber: digits,
        message: msg,
      };
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
    const token = this.getToken();
    if (!token) {
      return { status: 'disabled', reason: 'no_token' };
    }
    const digits = certRaw?.replace(/\D/g, '') ?? '';
    if (!digits) {
      return { status: 'skipped', reason: 'no_cert' };
    }
    if (digits.length < 7 || digits.length > 10) {
      return { status: 'skipped', reason: 'invalid_cert' };
    }

    const url = `${this.baseUrl}/cert/GetImagesByCertNumber/${digits}`;
    const maxRetries = this.getMaxRetries();

    try {
      let lastRes: Response | null = null;
      let lastText = '';

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            authorization: `bearer ${token}`,
            accept: 'application/json',
            'user-agent': 'TokenableBackend/1.0 (PSA Public API)',
          },
        });

        lastRes = res;
        lastText = await res.text();

        if (res.status === 429 && attempt < maxRetries) {
          const retryAfter = res.headers.get('retry-after');
          const waitSec = retryAfter ? parseInt(retryAfter, 10) : NaN;
          const waitMs = Number.isFinite(waitSec)
            ? Math.min(Math.max(waitSec, 1), 120) * 1000
            : Math.min(1500 * 2 ** attempt, 30_000);
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
            'PSA GetImages 요청 제한(HTTP 429). 잠시 뒤에 다시 시도하세요.';
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

      return {
        status: 'success',
        certNumber: digits,
        raw: body,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`PSA GetImages request failed: ${msg}`);
      return {
        status: 'error',
        certNumber: digits,
        message: msg,
      };
    }
  }
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

  const certNumber =
    c.CertNumber != null ? String(c.CertNumber).replace(/\D/g, '') : ocr.certNumber;

  let gradeLabel = ocr.gradeLabel;
  let gradeScore = ocr.gradeScore;
  if (typeof c.CardGrade === 'string' && c.CardGrade.trim()) {
    gradeLabel = c.CardGrade.trim();
    const m = c.CardGrade.match(/(\d+(?:\.\d+)?)/);
    if (m) {
      const n = parseFloat(m[1]);
      if (!Number.isNaN(n)) gradeScore = n;
    }
  }

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

  const cardNumRaw =
    (typeof c.CardNumber === 'string' && c.CardNumber.trim()
      ? c.CardNumber
      : typeof c.Variety === 'string' && c.Variety.trim()
        ? c.Variety
        : '') || '';
  const cardNumberHint = cardNumRaw
    ? cardNumRaw.replace(/^#/, '').trim()
    : ocr.cardNumberHint;

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
    typeof c.TotalPopulation === 'number' ? c.TotalPopulation : ocr.totalPopulation;

  const populationHigher =
    typeof c.PopulationHigher === 'number'
      ? c.PopulationHigher
      : ocr.populationHigher;

  const totalPopulationWithQualifier =
    typeof c.TotalPopulationWithQualifier === 'number'
      ? c.TotalPopulationWithQualifier
      : ocr.totalPopulationWithQualifier;

  const reverseBarcode =
    typeof c.ReverseBarCode === 'boolean' ? c.ReverseBarCode : ocr.reverseBarcode;

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
  };
}

