/**
 * P3.19 — Log volume controls for identity cache (dedup + async drift sampling).
 *
 * Logging-only — no effect on Decision / Execution / cache semantics.
 */

/** Suppress identical key+outcome logs within this window. */
export const IDENTITY_LOG_DEDUP_MS = 10_000;

/** Cap dedup map size (memory safety). */
export const IDENTITY_LOG_DEDUP_MAX_KEYS = 5_000;

export class IdentityLogDeduper {
  private readonly recent = new Map<string, number>();

  shouldEmit(key: string | undefined, outcome: string): boolean {
    const dedupKey = `${key ?? '*'}:${outcome}`;
    const now = Date.now();
    const last = this.recent.get(dedupKey);
    if (last != null && now - last < IDENTITY_LOG_DEDUP_MS) {
      return false;
    }
    this.recent.set(dedupKey, now);
    if (this.recent.size > IDENTITY_LOG_DEDUP_MAX_KEYS) {
      this.pruneExpired(now);
    }
    return true;
  }

  private pruneExpired(now: number): void {
    for (const [k, t] of this.recent) {
      if (now - t >= IDENTITY_LOG_DEDUP_MS) {
        this.recent.delete(k);
      }
    }
  }
}

/** Returns true when async drift logs should be emitted (default 1% sample). */
export function shouldSampleAsyncDriftLog(sampleRate: number): boolean {
  if (sampleRate <= 0) return false;
  if (sampleRate >= 1) return true;
  return Math.random() < sampleRate;
}
