import {
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';

export const PRICECHARTING_NOT_CONFIGURED_CODE = 'PRICECHARTING_NOT_CONFIGURED';
export const PRICECHARTING_CSV_NOT_CONFIGURED_CODE =
  'PRICECHARTING_CSV_NOT_CONFIGURED';
export const PRICECHARTING_CSV_COOLDOWN_CODE = 'PRICECHARTING_CSV_COOLDOWN';
export const PRICECHARTING_REQUEST_TIMEOUT_CODE =
  'PRICECHARTING_REQUEST_TIMEOUT';
export const PRICECHARTING_NETWORK_ERROR_CODE = 'PRICECHARTING_NETWORK_ERROR';
export const PRICECHARTING_UPSTREAM_ERROR_CODE = 'PRICECHARTING_UPSTREAM_ERROR';

function isAbortMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes('aborted') || m.includes('abort');
}

export function throwPricechartingNotConfigured(): never {
  throw new ServiceUnavailableException({
    statusCode: 503,
    code: PRICECHARTING_NOT_CONFIGURED_CODE,
    message:
      'PRICECHARTING_API_TOKEN is not configured on the server. Contact the operator.',
  });
}

export function throwPricechartingCsvNotConfigured(): never {
  throw new ServiceUnavailableException({
    statusCode: 503,
    code: PRICECHARTING_CSV_NOT_CONFIGURED_CODE,
    message:
      'PRICECHARTING_CSV_URL is not configured. Paste the Legendary CSV download URL from PriceCharting Subscription → API/Download.',
  });
}

export function throwPricechartingCsvCooldown(retryAfterSec: number): never {
  throw new HttpException(
    {
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      code: PRICECHARTING_CSV_COOLDOWN_CODE,
      message: `PriceCharting CSV is limited to one download every 10 minutes. Retry in ~${retryAfterSec}s.`,
      retryAfterSec,
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

export function throwPricechartingFetchFailed(
  err: unknown,
  timeoutMs: number,
): never {
  const raw =
    err instanceof Error ? err.message : err != null ? String(err) : 'unknown';
  if (isAbortMessage(raw)) {
    throw new GatewayTimeoutException({
      statusCode: 504,
      code: PRICECHARTING_REQUEST_TIMEOUT_CODE,
      message: `PriceCharting did not respond within ${Math.round(timeoutMs / 1000)}s.`,
    });
  }
  throw new ServiceUnavailableException({
    statusCode: 503,
    code: PRICECHARTING_NETWORK_ERROR_CODE,
    message: `Could not reach PriceCharting (${raw}). Check outbound HTTPS and PRICECHARTING_BASE_URL.`,
  });
}

function upstreamDetail(payload: unknown, fallback: string): string {
  if (typeof payload === 'string' && payload.trim()) return payload.trim();
  if (payload && typeof payload === 'object') {
    const o = payload as Record<string, unknown>;
    for (const key of ['error-message', 'message', 'detail', 'error']) {
      const v = o[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  return fallback;
}

/** Preserve upstream HTTP status; add a stable `code` for clients. */
export function throwPricechartingUpstreamHttpError(
  status: number,
  payload: unknown,
): never {
  const safeStatus =
    status >= 400 && status <= 599 ? status : HttpStatus.BAD_GATEWAY;
  throw new HttpException(
    {
      statusCode: safeStatus,
      code: PRICECHARTING_UPSTREAM_ERROR_CODE,
      message: upstreamDetail(payload, `PriceCharting upstream HTTP ${status}`),
      upstream: payload,
    },
    safeStatus,
  );
}
