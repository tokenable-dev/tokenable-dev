/**
 * Lightweight MRU-ordered hot-key set for proactive identity cache reconciliation.
 * Evicts oldest entries when capacity is exceeded.
 */
export class IdentityHotKeyLru {
  private readonly order: string[] = [];
  private readonly keys = new Set<string>();

  constructor(private readonly maxSize: number) {}

  touch(key: string): void {
    const k = key.toLowerCase();
    if (this.keys.has(k)) {
      const idx = this.order.indexOf(k);
      if (idx >= 0) this.order.splice(idx, 1);
    } else if (this.order.length >= this.maxSize) {
      const evicted = this.order.shift();
      if (evicted) this.keys.delete(evicted);
    }
    this.order.push(k);
    this.keys.add(k);
  }

  /** MRU-first snapshot (most recently accessed first). */
  snapshotMruFirst(): string[] {
    return [...this.order].reverse();
  }

  size(): number {
    return this.keys.size;
  }
}
