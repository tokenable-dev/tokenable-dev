/** In-process TTL cache — swap for Redis later without changing callers. */
export class Ga4AnalyticsCache<T> {
  private readonly store = new Map<string, { at: number; value: T }>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | null {
    const row = this.store.get(key);
    if (!row) return null;
    if (Date.now() - row.at > this.ttlMs) {
      this.store.delete(key);
      return null;
    }
    return row.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, { at: Date.now(), value });
  }
}
