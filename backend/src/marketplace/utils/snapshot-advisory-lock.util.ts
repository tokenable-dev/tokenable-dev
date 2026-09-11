import { createHash } from 'crypto';

/** Domain-separated prefix — isolates snapshot locks from other hash-derived ids. */
const SNAPSHOT_LOCK_DOMAIN = 'tokenable:snapshot-lock:';

export type SnapshotAdvisoryLockKey = {
  key1: number;
  key2: number;
};

/**
 * Deterministic 64-bit advisory lock identity for a collection_key.
 *
 * Uses PostgreSQL session lock form `pg_try_advisory_lock(int4, int4)`:
 *   - key1 + key2 = first 8 bytes of SHA-256(domain + normalized collectionKey)
 *   - signed int32 values (PostgreSQL int4)
 *
 * Disjoint from portfolio daily snapshot lock (`pg_try_advisory_lock(bigint)` single-key).
 */
export function collectionKeyToAdvisoryLockKey(
  collectionKey: string,
): SnapshotAdvisoryLockKey {
  const normalized = collectionKey.toLowerCase().trim();
  const digest = createHash('sha256')
    .update(SNAPSHOT_LOCK_DOMAIN + normalized, 'utf8')
    .digest();
  return {
    key1: digest.readInt32BE(0),
    key2: digest.readInt32BE(4),
  };
}

/** Compact string for structured logs (not used for locking). */
export function formatAdvisoryLockKey(key: SnapshotAdvisoryLockKey): string {
  return `${key.key1},${key.key2}`;
}
