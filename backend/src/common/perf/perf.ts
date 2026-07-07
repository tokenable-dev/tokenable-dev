/**
 * Lightweight performance instrumentation.
 *
 * Enable:          PERF_LOG=true  (or PERF_LOG=1)
 * Request threshold: PERF_THRESHOLD_MS=200    (ms, default 200)
 * DB threshold:     PERF_THRESHOLD_DB_MS=500  (ms, default 500, TypeORM slow-query)
 *
 * All hot-path functions are zero-cost no-ops when PERF_LOG is not set.
 * Output is newline-delimited JSON written to stdout (bypasses NestJS formatting).
 */

const ENABLED =
  process.env.PERF_LOG === 'true' || process.env.PERF_LOG === '1';

function parseEnvMs(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (!raw) return defaultValue;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : defaultValue;
}

export const perf = {
  enabled: ENABLED,
  thresholdMs: parseEnvMs('PERF_THRESHOLD_MS', 200),
  thresholdDbMs: parseEnvMs('PERF_THRESHOLD_DB_MS', 500),
} as const;

/**
 * High-resolution timestamp. Returns `0n` when instrumentation is disabled
 * so callers pay only a branch prediction cost.
 */
export function perfNow(): bigint {
  return ENABLED ? process.hrtime.bigint() : 0n;
}

/**
 * Emit a structured JSON perf line to stdout when `ms >= threshold`.
 * Complete no-op when `PERF_LOG` is unset.
 *
 * @example
 * perfLog('psa', 'GetByCertNumber', ms, { cert: '12345678' });
 * // → {"perf":"psa","label":"GetByCertNumber","ms":312.45,"cert":"12345678"}
 */
export function perfLog(
  category: string,
  label: string,
  ms: number,
  extra?: Record<string, unknown>,
  thresholdMs: number = perf.thresholdMs,
): void {
  if (!ENABLED || ms < thresholdMs) return;
  const entry: Record<string, unknown> = { perf: category, label, ms: +ms.toFixed(2), ...extra };
  process.stdout.write(JSON.stringify(entry) + '\n');
}

/**
 * Convert a nanosecond `hrtime.bigint()` start time to milliseconds.
 * Returns `0` when instrumentation is disabled (start will be `0n`).
 */
export function elapsedMs(startNs: bigint): number {
  if (!ENABLED) return 0;
  return Number(process.hrtime.bigint() - startNs) / 1_000_000;
}
