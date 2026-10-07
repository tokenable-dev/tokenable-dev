import type { DataSource } from 'typeorm';

export type PgSessionAdvisoryLockResult<T> =
  | { acquired: false }
  | { acquired: true; value: T };

/**
 * Session advisory lock on one dedicated connection (lock + unlock same session).
 * Pool checkout per `dataSource.query()` can leave locks on other sessions and
 * exhaust Postgres `max_connections` under cron load.
 * `lockKey` is one bigint key or the two-int4 form `pg_try_advisory_lock(k1, k2)`.
 */
export async function runWithPgSessionAdvisoryLock<T>(
  dataSource: DataSource,
  lockKey: number | readonly [number, number],
  fn: () => Promise<T>,
): Promise<PgSessionAdvisoryLockResult<T>> {
  const params = typeof lockKey === 'number' ? [lockKey] : [...lockKey];
  const args = params.length === 1 ? '$1' : '$1, $2';
  const qr = dataSource.createQueryRunner();
  await qr.connect();
  let acquired = false;
  try {
    const rows = (await qr.query(
      `SELECT pg_try_advisory_lock(${args}) AS ok`,
      params,
    )) as { ok: boolean | string }[];
    const ok = rows[0]?.ok;
    acquired = ok === true || ok === 't';
    if (!acquired) {
      return { acquired: false };
    }
    const value = await fn();
    return { acquired: true, value };
  } finally {
    if (acquired) {
      try {
        await qr.query(`SELECT pg_advisory_unlock(${args})`, params);
      } catch {
        // Best-effort; connection release ends the session anyway.
      }
    }
    await qr.release();
  }
}
