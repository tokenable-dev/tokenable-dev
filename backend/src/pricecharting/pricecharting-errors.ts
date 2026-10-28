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

function errorBlob(err: unknown): string {
  const cause =
    err && typeof err === 'object' && 'cause' in err
      ? (err as { cause?: { code?: string; message?: string } }).cause
      : undefined;
  let message = err instanceof Error ? err.message : String(err);
  if (err instanceof HttpException) {
    const body = err.getResponse();
    if (typeof body === 'string') message = body;
    else if (body && typeof body === 'object' && 'message' in body) {
      const nested = (body as { message?: string | string[] }).message;
      message = Array.isArray(nested) ? nested.join(' ') : (nested ?? message);
    }
  }
  return `${message} ${cause?.code ?? ''} ${cause?.message ?? ''}`;
}

/** Upstream closed the socket, or its proxy died before response headers. */
export function isPricechartingConnectionReset(err: unknown): boolean {
  return /terminated|termination|before headers|upstream connect error|econnreset|socket hang up|econnrefused|etimedout/i.test(
    errorBlob(err),
  );
}

/** Transient download failure. A bad token or a 4xx is not retried. */
export function isRetryablePricechartingDownload(err: unknown): boolean {
  if (isPricechartingConnectionReset(err)) return true;
  if (!(err instanceof HttpException)) return false;
  const status = err.getStatus();
  return status === 502 || status === 503 || status === 504;
}

const FAILURE_REASON_MAX = 200;
const CAUSE_WALK_MAX = 4;

/**
 * Log text only. Removes absolute URLs (including encoded ones), query
 * strings, token and category parameters, and credential assignments.
 * Does not decide retries.
 */
export function sanitizePricechartingLogText(
  text: string,
  max = FAILURE_REASON_MAX,
): string {
  let s = text;
  s = s.replace(/https?%3A%2F%2F\S*/gi, '[redacted-url]');
  s = s.replace(/https?:\/\/\S*/gi, '[redacted-url]');
  s = s.replace(
    /\b(?:www\.)?(?:pricecharting|sportscardspro)\.com\/\S*/gi,
    '[redacted-url]',
  );
  s = s.replace(/\?[^\s"'<>]*/g, '');
  s = s.replace(/(?:^|[\s&])t=[^\s&]*/gi, ' ');
  s = s.replace(/(?:^|[\s&])category=[^\s&]*/gi, ' ');
  s = s.replace(/t%3D\S*/gi, '');
  s = s.replace(/category%3D\S*/gi, '');
  s = s.replace(
    /\b(?:cookie|set-cookie|authorization|bearer)\b\s*[:=]\s*\S+/gi,
    '[redacted-credential]',
  );
  return s.replace(/\s+/g, ' ').trim().slice(0, max);
}

function causeOf(err: unknown): unknown {
  if (!err || typeof err !== 'object' || !('cause' in err)) return undefined;
  return (err as { cause?: unknown }).cause;
}

function safeErrno(err: unknown): string {
  if (!err || typeof err !== 'object' || !('code' in err)) return '';
  const code = (err as { code?: unknown }).code;
  if (typeof code !== 'string' || !/^[A-Z][A-Z0-9_]{0,31}$/.test(code)) return '';
  return code;
}

function ownMessage(err: unknown): string {
  if (err instanceof HttpException) {
    const body = err.getResponse();
    if (typeof body === 'string') return body;
    if (body && typeof body === 'object' && 'message' in body) {
      const nested = (body as { message?: unknown }).message;
      if (typeof nested === 'string') return nested;
      if (Array.isArray(nested)) {
        return nested.filter((item) => typeof item === 'string').join(' ');
      }
    }
    return '';
  }
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return '';
}

function errorClassName(err: unknown): string {
  if (err instanceof HttpException) return 'HttpException';
  if (err instanceof Error && err.name) return err.name;
  return 'Error';
}

/** Names and messages only, bounded depth. Plain objects are not serialized. */
function causeSummaries(err: unknown): string[] {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = err;
  for (let depth = 0; depth < CAUSE_WALK_MAX; depth += 1) {
    const cause = causeOf(current);
    if (cause == null || seen.has(cause)) break;
    if (typeof cause === 'object') seen.add(cause);
    const summary =
      typeof cause === 'string'
        ? sanitizePricechartingLogText(cause, 80)
        : cause instanceof Error
          ? [cause.name || 'Error', safeErrno(cause), sanitizePricechartingLogText(cause.message, 80)]
              .filter(Boolean)
              .join(' ')
          : safeErrno(cause);
    if (summary) parts.push(`cause: ${summary}`);
    current = cause;
  }
  return parts;
}

/** AbortSignal timeout, including when Node wraps it as `fetch failed` plus a cause. */
function isAbortTimeout(err: unknown): boolean {
  if (/aborted|abort/i.test(errorBlob(err))) return true;
  const seen = new Set<unknown>();
  let current: unknown = err;
  for (let depth = 0; depth < CAUSE_WALK_MAX + 1; depth += 1) {
    if (current == null || seen.has(current)) break;
    if (typeof current === 'object') seen.add(current);
    const name =
      current instanceof Error
        ? current.name
        : current && typeof current === 'object' && 'name' in current
          ? (current as { name?: unknown }).name
          : undefined;
    if (name === 'TimeoutError') return true;
    current = causeOf(current);
  }
  return false;
}

/**
 * Log fields only. Does not decide retries.
 * An HTTP response is always `http`, even when the body text looks like a proxy reset.
 */
export function describePricechartingDownloadFailure(err: unknown): {
  kind: 'timeout' | 'connection_reset' | 'http' | 'network';
  status: number | null;
  reason: string;
} {
  const status = err instanceof HttpException ? err.getStatus() : null;
  const reason = sanitizePricechartingLogText(
    [
      `${errorClassName(err)}${status != null ? ` ${status}` : ''}: ${sanitizePricechartingLogText(ownMessage(err), 120)}`,
      ...causeSummaries(err),
    ].join('; '),
    FAILURE_REASON_MAX,
  );
  if (err instanceof HttpException) {
    return { kind: 'http', status: err.getStatus(), reason };
  }
  if (isAbortTimeout(err)) {
    return { kind: 'timeout', status: null, reason };
  }
  if (isPricechartingConnectionReset(err)) {
    return { kind: 'connection_reset', status: null, reason };
  }
  return { kind: 'network', status: null, reason };
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
  const raw = (
    err instanceof Error ? err.message : err != null ? String(err) : 'unknown'
  ).replace(/([?&]t=)[^&\s]+/gi, '$1');
  if (isPricechartingConnectionReset(err)) {
    throw new ServiceUnavailableException({
      statusCode: 503,
      code: PRICECHARTING_NETWORK_ERROR_CODE,
      message:
        'PriceCharting closed the connection while sending the CSV. Wait a few minutes and run this guide again.',
    });
  }
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
    message: `Could not reach PriceCharting (${sanitizePricechartingLogText(raw, 200)}). Check outbound HTTPS and PRICECHARTING_BASE_URL.`,
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
