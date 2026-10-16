function isRetryableRpcError(err: unknown): boolean {
  const text = String(err instanceof Error ? err.message : err).toLowerCase();
  return (
    /rpc request failed|failed to fetch|network error|econnreset|socket hang up|502|503|504|429|timeout|timed out|bad gateway|service unavailable/i.test(
      text,
    )
  );
}

/** Best-effort retries for flaky browser / public RPC endpoints (mainnet reads). */
export async function withRpcReadRetry<T>(
  run: () => Promise<T>,
  opts?: { attempts?: number; baseDelayMs?: number },
): Promise<T> {
  const attempts = Math.max(1, opts?.attempts ?? 4);
  const baseDelayMs = opts?.baseDelayMs ?? 400;
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await run();
    } catch (e) {
      last = e;
      if (!isRetryableRpcError(e) || i >= attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, baseDelayMs * (i + 1)));
    }
  }
  throw last;
}
