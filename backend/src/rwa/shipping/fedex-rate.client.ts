import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { requireIso2CountryCode } from './destination-country';
import {
  isRetryableFedExRateError,
  mapFedExRateError,
  mapFedExRateErrorFromResponse,
  mappedNoQuotesError,
  throwMappedFedExRateError,
} from './fedex-rate-errors';
import {
  ShippingRateClient,
  type ShippingRateQuote,
  type ShippingRateQuoteInput,
} from './shipping-rate.client';

/** Shown to buyers when Partner Origin and ship-to are both Korea. */
export const FEDEX_KR_DOMESTIC_UNSUPPORTED_MESSAGE =
  'Shipping within Korea isn’t available for Partner vault cards — FedEx can’t quote Korea → Korea. ' +
  'Ask the vault host to set their ship-from address to the United States (or another FedEx-served country), then try again.';

function envNum(
  config: ConfigService,
  key: string,
  fallback: number,
): number {
  const raw = config.get<string>(key);
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function truthy(config: ConfigService, key: string): boolean {
  const v = config.get<string>(key)?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

type TokenCache = { token: string; expiresAtMs: number };

type RateCandidate = {
  amount: number;
  serviceType: string | null;
  quoteId: string | null;
  rateType: 'ACCOUNT' | 'LIST' | 'OTHER';
};

/**
 * FedEx Rates and Transit Times API.
 * Sandbox: FEDEX_API_BASE_URL=https://apis-sandbox.fedex.com
 * When FEDEX_RATE_ENABLED is off → env stub (PARTNER_VAULT_SHIPPING_*).
 */
@Injectable()
export class FedExRateClient implements ShippingRateClient {
  readonly carrier = 'fedex' as const;
  private readonly logger = new Logger(FedExRateClient.name);
  private tokenCache: TokenCache | null = null;

  constructor(private readonly config: ConfigService) {}

  private rateEnabled(): boolean {
    return truthy(this.config, 'FEDEX_RATE_ENABLED');
  }

  private quoteExpiresAtIso(): string {
    const mins = envNum(this.config, 'FEDEX_RATE_QUOTE_TTL_MINUTES', 15);
    return new Date(Date.now() + Math.max(1, mins) * 60_000).toISOString();
  }

  async quote(input: ShippingRateQuoteInput): Promise<ShippingRateQuote> {
    const originIso = requireIso2CountryCode(
      input.origin.country,
      'origin.country',
    );
    const destIso = requireIso2CountryCode(
      input.destination.country,
      'destination.country',
    );
    assertFedExLaneSupported(originIso, destIso);

    if (!this.rateEnabled()) {
      return this.stubQuote(input);
    }
    try {
      return await this.liveQuote(input);
    } catch (e) {
      let err: unknown = e;
      if (isRetryableFedExRateError(err)) {
        this.logger.warn(
          `FedEx Rate transient failure — retrying once: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        try {
          return await this.liveQuote(input);
        } catch (e2) {
          err = e2;
        }
      }
      if (err instanceof BadRequestException) throw err;
      if (truthy(this.config, 'FEDEX_RATE_FALLBACK_STUB')) {
        this.logger.warn(
          `FedEx Rate failed — falling back to stub: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        return this.stubQuote(input);
      }
      throw err;
    }
  }

  private stubQuote(_input: ShippingRateQuoteInput): ShippingRateQuote {
    const bucket = _input.destinationBucket;
    const shippingUsd = envNum(
      this.config,
      bucket === 'us'
        ? 'PARTNER_VAULT_SHIPPING_US_USD'
        : bucket === 'ca'
          ? 'PARTNER_VAULT_SHIPPING_CA_USD'
          : 'PARTNER_VAULT_SHIPPING_INTL_USD',
      bucket === 'us' ? 12.99 : bucket === 'ca' ? 28.99 : 39.99,
    );
    return {
      shippingUsd,
      carrier: 'fedex',
      serviceType: 'STUB_GROUND',
      quoteId: null,
      rateType: null,
      source: 'fedex_stub',
      expiresAt: this.quoteExpiresAtIso(),
    };
  }

  private baseUrl(): string {
    return (
      this.config.get<string>('FEDEX_API_BASE_URL')?.trim() ||
      'https://apis-sandbox.fedex.com'
    ).replace(/\/$/, '');
  }

  private requireCreds(): {
    clientId: string;
    clientSecret: string;
    accountNumber: string;
  } {
    const clientId = this.config.get<string>('FEDEX_CLIENT_ID')?.trim() ?? '';
    const clientSecret =
      this.config.get<string>('FEDEX_CLIENT_SECRET')?.trim() ?? '';
    const accountNumber =
      this.config.get<string>('FEDEX_ACCOUNT_NUMBER')?.trim() ?? '';
    if (!clientId || !clientSecret || !accountNumber) {
      const mapped = mapFedExRateError({
        fedexCode: 'CONFIG.CREDENTIALS.MISSING',
        fedexMessage:
          'FEDEX_CLIENT_ID / FEDEX_CLIENT_SECRET / FEDEX_ACCOUNT_NUMBER incomplete',
        httpStatus: 503,
      });
      this.logger.error(
        `FedEx Rate config: code=${mapped.code} fedexCode=${mapped.fedexCode} fedexMessage=${mapped.fedexMessage}`,
      );
      throwMappedFedExRateError(mapped);
    }
    return { clientId, clientSecret, accountNumber };
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAtMs > now + 60_000) {
      return this.tokenCache.token;
    }
    const { clientId, clientSecret } = this.requireCreds();
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });
    const res = await fetch(`${this.baseUrl()}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const json = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      errors?: Array<{ message?: string; code?: string }>;
      error_description?: string;
    };
    if (!res.ok || !json.access_token) {
      const mapped = mapFedExRateErrorFromResponse({
        httpStatus: res.status,
        body: json,
      });
      // OAuth failures are always treated as config/auth unless clearly retryable.
      const authMapped =
        mapped.category === 'retryable'
          ? mapped
          : mapFedExRateError({
              fedexCode: json.errors?.[0]?.code ?? 'OAUTH.FAILED',
              fedexMessage:
                json.errors?.[0]?.message ||
                json.error_description ||
                `FedEx OAuth failed (${res.status})`,
              httpStatus: 401,
            });
      this.logger.warn(
        `FedEx OAuth failed: code=${authMapped.code} fedexCode=${authMapped.fedexCode} fedexMessage=${authMapped.fedexMessage}`,
      );
      throwMappedFedExRateError(authMapped);
    }
    const expiresInSec = Number(json.expires_in) || 3600;
    this.tokenCache = {
      token: json.access_token,
      expiresAtMs: now + expiresInSec * 1000,
    };
    return json.access_token;
  }

  private packageWeightLb(packageCount: number): number {
    const base = envNum(this.config, 'FEDEX_RATE_BASE_WEIGHT_LB', 1);
    const per = envNum(this.config, 'FEDEX_RATE_WEIGHT_PER_CARD_LB', 0.5);
    return Math.max(1, base + Math.max(1, packageCount) * per);
  }

  private buildRatePayload(
    input: ShippingRateQuoteInput,
    accountNumber: string,
  ): {
    destCountry: string;
    originCountry: string;
    payload: Record<string, unknown>;
  } {
    const destCountry = requireIso2CountryCode(
      input.destination.country,
      'destination.country',
    );
    const originCountry = requireIso2CountryCode(
      input.origin.country,
      'origin.country',
    );

    assertFedExLaneSupported(originCountry, destCountry);

    if (!input.origin.postal?.trim() || !input.destination.postal?.trim()) {
      const mapped = mapFedExRateError({
        fedexCode: 'ADDRESS.POSTAL.REQUIRED',
        fedexMessage: 'FedEx Rate requires origin and destination postal codes',
        httpStatus: 400,
        originIso: originCountry,
        destIso: destCountry,
      });
      this.logger.warn(
        `FedEx Rate missing postal: code=${mapped.code} origin=${originCountry} dest=${destCountry}`,
      );
      throwMappedFedExRateError(mapped);
    }

    const shipDate = new Date().toISOString().slice(0, 10);
    const weight = this.packageWeightLb(input.packageCount);
    const dimL = envNum(this.config, 'FEDEX_RATE_DIM_LENGTH_IN', 8);
    const dimW = envNum(this.config, 'FEDEX_RATE_DIM_WIDTH_IN', 6);
    const dimH = envNum(this.config, 'FEDEX_RATE_DIM_HEIGHT_IN', 2);

    // packagingType omitted: YOUR_PACKAGING often fails on unsupported lanes
    // (e.g. KR→KR). US→intl rates without an explicit packagingType.
    const payload = {
      accountNumber: { value: accountNumber },
      requestedShipment: {
        shipper: {
          address: buildFedExAddress(input.origin, originCountry),
        },
        recipient: {
          address: buildFedExAddress(input.destination, destCountry),
        },
        pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
        shipDateStamp: shipDate,
        rateRequestType: ['ACCOUNT', 'LIST'],
        requestedPackageLineItems: [
          {
            weight: { units: 'LB', value: weight },
            dimensions: {
              length: dimL,
              width: dimW,
              height: dimH,
              units: 'IN',
            },
          },
        ],
      },
    };

    return { destCountry, originCountry, payload };
  }

  /**
   * Swagger / admin probe: returns OAuth result, exact Rate request body,
   * raw FedEx JSON, and the quote our redeem path would pick.
   * Never returns client secret.
   */
  async probeRate(input: ShippingRateQuoteInput): Promise<{
    config: {
      rateEnabled: boolean;
      baseUrl: string;
      accountNumberSuffix: string;
      clientIdPrefix: string;
    };
    oauth: { ok: boolean; expiresInSec?: number; error?: string };
    request: Record<string, unknown> | null;
    fedexHttpStatus: number | null;
    fedexResponse: unknown;
    picked: ShippingRateQuote | null;
    softFallbackUsed: boolean;
    note: string;
  }> {
    const rateEnabled = this.rateEnabled();
    const baseUrl = this.baseUrl();
    let accountSuffix = '';
    let clientPrefix = '';
    try {
      const c = this.requireCreds();
      accountSuffix = c.accountNumber.slice(-4);
      clientPrefix = c.clientId.slice(0, 8);
    } catch {
      return {
        config: {
          rateEnabled,
          baseUrl,
          accountNumberSuffix: '',
          clientIdPrefix: '',
        },
        oauth: { ok: false, error: 'Missing FEDEX_CLIENT_ID/SECRET/ACCOUNT' },
        request: null,
        fedexHttpStatus: null,
        fedexResponse: null,
        picked: null,
        softFallbackUsed: false,
        note: 'Configure FEDEX_* in backend .env first.',
      };
    }

    if (!rateEnabled) {
      try {
        assertFedExLaneSupported(
          requireIso2CountryCode(input.origin.country, 'origin.country'),
          requireIso2CountryCode(
            input.destination.country,
            'destination.country',
          ),
        );
      } catch (e) {
        return {
          config: {
            rateEnabled: false,
            baseUrl,
            accountNumberSuffix: accountSuffix,
            clientIdPrefix: clientPrefix,
          },
          oauth: { ok: false, error: 'FEDEX_RATE_ENABLED is off' },
          request: null,
          fedexHttpStatus: null,
          fedexResponse: null,
          picked: null,
          softFallbackUsed: false,
          note: e instanceof Error ? e.message : String(e),
        };
      }
      const stub = this.stubQuote(input);
      return {
        config: {
          rateEnabled: false,
          baseUrl,
          accountNumberSuffix: accountSuffix,
          clientIdPrefix: clientPrefix,
        },
        oauth: { ok: false, error: 'FEDEX_RATE_ENABLED is off — stub only' },
        request: null,
        fedexHttpStatus: null,
        fedexResponse: null,
        picked: stub,
        softFallbackUsed: true,
        note: 'Set FEDEX_RATE_ENABLED=true to hit sandbox/production Rate API.',
      };
    }

    let token: string;
    let expiresInSec: number | undefined;
    try {
      token = await this.getAccessToken();
      expiresInSec = this.tokenCache
        ? Math.max(
            0,
            Math.round((this.tokenCache.expiresAtMs - Date.now()) / 1000),
          )
        : undefined;
    } catch (e) {
      return {
        config: {
          rateEnabled: true,
          baseUrl,
          accountNumberSuffix: accountSuffix,
          clientIdPrefix: clientPrefix,
        },
        oauth: {
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        },
        request: null,
        fedexHttpStatus: null,
        fedexResponse: null,
        picked: null,
        softFallbackUsed: false,
        note: 'OAuth failed — check API key / secret / sandbox project.',
      };
    }

    const { accountNumber } = this.requireCreds();
    let destCountry: string;
    let originCountry: string;
    let payload: Record<string, unknown>;
    try {
      const built = this.buildRatePayload(input, accountNumber);
      destCountry = built.destCountry;
      originCountry = built.originCountry;
      payload = built.payload;
    } catch (e) {
      return {
        config: {
          rateEnabled: true,
          baseUrl,
          accountNumberSuffix: accountSuffix,
          clientIdPrefix: clientPrefix,
        },
        oauth: { ok: true, expiresInSec },
        request: null,
        fedexHttpStatus: null,
        fedexResponse: null,
        picked: null,
        softFallbackUsed: false,
        note: e instanceof Error ? e.message : String(e),
      };
    }

    // KR→KR is blocked in buildRatePayload — probe never returns a stub price.

    const res = await fetch(`${baseUrl}/rate/v1/rates/quotes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-locale': 'en_US',
      },
      body: JSON.stringify(payload),
    });
    const fedexResponse = await res.json().catch(() => ({}));
    const expiresAt = this.quoteExpiresAtIso();

    let picked: ShippingRateQuote | null = null;
    let softFallbackUsed = false;
    if (res.ok) {
      const choose = pickCheapestRate(fedexResponse as Record<string, unknown>);
      if (choose) {
        picked = {
          shippingUsd: choose.amount,
          carrier: 'fedex',
          serviceType: choose.serviceType,
          quoteId: choose.quoteId,
          rateType: choose.rateType === 'OTHER' ? null : choose.rateType,
          source: 'fedex_rate',
          expiresAt,
        };
      } else if (
        shouldSoftFallbackToStub('no quotes', originCountry, destCountry)
      ) {
        picked = this.stubQuote(input);
        softFallbackUsed = true;
      }
    } else {
      const errors = (fedexResponse as { errors?: Array<{ message?: string }> })
        .errors;
      const msg = errors?.[0]?.message || `HTTP ${res.status}`;
      if (shouldSoftFallbackToStub(msg, originCountry, destCountry)) {
        picked = this.stubQuote(input);
        softFallbackUsed = true;
      }
    }

    return {
      config: {
        rateEnabled: true,
        baseUrl,
        accountNumberSuffix: accountSuffix,
        clientIdPrefix: clientPrefix,
      },
      oauth: { ok: true, expiresInSec },
      request: payload,
      fedexHttpStatus: res.status,
      fedexResponse,
      picked,
      softFallbackUsed,
      note: softFallbackUsed
        ? `FedEx lane ${originCountry}→${destCountry} unsupported or empty — stub applied (same as redeem).`
        : `Origin ${originCountry} → dest ${destCountry}. Cheapest ACCOUNT (else LIST) service selected.`,
    };
  }

  private async liveQuote(
    input: ShippingRateQuoteInput,
  ): Promise<ShippingRateQuote> {
    const { accountNumber } = this.requireCreds();
    const token = await this.getAccessToken();
    const { destCountry, originCountry, payload } = this.buildRatePayload(
      input,
      accountNumber,
    );
    // buildRatePayload already validated ISO; guard KR→KR again for clarity
    assertFedExLaneSupported(originCountry, destCountry);

    const res = await fetch(`${this.baseUrl()}/rate/v1/rates/quotes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-locale': 'en_US',
      },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!res.ok) {
      const errors = json.errors as
        | Array<{ message?: string; code?: string }>
        | undefined;
      const msg =
        errors?.[0]?.message || `FedEx Rate failed (${res.status})`;
      const mapped = mapFedExRateErrorFromResponse({
        httpStatus: res.status,
        body: json,
        originIso: originCountry,
        destIso: destCountry,
      });
      this.logger.warn(
        `FedEx Rate error origin=${originCountry} dest=${destCountry} ` +
          `code=${mapped.code} category=${mapped.category} ` +
          `fedexCode=${mapped.fedexCode} fedexMessage=${mapped.fedexMessage}`,
      );

      if (shouldSoftFallbackToStub(msg, originCountry, destCountry)) {
        // KR→KR never stubs — assertFedExLaneSupported already blocks it.
        this.logger.warn(
          `FedEx lane ${originCountry}→${destCountry} unsupported — using partner shipping stub`,
        );
        return this.stubQuote(input);
      }

      throwMappedFedExRateError(mapped);
    }

    const picked = pickCheapestRate(json);
    if (!picked) {
      if (shouldSoftFallbackToStub('no quotes', originCountry, destCountry)) {
        return this.stubQuote(input);
      }
      const mapped = mappedNoQuotesError(originCountry, destCountry);
      this.logger.warn(
        `FedEx Rate no quotes origin=${originCountry} dest=${destCountry} code=${mapped.code}`,
      );
      throwMappedFedExRateError(mapped);
    }

    return {
      shippingUsd: picked.amount,
      carrier: 'fedex',
      serviceType: picked.serviceType,
      quoteId: picked.quoteId,
      rateType: picked.rateType === 'OTHER' ? null : picked.rateType,
      source: 'fedex_rate',
      expiresAt: this.quoteExpiresAtIso(),
    };
  }
}

function buildFedExAddress(
  addr: ShippingRateQuoteInput['origin'],
  countryIso: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    postalCode: addr.postal,
    countryCode: countryIso,
    residential: Boolean(addr.residential),
  };
  if (addr.line1?.trim()) {
    out.streetLines = [addr.line1, addr.line2].filter(Boolean).slice(0, 2);
  }
  if (addr.city?.trim()) out.city = addr.city.trim();
  // FedEx expects short state codes (e.g. CA). Free-text regions break rates.
  if (
    (countryIso === 'US' || countryIso === 'CA') &&
    addr.region?.trim() &&
    /^[A-Za-z]{2}$/.test(addr.region.trim())
  ) {
    out.stateOrProvinceCode = addr.region.trim().toUpperCase();
  }
  return out;
}

/** Lanes we refuse to quote (no stub price). */
export function assertFedExLaneSupported(
  originIso: string,
  destIso: string,
): void {
  if (originIso === 'KR' && destIso === 'KR') {
    throw new BadRequestException({
      code: 'FEDEX_RATE_UNSUPPORTED_LANE',
      category: 'unsupported_lane',
      message: FEDEX_KR_DOMESTIC_UNSUPPORTED_MESSAGE,
    });
  }
}

/** Lanes FedEx sandbox/account cannot rate (common: non-US domestic) — stub only when allowed. */
function shouldSoftFallbackToStub(
  message: string,
  originIso: string,
  destIso: string,
): boolean {
  // Never stub KR→KR; that lane fails with a clear buyer message instead.
  if (originIso === 'KR' && destIso === 'KR') return false;

  const m = message.toLowerCase();
  if (
    m.includes('packaging combination') ||
    m.includes('service is not allowed') ||
    m.includes('noservice') ||
    m.includes('no service') ||
    m.includes('not supported') ||
    m.includes('unable to process') ||
    m.includes('no quotes')
  ) {
    return true;
  }
  if (originIso === destIso && originIso !== 'US' && originIso !== 'CA') {
    return true;
  }
  return false;
}

function classifyRateType(raw: unknown): RateCandidate['rateType'] {
  const s = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (s === 'ACCOUNT' || s.includes('ACCOUNT')) return 'ACCOUNT';
  if (s === 'LIST' || s.includes('LIST')) return 'LIST';
  return 'OTHER';
}

/**
 * Cheapest usable FedEx service:
 * 1) Prefer ACCOUNT priced rows when any exist.
 * 2) Else fall back to LIST (then OTHER).
 * 3) Among the preferred tier, pick lowest totalNetCharge.
 */
export function pickCheapestRate(
  json: Record<string, unknown>,
): RateCandidate | null {
  const output = json.output as Record<string, unknown> | undefined;
  const details =
    (output?.rateReplyDetails as unknown[]) ??
    (json.rateReplyDetails as unknown[]) ??
    [];
  if (!Array.isArray(details) || details.length === 0) return null;

  const cands: RateCandidate[] = [];

  for (const d of details) {
    if (!d || typeof d !== 'object') continue;
    const row = d as Record<string, unknown>;
    const serviceType =
      typeof row.serviceType === 'string' ? row.serviceType : null;
    const rated = (row.ratedShipmentDetails as unknown[]) ?? [];
    for (const r of rated) {
      if (!r || typeof r !== 'object') continue;
      const ratedRow = r as Record<string, unknown>;
      const amount = extractNetChargeUsd(ratedRow);
      if (amount == null || amount <= 0) continue;
      cands.push({
        amount: Math.round(amount * 100) / 100,
        serviceType,
        quoteId: null,
        rateType: classifyRateType(
          ratedRow.rateType ?? ratedRow.quoteType ?? ratedRow.rateTypeDetail,
        ),
      });
    }
  }

  if (cands.length === 0) return null;

  const account = cands.filter((c) => c.rateType === 'ACCOUNT');
  const list = cands.filter((c) => c.rateType === 'LIST');
  const pool =
    account.length > 0 ? account : list.length > 0 ? list : cands;

  pool.sort((a, b) => a.amount - b.amount);
  return pool[0] ?? null;
}

function extractNetChargeUsd(rated: Record<string, unknown>): number | null {
  const direct = rated.totalNetCharge;
  if (typeof direct === 'number' && Number.isFinite(direct)) return direct;
  if (direct && typeof direct === 'object') {
    const o = direct as { amount?: number | string };
    const n = Number(o.amount);
    if (Number.isFinite(n)) return n;
  }
  const detail = rated.shipmentRateDetail as
    | Record<string, unknown>
    | undefined;
  if (detail) {
    const tnc = detail.totalNetCharge;
    if (typeof tnc === 'number') return tnc;
    if (tnc && typeof tnc === 'object') {
      const n = Number((tnc as { amount?: number | string }).amount);
      if (Number.isFinite(n)) return n;
    }
    const tncWith =
      detail.totalNetFedExCharge ?? detail.totalNetChargeWithDutiesAndTaxes;
    if (typeof tncWith === 'number') return tncWith;
    if (tncWith && typeof tncWith === 'object') {
      const n = Number((tncWith as { amount?: number | string }).amount);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}
