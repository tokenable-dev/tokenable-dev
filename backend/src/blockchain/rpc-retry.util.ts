const DEFAULT_MAX_RETRIES = 6;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** True when the RPC provider throttled the request (Alchemy Free CU/s, etc.). */
export function isRpcRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== 'object') {
    return /429|rate limit|compute units per second|too many requests/i.test(
      String(err),
    );
  }
  const e = err as {
    code?: unknown;
    message?: string;
    shortMessage?: string;
    info?: { error?: { code?: unknown; message?: string } };
  };
  const code = e.info?.error?.code ?? e.code;
  if (code === 429 || code === '429') return true;
  const blob = `${e.message ?? ''} ${e.shortMessage ?? ''} ${e.info?.error?.message ?? ''}`;
  return /429|rate limit|compute units per second|too many requests/i.test(blob);
}

/** Retry read-only RPC calls when the provider returns 429 / CU throttling. */
export async function withRpcRateLimitRetry<T>(
  fn: () => Promise<T>,
  opts?: { maxRetries?: number; label?: string },
): Promise<T> {
  const maxRetries = opts?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const label = opts?.label ?? 'rpc';
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRpcRateLimitError(err) || attempt >= maxRetries) throw err;
      const waitMs = Math.min(30_000, 400 * 2 ** (attempt - 1));
      await sleep(waitMs);
    }
  }
  throw lastErr;
}
