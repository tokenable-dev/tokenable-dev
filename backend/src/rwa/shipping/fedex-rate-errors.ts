import {
  BadRequestException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';

/**
 * Stable codes returned to clients (buyers / admin UI).
 * Raw FedEx codes stay in server logs only.
 */
export type FedExRateErrorCode =
  | 'FEDEX_RATE_RETRYABLE'
  | 'FEDEX_RATE_INVALID_ADDRESS'
  | 'FEDEX_RATE_UNSUPPORTED_LANE'
  | 'FEDEX_RATE_CONFIG'
  | 'FEDEX_RATE_UNKNOWN'
  | 'FEDEX_RATE_NO_QUOTES';

export type FedExRateErrorCategory =
  | 'retryable'
  | 'invalid_address'
  | 'unsupported_lane'
  | 'auth_config'
  | 'unknown';

export type FedExMappedRateError = {
  code: FedExRateErrorCode;
  category: FedExRateErrorCategory;
  /** Buyer-facing English copy */
  message: string;
  /** Original FedEx `errors[].code` when present */
  fedexCode: string | null;
  /** Original FedEx `errors[].message` when present */
  fedexMessage: string | null;
  httpStatus: number;
};

type FedExErrorItem = {
  code?: string;
  message?: string;
};

const BUYER = {
  retryable:
    'Shipping rates are temporarily unavailable from the carrier. Please try Calculate again in a moment.',
  invalidAddress:
    'We couldn’t get a shipping rate for this address. Check the destination city, postal code, and region, then try again.',
  unsupportedLane:
    'FedEx can’t quote shipping for this origin and destination. Try a different ship-to country, or ask the vault host to update their ship-from address.',
  config:
    'Partner shipping is temporarily misconfigured. Please try again later or contact support.',
  unknown:
    'We couldn’t calculate Partner vault shipping right now. Please try again, or contact support if it keeps happening.',
  noQuotes:
    'No FedEx shipping rates are available for this route with the current package details. Try again later or contact support.',
} as const;

/** Normalize FedEx error code for matching (dots/underscores/case). */
function normCode(raw: string | null | undefined): string {
  return (raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[_\s]+/g, '.');
}

function normMsg(raw: string | null | undefined): string {
  return (raw ?? '').trim().toLowerCase();
}

/**
 * Classify a FedEx Rate API error into a stable internal code.
 * Prefer explicit FedEx `code`; fall back to message heuristics and HTTP status.
 */
export function mapFedExRateError(input: {
  fedexCode?: string | null;
  fedexMessage?: string | null;
  httpStatus?: number | null;
  originIso?: string | null;
  destIso?: string | null;
}): FedExMappedRateError {
  const fedexCode = input.fedexCode?.trim() || null;
  const fedexMessage = input.fedexMessage?.trim() || null;
  const code = normCode(fedexCode);
  const msg = normMsg(fedexMessage);
  const status = input.httpStatus ?? 0;

  const laneHint =
    input.originIso && input.destIso
      ? ` (${input.originIso}→${input.destIso})`
      : '';

  // --- Auth / configuration -------------------------------------------------
  if (
    code.includes('UNAUTHORIZED') ||
    code.includes('NOTAUTHORIZED') ||
    code.includes('NOT.AUTHORIZED') ||
    code.includes('AUTHENTICATION') ||
    code.includes('AUTH.') ||
    code.includes('TOKEN') ||
    code.includes('CLIENT.ID') ||
    code.includes('CLIENT.SECRET') ||
    code.includes('ACCOUNTNUMBER') ||
    code.includes('ACCOUNT.NUMBER') ||
    code === 'NOT.FOUND' && msg.includes('account') ||
    msg.includes('oauth') ||
    msg.includes('access_token') ||
    msg.includes('invalid client') ||
    (status === 401 || status === 403)
  ) {
    return {
      code: 'FEDEX_RATE_CONFIG',
      category: 'auth_config',
      message: BUYER.config,
      fedexCode,
      fedexMessage,
      httpStatus: 503,
    };
  }

  // --- Retryable (temporary FedEx / network) --------------------------------
  if (
    code.includes('SYSTEM.UNEXPECTED') ||
    code.includes('SYSTEM.UNKNOWN') ||
    code.includes('SERVICE.UNAVAILABLE') ||
    code.includes('INTERNAL.SERVER') ||
    code.includes('GATEWAY') ||
    code.includes('TIMEOUT') ||
    code.includes('RATE.LIMIT') ||
    code.includes('TOO.MANY') ||
    code.includes('TEMPORARY') ||
    msg.includes('unexpected problem') ||
    msg.includes('currently unavailable') ||
    msg.includes('try again later') ||
    msg.includes('check back') ||
    msg.includes('general failure') ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    status === 429
  ) {
    return {
      code: 'FEDEX_RATE_RETRYABLE',
      category: 'retryable',
      message: BUYER.retryable,
      fedexCode,
      fedexMessage,
      httpStatus: 503,
    };
  }

  // --- Invalid destination / address ----------------------------------------
  if (
    code.includes('ZIPCODE') ||
    code.includes('POSTAL') ||
    code.includes('CITY.STATE') ||
    code.includes('STATEORPROVINCE') ||
    code.includes('STATE.OR.PROVINCE') ||
    code.includes('ADDRESS.') ||
    code.includes('RECIPIENT.ADDRESS') ||
    code.includes('SHIPPER.ADDRESS') ||
    code.includes('COUNTRYCODE') ||
    code.includes('COUNTRY.CODE') ||
    code.includes('NOTFOUND') &&
      (msg.includes('postal') ||
        msg.includes('zip') ||
        msg.includes('state') ||
        msg.includes('province') ||
        msg.includes('city')) ||
    msg.includes('postal code') ||
    msg.includes('zip or postal') ||
    msg.includes('state or province') ||
    msg.includes('address is invalid') ||
    msg.includes('invalid address') ||
    msg.includes('city name is missing')
  ) {
    return {
      code: 'FEDEX_RATE_INVALID_ADDRESS',
      category: 'invalid_address',
      message: BUYER.invalidAddress,
      fedexCode,
      fedexMessage,
      httpStatus: 400,
    };
  }

  // --- Unsupported service / lane -------------------------------------------
  if (
    code.includes('SERVICETYPE') ||
    code.includes('SERVICE.TYPE') ||
    code.includes('UNSUPPORTED') ||
    code.includes('PACKAGING') ||
    code.includes('NOSERVICE') ||
    code.includes('NO.SERVICE') ||
    code.includes('SERVICENOTALLOWED') ||
    msg.includes('packaging combination') ||
    msg.includes('service is not allowed') ||
    msg.includes('service type is not supported') ||
    msg.includes('no service') ||
    msg.includes('not supported') ||
    msg.includes('unable to process')
  ) {
    return {
      code: 'FEDEX_RATE_UNSUPPORTED_LANE',
      category: 'unsupported_lane',
      message: BUYER.unsupportedLane + laneHint,
      fedexCode,
      fedexMessage,
      httpStatus: 400,
    };
  }

  // HTTP 400 with unclear FedEx body — treat as address/input until proven otherwise
  if (status === 400) {
    return {
      code: 'FEDEX_RATE_INVALID_ADDRESS',
      category: 'invalid_address',
      message: BUYER.invalidAddress,
      fedexCode,
      fedexMessage,
      httpStatus: 400,
    };
  }

  return {
    code: 'FEDEX_RATE_UNKNOWN',
    category: 'unknown',
    message: BUYER.unknown,
    fedexCode,
    fedexMessage,
    httpStatus: 503,
  };
}

export function mapFedExRateErrorFromResponse(input: {
  httpStatus: number;
  body: unknown;
  originIso?: string;
  destIso?: string;
}): FedExMappedRateError {
  const errors = (input.body as { errors?: FedExErrorItem[] } | null)?.errors;
  const first = Array.isArray(errors) ? errors[0] : undefined;
  return mapFedExRateError({
    fedexCode: first?.code,
    fedexMessage:
      first?.message ||
      (typeof input.body === 'object' &&
      input.body &&
      'error_description' in input.body
        ? String((input.body as { error_description?: string }).error_description)
        : null) ||
      `FedEx Rate failed (${input.httpStatus})`,
    httpStatus: input.httpStatus,
    originIso: input.originIso,
    destIso: input.destIso,
  });
}

/** Nest exception whose JSON `message` is `{ code, category, message }`. */
export function throwMappedFedExRateError(
  mapped: FedExMappedRateError,
): never {
  const body = {
    code: mapped.code,
    category: mapped.category,
    message: mapped.message,
  };
  if (mapped.httpStatus === 400) {
    throw new BadRequestException(body);
  }
  throw new ServiceUnavailableException(body);
}

export function mappedNoQuotesError(
  originIso?: string,
  destIso?: string,
): FedExMappedRateError {
  const lane =
    originIso && destIso ? ` (${originIso}→${destIso})` : '';
  return {
    code: 'FEDEX_RATE_NO_QUOTES',
    category: 'unsupported_lane',
    message: BUYER.noQuotes + lane,
    fedexCode: null,
    fedexMessage: null,
    httpStatus: 503,
  };
}

export function isMappedFedExHttpException(e: unknown): boolean {
  if (!(e instanceof HttpException)) return false;
  const res = e.getResponse();
  if (!res || typeof res !== 'object') return false;
  const code = (res as { code?: string }).code;
  return typeof code === 'string' && code.startsWith('FEDEX_RATE_');
}
