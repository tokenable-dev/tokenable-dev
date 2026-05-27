import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
      reason?: 'cert_mismatch';
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
      reason?: 'cert_mismatch';
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
    {
      expiresAt: number;
      result: Extract<PsaPublicApiLookupResult, { status: 'success' }>;
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

  /**
   * Extra attempts after HTTP 429 (total calls = 1 + this value).
   * Default **0** — fail fast so Vault UI is not left waiting on doomed retries.
   */
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
  ): Promise<PsaPublicApiLookupResult> {
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

    const inflight = this.inFlightGetByCert.get(digits);
    if (inflight) {
      this.logger.debug(`PSA API coalesce in-flight GetByCert cert=${digits}`);
      return inflight;
    }

    const run = this.runGetByCertNumber(digits, token).finally(() => {
      this.inFlightGetByCert.delete(digits);
    });
    this.inFlightGetByCert.set(digits, run);
    return run;
  }

  private async runGetByCertNumber(
    digits: string,
    token: string,
  ): Promise<PsaPublicApiLookupResult> {
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
        };

      const ttl = this.getCacheTtlMs();
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
