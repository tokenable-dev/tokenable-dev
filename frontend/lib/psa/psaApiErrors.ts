/** Mirrors backend `PSA_RATE_LIMIT_CODE`. */
export const PSA_RATE_LIMIT_CODE = "PSA_RATE_LIMIT_EXCEEDED";

/** Shown in Sell flow when PSA Public API returns 429. */
export const PSA_RATE_LIMIT_ALERT_MESSAGE =
  "PSA lookup limit exceeded. Please try again later.";

export const PSA_RATE_LIMIT_OVERLAY_TITLE = PSA_RATE_LIMIT_ALERT_MESSAGE;

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
  message?: string;
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

export function formatPsaAnalyzeError(err: unknown): string {
  if (isPsaRateLimitError(err)) return PSA_RATE_LIMIT_ALERT_MESSAGE;
  if (err instanceof PsaApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "PSA lookup failed";
}

export async function throwIfPsaResponseNotOk(res: Response): Promise<void> {
  if (res.ok) return;
  const err = (await res.json().catch(() => ({}))) as PsaErrorBody;
  const message =
    typeof err.message === "string" && err.message.trim()
      ? err.message.trim()
      : res.status === 429
        ? PSA_RATE_LIMIT_ALERT_MESSAGE
        : "PSA request failed";
  const code = typeof err.code === "string" ? err.code : undefined;
  throw new PsaApiError(message, res.status, code);
}
