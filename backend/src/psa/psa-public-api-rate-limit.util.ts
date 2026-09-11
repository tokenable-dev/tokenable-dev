/** Parse Retry-After (seconds) or fall back to configured cooldown. */
export function psaRateLimitCooldownMs(
  retryAfterHeader: string | null | undefined,
  defaultCooldownMs: number,
  /** Cap in-process short-circuit (PSA may send Retry-After ≈ 24h for daily quota). */
  maxInProcessMs?: number,
): number {
  const raw = retryAfterHeader?.trim();
  const sec = raw ? parseInt(raw, 10) : NaN;
  let ms: number;
  if (Number.isFinite(sec) && sec > 0) {
    ms = Math.max(sec, 1) * 1000;
  } else {
    ms = Math.max(defaultCooldownMs, 1_000);
  }
  if (maxInProcessMs != null && maxInProcessMs > 0) {
    return Math.min(ms, maxInProcessMs);
  }
  return ms;
}

export function parsePositiveIntEnv(
  raw: string | undefined,
  fallback: number,
  max?: number,
): number {
  const parsed = raw ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  if (max != null) return Math.min(parsed, max);
  return parsed;
}
