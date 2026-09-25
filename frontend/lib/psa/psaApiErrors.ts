/** Mirrors backend `PSA_RATE_LIMIT_CODE`. */
export const PSA_RATE_LIMIT_CODE = "PSA_RATE_LIMIT_EXCEEDED";

/** Shown in Sell flow when PSA Public API returns 429. */
export const PSA_RATE_LIMIT_ALERT_MESSAGE =
  "PSA Public API quota or rate limit reached. Wait for the daily reset or check your plan at psacard.com/publicapi. After changing backend/.env, restart the backend server.";

export class PsaApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "PsaApiError";
    this.status = status;
    this.code = code;
  }
}

type PsaErrorBody = {
  message?: string | string[];
  code?: string;
  statusCode?: number;
};

export function isPsaRateLimitError(err: unknown): boolean {
  if (err instanceof PsaApiError) {
    return err.status === 429 || err.code === PSA_RATE_LIMIT_CODE;
  }
  if (err instanceof Error) {
    return (
      /PSA_RATE_LIMIT_EXCEEDED/i.test(err.message) ||
      /\b429\b/.test(err.message) ||
      /rate limit|quota|요청 제한|free public api lookup quota/i.test(err.message)
    );
  }
  return false;
}

const CARDHEDGER_CLIENT_CODES = new Set([
  "CARDHEDGER_REQUEST_TIMEOUT",
  "CARDHEDGER_CIRCUIT_OPEN",
  "CARDHEDGER_NOT_CONFIGURED",
  "CARDHEDGER_NETWORK_ERROR",
  "CARDHEDGER_UPSTREAM_ERROR",
  "PSA_SLAB_IMAGE_TOO_LARGE",
]);

export function formatPsaAnalyzeError(err: unknown): string {
  if (err instanceof PsaApiError && err.message.trim()) {
    return err.message.trim();
  }
  if (isPsaRateLimitError(err)) return PSA_RATE_LIMIT_ALERT_MESSAGE;
  if (err instanceof PsaApiError) return err.message;
  if (err instanceof Error) {
    for (const code of CARDHEDGER_CLIENT_CODES) {
      if (err.message.includes(code)) return err.message;
    }
    return err.message;
  }
  return "PSA lookup failed";
}

export async function throwIfPsaResponseNotOk(res: Response): Promise<void> {
  if (res.ok) return;
  const err = (await res.json().catch(() => ({}))) as PsaErrorBody;
  const code = typeof err.code === "string" ? err.code : undefined;
  let message =
    typeof err.message === "string" && err.message.trim()
      ? err.message.trim()
      : Array.isArray(err.message)
        ? err.message.join("; ")
        : res.status === 429
          ? PSA_RATE_LIMIT_ALERT_MESSAGE
          : "PSA request failed";
  if (
    res.status >= 400 &&
    !message.startsWith("[HTTP") &&
    !CARDHEDGER_CLIENT_CODES.has(code ?? "")
  ) {
    message = `[HTTP ${res.status}] ${message}`;
  }
  throw new PsaApiError(message, res.status, code);
}
