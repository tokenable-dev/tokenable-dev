/**
 * Lightweight client-side performance instrumentation.
 *
 * Enable at runtime (no rebuild required):
 *   localStorage.setItem('PERF_LOG', '1'); location.reload();
 *
 * Set threshold (default 200ms):
 *   localStorage.setItem('PERF_THRESHOLD_MS', '100'); location.reload();
 *
 * Disable:
 *   localStorage.removeItem('PERF_LOG'); location.reload();
 *
 * Output: newline-delimited JSON to console.log, parseable by devtools or CLI.
 *
 * @example
 * { "perf": "query", "label": "collection-detail", "ms": 412.34 }
 */

function readLocalStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function parseThreshold(key: string, defaultValue: number): number {
  const raw = readLocalStorage(key);
  if (!raw) return defaultValue;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : defaultValue;
}

const _v = readLocalStorage("PERF_LOG");
export const PERF_ENABLED = _v === "1" || _v === "true";
export const PERF_THRESHOLD_MS = parseThreshold("PERF_THRESHOLD_MS", 200);

/**
 * Emit a structured JSON perf line via console.log when `ms >= PERF_THRESHOLD_MS`.
 * Complete no-op when instrumentation is disabled.
 */
export function perfLog(
  category: string,
  label: string,
  ms: number,
  extra?: Record<string, unknown>,
  thresholdMs: number = PERF_THRESHOLD_MS,
): void {
  if (!PERF_ENABLED || ms < thresholdMs) return;
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({ perf: category, label, ms: +ms.toFixed(2), ...extra }),
  );
}
