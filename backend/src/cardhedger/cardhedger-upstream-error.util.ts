import {
  GatewayTimeoutException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';

export const CARDHEDGER_NOT_CONFIGURED_CODE = 'CARDHEDGER_NOT_CONFIGURED';
export const CARDHEDGER_CIRCUIT_OPEN_CODE = 'CARDHEDGER_CIRCUIT_OPEN';
export const CARDHEDGER_REQUEST_TIMEOUT_CODE = 'CARDHEDGER_REQUEST_TIMEOUT';
export const CARDHEDGER_NETWORK_ERROR_CODE = 'CARDHEDGER_NETWORK_ERROR';
export const CARDHEDGER_UPSTREAM_ERROR_CODE = 'CARDHEDGER_UPSTREAM_ERROR';

function isAbortMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes('aborted') || m.includes('abort');
}

export function cardhedgerTimeoutUserMessage(timeoutMs: number): string {
  const sec = Math.round(timeoutMs / 1000);
  return (
    `Cardhedger did not respond within ${sec}s (photo OCR or catalog lookup timed out). ` +
    'Try a smaller JPEG under 10 MB, crop to the slab label, or use cert-number lookup instead.'
  );
}

export function throwCardhedgerNotConfigured(): never {
  throw new ServiceUnavailableException({
    statusCode: 503,
    code: CARDHEDGER_NOT_CONFIGURED_CODE,
    message:
      'CARDHEDGER_API_KEY is not configured on the server. Contact the operator.',
  });
}

export function throwCardhedgerCircuitOpen(): never {
  throw new ServiceUnavailableException({
    statusCode: 503,
    code: CARDHEDGER_CIRCUIT_OPEN_CODE,
    message:
      'Cardhedger is temporarily unavailable (recent upstream failures). Wait about 30 seconds and retry.',
  });
}

export function throwCardhedgerFetchFailed(
  err: unknown,
  timeoutMs: number,
): never {
  const raw =
    err instanceof Error ? err.message : err != null ? String(err) : 'unknown';
  if (isAbortMessage(raw)) {
    throw new GatewayTimeoutException({
      statusCode: 504,
      code: CARDHEDGER_REQUEST_TIMEOUT_CODE,
      message: cardhedgerTimeoutUserMessage(timeoutMs),
    });
  }
  throw new ServiceUnavailableException({
    statusCode: 503,
    code: CARDHEDGER_NETWORK_ERROR_CODE,
    message: `Could not reach Cardhedger (${raw}). Check server outbound HTTPS and CARDHEDGER_BASE_URL.`,
  });
}

function upstreamDetail(payload: unknown, fallback: string): string {
  if (typeof payload === 'string' && payload.trim()) return payload.trim();
  if (payload && typeof payload === 'object') {
    const o = payload as Record<string, unknown>;
    for (const key of ['message', 'detail', 'error']) {
      const v = o[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  return fallback;
}

/** Preserve upstream HTTP status; add a stable `code` for clients. */
export function throwCardhedgerUpstreamHttpError(
  status: number,
  payload: unknown,
): never {
  const detail = upstreamDetail(
    payload,
    `Cardhedger returned HTTP ${status}.`,
  );
  throw new HttpException(
    {
      statusCode: status,
      code: CARDHEDGER_UPSTREAM_ERROR_CODE,
      message: detail,
      upstreamStatus: status,
    },
    status,
  );
}

/** Map nested Nest errors from older logs into a short operator detail string. */
export function cardhedgerErrorCodeFromCaught(e: unknown): string | undefined {
  if (!(e instanceof HttpException)) return undefined;
  const res = e.getResponse();
  if (typeof res === 'object' && res !== null && 'code' in res) {
    const code = (res as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}
