type UnknownRecord = Record<string, unknown>;

export type HistoryPoint = { t: number; v: number };

function isRecord(x: unknown): x is UnknownRecord {
  return typeof x === 'object' && x !== null;
}

function toUnixSec(tRaw: unknown): number | null {
  if (typeof tRaw === 'number' && Number.isFinite(tRaw)) {
    return tRaw > 1e12 ? Math.floor(tRaw / 1000) : Math.floor(tRaw);
  }
  if (typeof tRaw === 'string') {
    const ms = Date.parse(tRaw);
    if (Number.isFinite(ms)) return Math.floor(ms / 1000);
  }
  return null;
}

/**
 * Parse PokeTrace GET /cards/:id/prices/:tier/history JSON (shape may vary by version).
 */
export function parsePokeTraceHistoryBody(body: unknown): {
  points: HistoryPoint[];
  nextCursor: string | null;
} {
  if (!isRecord(body)) {
    return { points: [], nextCursor: null };
  }

  const rawList =
    (Array.isArray(body.data) ? body.data : null) ??
    (Array.isArray(body.history) ? body.history : null) ??
    (Array.isArray(body.points) ? body.points : null) ??
    [];

  const points: HistoryPoint[] = [];
  for (const row of rawList) {
    if (!isRecord(row)) continue;
    const vRaw =
      row.avg ?? row.value ?? row.price ?? row.v ?? row.close ?? row.mean;
    const v =
      typeof vRaw === 'number' && Number.isFinite(vRaw) && vRaw > 0
        ? vRaw
        : null;
    if (v == null) continue;
    const t = toUnixSec(
      row.t ??
        row.timestamp ??
        row.time ??
        row.date ??
        row.bucketStart ??
        row.day ??
        row.bucket,
    );
    if (t == null || !Number.isFinite(t)) continue;
    points.push({ t, v });
  }

  points.sort((a, b) => a.t - b.t);

  let nextCursor: string | null = null;
  const pag = isRecord(body.pagination) ? body.pagination : null;
  const nestedCursor =
    pag && typeof pag.nextCursor === 'string' ? pag.nextCursor : null;
  const c =
    body.nextCursor ??
    nestedCursor ??
    body.cursor ??
    body.next ??
    body.pageToken ??
    null;
  if (typeof c === 'string' && c.length > 0) nextCursor = c;
  const hasMoreFalse =
    (typeof body.hasMore === 'boolean' && body.hasMore === false) ||
    (pag && typeof pag.hasMore === 'boolean' && pag.hasMore === false);
  if (hasMoreFalse) {
    nextCursor = null;
  }

  return { points, nextCursor };
}

/** Dedupe by calendar UTC day (keep last), trim to [now - maxDays, now]. */
export function trimHistoryToWindow(
  points: HistoryPoint[],
  nowSec: number,
  maxDays: number,
): HistoryPoint[] {
  const lo = nowSec - maxDays * 86400;
  const filtered = points.filter((p) => p.t >= lo && p.t <= nowSec);
  const byDay = new Map<string, HistoryPoint>();
  for (const p of filtered) {
    const d = new Date(p.t * 1000);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    const prev = byDay.get(key);
    if (!prev || p.t >= prev.t) byDay.set(key, p);
  }
  return [...byDay.values()].sort((a, b) => a.t - b.t);
}
